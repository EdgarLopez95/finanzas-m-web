import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { monthStartMillis, nextMonthStartMillis, startOfDayMillis } from "@/lib/mplus/bogota-date";
import { millisToTimestamp, movementFromFirestore, type FirestoreData } from "@/lib/mplus/converters";
import type { MplusMovement } from "@/lib/mplus/models";
import { MPLUS_PATHS } from "@/lib/mplus/paths";

/**
 * Lecturas canonicas de `movements` (contrato §19.1 y §19.2).
 *
 * Las dos consultas usan exactamente los indices compuestos declarados en
 * §20 y versionados en `android/firestore.indexes.json`:
 *
 *   ownerId ASC, lifecycleState ASC, occurredAt DESC   -> mes Personal
 *   ownerId ASC, lifecycleState ASC, purgeAfter ASC    -> Papelera
 *
 * Cualquier filtro adicional (tipo, categoria, cuenta, busqueda por titulo) se
 * aplica LOCALMENTE sobre el mes ya cargado: el contrato lo exige para no
 * multiplicar indices ni alterar los totales (§19.1).
 */

export type PersonalMonthRange = Readonly<{
  /** Inicio del mes en hora Colombia, inclusivo. */
  startMillis: number;
  /** Inicio del mes siguiente, exclusivo (intervalo semiabierto, §4.6). */
  endMillis: number;
}>;

/** Rango semiabierto del mes bogotano que contiene [referenceMillis]. */
export const resolvePersonalMonthRange = (referenceMillis: number): PersonalMonthRange => ({
  startMillis: monthStartMillis(referenceMillis),
  endMillis: nextMonthStartMillis(referenceMillis),
});

/** Rango del mes indicado por año y mes calendario (1–12) en hora Colombia. */
export const resolveMonthRangeFor = (year: number, month: number): PersonalMonthRange => {
  const startMillis = startOfDayMillis({ year, month, day: 1 });
  const endMillis =
    month === 12
      ? startOfDayMillis({ year: year + 1, month: 1, day: 1 })
      : startOfDayMillis({ year, month: month + 1, day: 1 });
  return { startMillis, endMillis };
};

/**
 * Movimientos `active` del mes, ordenados por fecha descendente.
 * Es la unica consulta que alimenta el tablero y el historial Personal.
 */
export const readPersonalMonthMovements = async (
  ownerId: string,
  range: PersonalMonthRange,
  db: Firestore = getFirebaseDb(),
): Promise<MplusMovement[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, MPLUS_PATHS.movements),
      where("ownerId", "==", ownerId),
      where("lifecycleState", "==", "active"),
      where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
      where("occurredAt", "<", millisToTimestamp(range.endMillis)),
      orderBy("occurredAt", "desc"),
    ),
  );

  return snapshot.docs.map((docSnapshot) =>
    movementFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
  );
};

/**
 * Suscripción en tiempo real a los movimientos `active` del mes seleccionado.
 * Emite inmediatamente y ante cualquier creación, edición o borrado remoto.
 */
export const subscribePersonalMonthMovements = (
  ownerId: string,
  range: PersonalMonthRange,
  onUpdate: (movements: MplusMovement[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  const q = query(
    collection(db, MPLUS_PATHS.movements),
    where("ownerId", "==", ownerId),
    where("lifecycleState", "==", "active"),
    where("occurredAt", ">=", millisToTimestamp(range.startMillis)),
    where("occurredAt", "<", millisToTimestamp(range.endMillis)),
    orderBy("occurredAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const movements = snapshot.docs.map((docSnapshot) =>
        movementFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
      );
      onUpdate(movements);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

/**
 * Movimientos en Papelera, ordenados por vencimiento ascendente: primero los
 * que estan a punto de purgarse (contrato §19.2).
 *
 * Devuelve TODOS los documentos, incluidos los ya vencidos. Quien consume
 * decide: la UI los oculta y dispara su purga (§9.5). Filtrarlos aqui
 * escondería del purgador justo los que debe eliminar.
 */
export const readPersonalTrashedMovements = async (
  ownerId: string,
  db: Firestore = getFirebaseDb(),
): Promise<MplusMovement[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, MPLUS_PATHS.movements),
      where("ownerId", "==", ownerId),
      where("lifecycleState", "==", "trashed"),
      orderBy("purgeAfter", "asc"),
    ),
  );

  return snapshot.docs.map((docSnapshot) =>
    movementFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
  );
};

/**
 * Suscripción en tiempo real a la papelera del usuario (`lifecycleState == 'trashed'`).
 * Emite inmediatamente y ante movimientos enviados a papelera, restaurados o purgados.
 */
export const subscribePersonalTrashedMovements = (
  ownerId: string,
  onUpdate: (trashed: MplusMovement[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  const q = query(
    collection(db, MPLUS_PATHS.movements),
    where("ownerId", "==", ownerId),
    where("lifecycleState", "==", "trashed"),
    orderBy("purgeAfter", "asc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const trashed = snapshot.docs.map((docSnapshot) =>
        movementFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
      );
      onUpdate(trashed);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

/** `true` si el documento ya vencio y debe dejar de mostrarse (contrato §9.5). */
export const isPurgeDue = (movement: MplusMovement, nowMillis: number): boolean =>
  movement.purgeAfterMillis !== null && movement.purgeAfterMillis <= nowMillis;

/** Particiona la Papelera en lo que se muestra y lo que toca purgar. */
export const splitTrashByExpiry = (
  movements: readonly MplusMovement[],
  nowMillis: number,
): Readonly<{ visible: MplusMovement[]; expired: MplusMovement[] }> => {
  const visible: MplusMovement[] = [];
  const expired: MplusMovement[] = [];
  for (const movement of movements) {
    if (isPurgeDue(movement, nowMillis)) {
      expired.push(movement);
    } else {
      visible.push(movement);
    }
  }
  return { visible, expired };
};
