import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

import { resolveMonthRangeFor } from "@/features/movements/services/read-personal-movements";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  householdExpenseFromFirestore,
  millisToTimestamp,
  type FirestoreData,
} from "@/lib/mplus/converters";
import type { MplusHouseholdExpense } from "@/lib/mplus/models";
import { MPLUS_PATHS } from "@/lib/mplus/paths";

/**
 * Consulta canónica mensual de gastos originados directamente en Hogar.
 *
 * Filtra por `lifecycleState == active`, y rango de mes Bogotá.
 * Ordena por `occurredAt desc`.
 */
export const readHouseholdMonthExpenses = async (
  householdId: string,
  period: { year: number; month: number },
  db: Firestore = getFirebaseDb(),
): Promise<MplusHouseholdExpense[]> => {
  const range = resolveMonthRangeFor(period.year, period.month);
  const expensesRef = collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.householdExpenses);

  const q = query(
    expensesRef,
    where("lifecycleState", "==", "active"),
    where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
    where("occurredAt", "<", millisToTimestamp(range.endMillis)),
    orderBy("occurredAt", "desc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => householdExpenseFromFirestore(d.id, d.data() as FirestoreData));
};

/**
 * Suscripción en tiempo real a los gastos originados en Hogar del mes seleccionado.
 */
export const subscribeHouseholdMonthExpenses = (
  householdId: string,
  period: { year: number; month: number },
  onUpdate: (expenses: MplusHouseholdExpense[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  const range = resolveMonthRangeFor(period.year, period.month);
  const expensesRef = collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.householdExpenses);

  const q = query(
    expensesRef,
    where("lifecycleState", "==", "active"),
    where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
    where("occurredAt", "<", millisToTimestamp(range.endMillis)),
    orderBy("occurredAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      const expenses = snap.docs.map((d) =>
        householdExpenseFromFirestore(d.id, d.data() as FirestoreData),
      );
      onUpdate(expenses);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

/**
 * Consulta de gastos de Hogar en la Papelera.
 * Papelera Hogar muestra una fuente como unidad.
 */
export const readHouseholdTrashedExpenses = async (
  householdId: string,
  db: Firestore = getFirebaseDb(),
): Promise<MplusHouseholdExpense[]> => {
  const expensesRef = collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.householdExpenses);
  const q = query(
    expensesRef,
    where("lifecycleState", "==", "trashed"),
    orderBy("purgeAfter", "asc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => householdExpenseFromFirestore(d.id, d.data() as FirestoreData));
};

/**
 * Suscripción en tiempo real a la papelera de gastos del Hogar.
 */
export const subscribeHouseholdTrashedExpenses = (
  householdId: string,
  onUpdate: (expenses: MplusHouseholdExpense[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  const expensesRef = collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.householdExpenses);
  const q = query(
    expensesRef,
    where("lifecycleState", "==", "trashed"),
    orderBy("purgeAfter", "asc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      const expenses = snap.docs.map((d) =>
        householdExpenseFromFirestore(d.id, d.data() as FirestoreData),
      );
      onUpdate(expenses);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};