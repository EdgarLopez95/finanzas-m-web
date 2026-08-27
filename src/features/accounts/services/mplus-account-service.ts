import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { isValidAccountIcon } from "@/lib/mplus/catalogs";
import {
  personalAccountFromFirestore,
  personalAccountToFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
import type { AccountIconType, AccountType, CatalogState } from "@/lib/mplus/enums";
import { newMutationId, newUuid } from "@/lib/mplus/ids";
import type { MplusPersonalAccount } from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "@/lib/mplus/mutation-runner";
import { MPLUS_PATHS } from "@/lib/mplus/paths";
import { mplusValidators } from "@/lib/mplus/schemas";

/**
 * Cuentas Personales del contrato v1 (§7).
 *
 * En Finanzas M+ una cuenta es una ETIQUETA informativa: no tiene saldo, ni
 * bolsillos, ni participa en ningun calculo. Solo aporta nombre, icono y color
 * al movimiento que la referencia.
 *
 * `referenceCount` y `lastReferenceMovementId` NO se tocan desde aqui: los
 * mueve exclusivamente la transaccion del movimiento que crea, cambia o purga
 * la referencia (contrato §7.3, ver `movement-mutations.ts`). Renombrar o
 * archivar los conserva sin cambios.
 */

export type AccountVisual = Readonly<{
  type: AccountType;
  iconType: AccountIconType;
  iconKey: string;
  color: string;
}>;

/**
 * `deps` existe solo para pruebas: inyecta el `runTransaction` del SDK.
 */
export type AccountMutationOptions = Readonly<{
  nowMillis?: number;
  db?: Firestore;
  deps?: MplusRunnerDeps;
}>;

export class AccountPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountPreconditionError";
  }
}

const accountRefFor = (db: Firestore, ownerId: string, accountId: string): DocumentReference =>
  doc(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.accounts, accountId);

/** Todas las cuentas del dueño, activas y archivadas, ordenadas por nombre. */
export const readMplusAccounts = async (
  ownerId: string,
  db: Firestore = getFirebaseDb(),
): Promise<MplusPersonalAccount[]> => {
  const snapshot = await getDocs(
    collection(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.accounts),
  );

  return snapshot.docs
    .map((docSnapshot) =>
      personalAccountFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "es-CO"));
};

/**
 * Suscripción en tiempo real a las cuentas personales (`users/{ownerId}/accounts`).
 * Emite inmediatamente las cuentas actuales y se actualiza ante cualquier alta,
 * edición, archivado o eliminación remota.
 */
export const subscribeMplusAccounts = (
  ownerId: string,
  onUpdate: (accounts: MplusPersonalAccount[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.accounts),
    (snapshot) => {
      const accounts = snapshot.docs
        .map((docSnapshot) =>
          personalAccountFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "es-CO"));
      onUpdate(accounts);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

const assertVisualIsValid = (visual: AccountVisual): void => {
  if (!isValidAccountIcon(visual.type, visual.iconType, visual.iconKey)) {
    throw new AccountPreconditionError(
      "La combinacion de tipo, icono y clave no pertenece al catalogo de cuentas.",
    );
  }
};

/**
 * Crea una cuenta (contrato §7.1). Arranca sin referencias: el contador solo
 * lo mueve un movimiento real.
 */
export const createMplusAccount = async (
  ownerId: string,
  name: string,
  visual: AccountVisual,
  options?: AccountMutationOptions & { accountId?: string },
): Promise<MplusMutationOutcome<MplusPersonalAccount>> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();
  assertVisualIsValid(visual);

  const accountId = options?.accountId ?? newUuid();
  const mutationId = newMutationId();
  const account = mplusValidators.account({
    id: accountId,
    schemaVersion: 1,
    ownerId,
    name: name.trim(),
    type: visual.type,
    iconType: visual.iconType,
    iconKey: visual.iconKey,
    color: visual.color,
    state: "active",
    referenceCount: 0,
    lastReferenceMovementId: null,
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
  }) as MplusPersonalAccount;

  const ref = accountRefFor(db, ownerId, accountId);

  return runMplusMutation<MplusPersonalAccount>(db, {
    mutationId,
    occ: [{ resource: MPLUS_PATHS.accounts, id: accountId, ref, baseRevision: null }],
    work: (tx) => {
      tx.set(ref, personalAccountToFirestore(account));
      return account;
    },
  }, options?.deps);
};

type AccountEdit = Readonly<{
  name?: string;
  visual?: AccountVisual;
  state?: CatalogState;
}>;

/**
 * Renombrar, cambiar el visual o archivar/reactivar (contrato §7).
 * Escribe el documento completo con OCC por `revision`; los contadores viajan
 * exactamente como estaban.
 */
export const updateMplusAccount = async (
  current: MplusPersonalAccount,
  edit: AccountEdit,
  options?: AccountMutationOptions,
): Promise<MplusMutationOutcome<MplusPersonalAccount>> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  const visual: AccountVisual = edit.visual ?? {
    type: current.type,
    iconType: current.iconType,
    iconKey: current.iconKey,
    color: current.color,
  };
  assertVisualIsValid(visual);

  const mutationId = newMutationId();
  const next = mplusValidators.account({
    ...current,
    name: (edit.name ?? current.name).trim(),
    type: visual.type,
    iconType: visual.iconType,
    iconKey: visual.iconKey,
    color: visual.color,
    state: edit.state ?? current.state,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusPersonalAccount;

  const ref = accountRefFor(db, current.ownerId, current.id);

  return runMplusMutation<MplusPersonalAccount>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.accounts,
        id: current.id,
        ref,
        baseRevision: current.revision,
      },
    ],
    work: (tx) => {
      tx.set(ref, personalAccountToFirestore(next));
      return next;
    },
  }, options?.deps);
};

/** Archiva una cuenta: deja de ofrecerse en selectores, el historial la conserva. */
export const archiveMplusAccount = (
  current: MplusPersonalAccount,
  options?: AccountMutationOptions,
) => updateMplusAccount(current, { state: "archived" }, options);

/** Reactiva una cuenta archivada. */
export const unarchiveMplusAccount = (
  current: MplusPersonalAccount,
  options?: AccountMutationOptions,
) => updateMplusAccount(current, { state: "active" }, options);
