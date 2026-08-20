import {
  runTransaction as firestoreRunTransaction,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import type { FirestoreData } from "./converters";
import { MplusContractValidationError } from "./schemas";

/**
 * Ejecutor unico de mutaciones remotas del contrato v1 (§4.3, §22, §23).
 *
 * Toda mutacion que dependa del estado actual (revision, contadores de cuenta,
 * relaciones entre documentos) pasa por aqui. Reglas que impone:
 *
 * 1. **OCC obligatorio.** La revision remota debe coincidir con la revision
 *    base del cliente; si no, se produce `conflict` y NO se aplica
 *    last-write-wins silencioso.
 * 2. **Mismo resultado de conflicto que Android.** La clasificacion replica
 *    `MplusFirestoreMutationApplier` / `MplusRemoteApplyResult`: `success`,
 *    `conflict`, `rejected` (rechazo no recuperable de validacion/permiso) y
 *    `unavailable` (equivalente Web de `RecoverableError`: sin cola local, un
 *    error de red es un fallo visible, no un reintento oculto).
 * 3. **Reintento idempotente.** Si el documento remoto ya trae este mismo
 *    `lastMutationId`, la operacion ya se aplico: se responde exito con el
 *    estado remoto en lugar de un conflicto falso.
 * 4. **Nada de exito anticipado.** El resultado solo es `success` despues de
 *    que `runTransaction` haya confirmado el commit remoto. Quien llama no
 *    debe pintar exito antes de recibirlo.
 *
 * Web es online-only (contrato §22): aqui no hay cola, ni cache funcional, ni
 * reintento automatico infinito.
 */

export type MplusConflictDetail = Readonly<{
  resource: string;
  id: string;
  baseRevision: number | null;
  /** Revision remota observada; null si el documento no existe. */
  remoteRevision: number | null;
  /** Snapshot remoto crudo para que la UI pueda mostrar "tu version / la del servidor". */
  remoteSnapshot: FirestoreData | null;
}>;

export type MplusMutationOutcome<T> =
  | Readonly<{ kind: "success"; value: T; replayed: boolean }>
  | Readonly<{ kind: "conflict"; conflict: MplusConflictDetail }>
  | Readonly<{ kind: "rejected"; code: string; message: string }>
  | Readonly<{ kind: "unavailable"; code: string; message: string }>;

export type MplusOccTarget = Readonly<{
  /** Nombre de coleccion del contrato, solo para diagnostico. */
  resource: string;
  id: string;
  ref: DocumentReference;
  /** `null` = creacion: el documento no debe existir todavia. */
  baseRevision: number | null;
}>;

export type MplusMutationSpec<T> = Readonly<{
  /** UUID de la operacion logica (`lastMutationId`, contrato §4.3). */
  mutationId: string;
  /** Documentos cuya `revision` gobierna el conflicto. Se leen antes de escribir. */
  occ: readonly MplusOccTarget[];
  /**
   * Escrituras de la mutacion. Recibe la transaccion y los snapshots ya leidos
   * de `occ` (en el mismo orden). Puede hacer lecturas adicionales, siempre
   * ANTES de su primera escritura, como exige Firestore.
   */
  work: (tx: Transaction, occSnapshots: readonly DocumentSnapshot[]) => Promise<T> | T;
}>;

/**
 * Codigos de `FirestoreError` que Android clasifica como recuperables
 * (`MplusRemoteApplyResult.RecoverableError`). En Web se traducen a
 * `unavailable`: la operacion no se aplico y el usuario debe verlo.
 */
const RECOVERABLE_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "aborted",
  "cancelled",
]);

class ConflictSignal extends Error {
  constructor(readonly detail: MplusConflictDetail) {
    super(`conflict:${detail.resource}/${detail.id}`);
    this.name = "MplusConflictSignal";
  }
}

class ReplaySignal extends Error {
  constructor(readonly snapshots: readonly DocumentSnapshot[]) {
    super("replay");
    this.name = "MplusReplaySignal";
  }
}

const readRevision = (snapshot: DocumentSnapshot): number | null => {
  const value = snapshot.data()?.revision;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
};

const readLastMutationId = (snapshot: DocumentSnapshot): string | null => {
  const value = snapshot.data()?.lastMutationId;
  return typeof value === "string" ? value : null;
};

const asFirestoreData = (snapshot: DocumentSnapshot): FirestoreData | null =>
  snapshot.exists() ? ((snapshot.data() ?? {}) as FirestoreData) : null;

