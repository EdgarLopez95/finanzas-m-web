import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Transaction,
  type Firestore,
} from "firebase/firestore";

import { resolveMonthRangeFor } from "@/features/movements/services/read-personal-movements";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  categoryMappingFromFirestore,
  categoryMappingToFirestore,
  millisToTimestamp,
  movementFromFirestore,
  movementToFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
import { categoryMappingId, newMutationId } from "@/lib/mplus/ids";
import type { MplusCategoryMapping, MplusMovement } from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "@/lib/mplus/mutation-runner";
import {
  categoryMappingDocPath,
  movementDocPath,
  MPLUS_PATHS,
} from "@/lib/mplus/paths";

export type HouseholdMonthRange = {
  year: number;
  month: number;
  startMillis: number;
  endMillis: number;
};

/**
 * Consulta canónica mensual de movimientos compartidos (§19.3).
 *
 * Filtra por `householdId`, `lifecycleState == active`, y rango de mes Bogotá.
 * Ordena por `occurredAt desc`.
 */
export const readHouseholdMonthMovements = async (
  householdId: string,
  period: { year: number; month: number },
  db: Firestore = getFirebaseDb(),
): Promise<MplusMovement[]> => {
  const range = resolveMonthRangeFor(period.year, period.month);
  const movementsRef = collection(db, MPLUS_PATHS.movements);

  const q = query(
    movementsRef,
    where("householdId", "==", householdId),
    where("lifecycleState", "==", "active"),
    where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
    where("occurredAt", "<", millisToTimestamp(range.endMillis)),
    orderBy("occurredAt", "desc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => movementFromFirestore(d.id, d.data()));
};

/**
 * Suscripción en tiempo real a los movimientos compartidos del mes seleccionado (`householdId == X`).
 */
export const subscribeHouseholdMonthMovements = (
  householdId: string,
  period: { year: number; month: number },
  onUpdate: (movements: MplusMovement[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  const range = resolveMonthRangeFor(period.year, period.month);
  const q = query(
    collection(db, MPLUS_PATHS.movements),
    where("householdId", "==", householdId),
    where("lifecycleState", "==", "active"),
    where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
    where("occurredAt", "<", millisToTimestamp(range.endMillis)),
    orderBy("occurredAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      const movements = snap.docs.map((d) => movementFromFirestore(d.id, d.data()));
      onUpdate(movements);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

/**
 * Corrección de categoría de gasto de Hogar por el compañero (§9.4, §14, DEC-005, DEC-015).
 *
 * Actualiza el `householdCategoryId` del movimiento activo y crea o actualiza
 * la equivalencia en `households/{householdId}/categoryMappings/{ownerId}__{personalCategoryId}`
 * para que los futuros gastos similares del mismo dueño se clasifiquen automáticamente.
 */
export const correctPartnerMovementCategory = async (
  params: {
    householdId: string;
    movement: MplusMovement;
    targetHouseholdCategoryId: string;
    updatedByUid: string;
  },
  options?: {
    db?: Firestore;
    deps?: MplusRunnerDeps;
    nowMillis?: number;
  },
): Promise<MplusMutationOutcome<{ updatedMovement: MplusMovement; mapping: MplusCategoryMapping }>> => {
  const { householdId, movement, targetHouseholdCategoryId, updatedByUid } = params;
  const db = options?.db ?? getFirebaseDb();
  const mutationId = newMutationId();
  const now = options?.nowMillis ?? Date.now();

  const mappingKey = categoryMappingId(movement.ownerId, movement.categoryId);
  const mappingRef = doc(db, ...categoryMappingDocPath(householdId, mappingKey));
  const movementRef = doc(db, ...movementDocPath(movement.id));

  const updatedMovement: MplusMovement = {
    ...movement,
    householdCategoryId: targetHouseholdCategoryId,
    revision: movement.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<{ updatedMovement: MplusMovement; mapping: MplusCategoryMapping }>(
    db,
    {
      mutationId,
      occ: [
        { resource: "movements", id: movement.id, ref: movementRef, baseRevision: movement.revision },
      ],
      work: async (tx: Transaction) => {
        // Fase 1: Lectura de la equivalencia dentro de la transacción
        const mappingSnap = await tx.get(mappingRef);
        const existingMapping = mappingSnap.exists()
          ? categoryMappingFromFirestore(mappingSnap.id, mappingSnap.data() as FirestoreData)
          : null;

        const mappingNeedsUpdate =
          !existingMapping || existingMapping.householdCategoryId !== targetHouseholdCategoryId;

        const updatedMapping: MplusCategoryMapping = existingMapping
          ? {
              ...existingMapping,
              householdCategoryId: targetHouseholdCategoryId,
              updatedBy: updatedByUid,
              revision: existingMapping.revision + 1,
              lastMutationId: mutationId,
              updatedAtMillis: now,
            }
          : {
              id: mappingKey,
              schemaVersion: 1,
              householdId,
              ownerId: movement.ownerId,
              personalCategoryId: movement.categoryId,
              householdCategoryId: targetHouseholdCategoryId,
              updatedBy: updatedByUid,
              revision: 1,
              lastMutationId: mutationId,
              createdAtMillis: now,
              updatedAtMillis: now,
            };

        // Fase 2: Escrituras
        tx.update(movementRef, movementToFirestore(updatedMovement));
        if (mappingNeedsUpdate) {
          if (existingMapping) {
            tx.update(mappingRef, categoryMappingToFirestore(updatedMapping));
          } else {
            tx.set(mappingRef, categoryMappingToFirestore(updatedMapping));
          }
        }
        return { updatedMovement, mapping: mappingNeedsUpdate ? updatedMapping : existingMapping };
      },
    },
    options?.deps,
  );
};