const errorCode = (error: unknown): string | null => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Contrato §4.3: cada mutacion aceptada aumenta la revision exactamente en 1.
 */
export const nextRevision = (baseRevision: number): number => baseRevision + 1;

/**
 * Inyeccion para pruebas: por defecto es `runTransaction` del SDK Web. Ningun
 * llamador de produccion lo sustituye.
 */
export type MplusRunnerDeps = Readonly<{
  runTransaction: typeof firestoreRunTransaction;
}>;

const defaultDeps: MplusRunnerDeps = { runTransaction: firestoreRunTransaction };

export const runMplusMutation = async <T>(
  db: Firestore,
  spec: MplusMutationSpec<T>,
  deps: MplusRunnerDeps = defaultDeps,
): Promise<MplusMutationOutcome<T>> => {
  try {
    const value = await deps.runTransaction(db, async (tx) => {
      // Firestore exige todas las lecturas antes de cualquier escritura.
      const snapshots: DocumentSnapshot[] = [];
      for (const target of spec.occ) {
        snapshots.push(await tx.get(target.ref));
      }

      spec.occ.forEach((target, index) => {
        const snapshot = snapshots[index];
        const exists = snapshot.exists();
        const remoteRevision = readRevision(snapshot);
        const isReplay = readLastMutationId(snapshot) === spec.mutationId;

        if (target.baseRevision === null) {
          // Creacion: el documento no debe existir. Si existe con ESTE mismo
          // mutationId, la creacion ya se aplico (reintento) y es exito.
          if (!exists) return;
          if (isReplay) throw new ReplaySignal(snapshots);
          throw new ConflictSignal({
            resource: target.resource,
            id: target.id,
            baseRevision: null,
            remoteRevision,
            remoteSnapshot: asFirestoreData(snapshot),
          });
        }

        // Actualizacion: el documento debe existir y coincidir en revision.
        if (!exists) {
          throw new ConflictSignal({
            resource: target.resource,
            id: target.id,
            baseRevision: target.baseRevision,
            remoteRevision: null,
            remoteSnapshot: null,
          });
        }
        if (remoteRevision !== target.baseRevision) {
          if (isReplay) throw new ReplaySignal(snapshots);
          throw new ConflictSignal({
            resource: target.resource,
            id: target.id,
            baseRevision: target.baseRevision,
            remoteRevision,
            remoteSnapshot: asFirestoreData(snapshot),
          });
        }
      });

      return await spec.work(tx, snapshots);
    });

    return { kind: "success", value, replayed: false };
  } catch (error) {
    if (error instanceof ConflictSignal) {
      return { kind: "conflict", conflict: error.detail };
    }
    if (error instanceof ReplaySignal) {
      // El remoto ya refleja esta misma mutacion: exito idempotente. No hay
      // valor de `work` porque no se ejecuto; quien llama debe releer.
      return {
        kind: "success",
        value: undefined as unknown as T,
        replayed: true,
      };
    }
    if (error instanceof MplusContractValidationError) {
      // Rechazo determinista del propio cliente: reintentar no lo arregla.
      return { kind: "rejected", code: "contract-validation", message: error.message };
    }

    const code = errorCode(error);
    if (code !== null && RECOVERABLE_CODES.has(code)) {
      return { kind: "unavailable", code, message: errorMessage(error) };
    }
    if (code !== null) {
      return { kind: "rejected", code, message: errorMessage(error) };
    }
    // Sin codigo Firestore (fallo de red del navegador, aborto del fetch):
    // Android lo trata como recuperable; en Web es un fallo visible.
    return { kind: "unavailable", code: "unknown", message: errorMessage(error) };
  }
};

/**
 * Traduce un resultado a una excepcion para los llamadores que prefieran
 * `try/catch`. Nunca convierte un `conflict` en exito.
 */
export class MplusMutationFailure extends Error {
  constructor(readonly outcome: Exclude<MplusMutationOutcome<unknown>, { kind: "success" }>) {
    super(
      outcome.kind === "conflict"
        ? `Conflicto de revision en ${outcome.conflict.resource}/${outcome.conflict.id}`
        : outcome.message,
    );
    this.name = "MplusMutationFailure";
  }
}

export const unwrapMplusOutcome = <T>(outcome: MplusMutationOutcome<T>): T => {
  if (outcome.kind === "success") {
    return outcome.value;
  }
  throw new MplusMutationFailure(outcome);
};
