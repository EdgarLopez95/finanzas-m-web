import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp, type DocumentReference } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { resolveHouseholdEventCancelBlock } from "@/features/household/lib/household-debt-lifecycle";

export type CancelHouseholdEventInput = {
  eventId: string;
};

/**
 * Cancela un household_event, sus household_event_shares pendientes y deudas pendientes en una
 * transacción atómica. Paridad Android (HouseholdEventCapabilities.kt:64-82): solo bloquea si
 * alguna deuda está "paid" o "payment_declared"; las shares "completed" nunca bloquean y se
 * preservan sin tocar (dinero real ya movido, no se revierte al cancelar). Solo las shares
 * "pending_completion" pasan a "cancelled".
 * No realiza borrados físicos, solo marca status = "cancelled".
 */
export const cancelHouseholdEvent = async (input: CancelHouseholdEventInput): Promise<void> => {
  const { eventId } = input;
  const db = getFirebaseDb();
  const eventRef = doc(db, "household_events", eventId);

  // 1. Leer el evento primero para obtener su householdId. H1.5a: las Rules de
  // household_event_shares/household_debts solo pueden evaluar una consulta "list" si el filtro
  // usado coincide con el campo que la Rule de lectura consulta (householdId); consultar solo por
  // eventId no es evaluable estáticamente por Rules y Firestore la rechaza siempre
  // ("Property householdId is undefined on object. for 'list'"), incluso para un miembro legítimo.
  const eventPreSnap = await getDoc(eventRef);
  if (!eventPreSnap.exists()) {
    throw new Error("El gasto del Hogar no existe.");
  }
  const householdId = String(eventPreSnap.data().householdId ?? "");
  if (!householdId) {
    throw new Error("El gasto del Hogar no tiene un hogar válido asociado.");
  }

  // 2. Consultar shares y deudas por householdId (permitido por Rules) y filtrar por eventId en
  // memoria, para no afectar shares/deudas de otros eventos del mismo hogar.
  const sharesSnapshot = await getDocs(
    query(collection(db, "household_event_shares"), where("householdId", "==", householdId))
  );
  const debtsSnapshot = await getDocs(
    query(collection(db, "household_debts"), where("householdId", "==", householdId))
  );
  const shareDocsForEvent = sharesSnapshot.docs.filter((docItem) => docItem.data().eventId === eventId);
  const debtDocsForEvent = debtsSnapshot.docs.filter((docItem) => docItem.data().eventId === eventId);

  // 3. Ejecutar transacción
  await runTransaction(db, async (transaction) => {
    // A. Re-leer evento
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("El gasto del Hogar no existe.");
    }
    const eventData = eventSnap.data();

    if (eventData.status === "cancelled" || eventData.status === "deleted") {
      throw new Error("El gasto ya está cancelado o eliminado.");
    }

    // B. Re-leer shares (solo las del evento elegido, ya filtradas en el paso 2)
    const shareRefsAndData: { ref: DocumentReference; status: string }[] = [];
    for (const docItem of shareDocsForEvent) {
      const snap = await transaction.get(docItem.ref);
      const data = snap.data();
      if (snap.exists() && data) {
        shareRefsAndData.push({
          ref: docItem.ref,
          status: data.status || "",
        });
      }
    }

    // C. Re-leer deudas (solo las del evento elegido, ya filtradas en el paso 2)
    const debtRefsAndData: { ref: DocumentReference; status: string }[] = [];
    for (const docItem of debtDocsForEvent) {
      const snap = await transaction.get(docItem.ref);
      const data = snap.data();
      if (snap.exists() && data) {
        debtRefsAndData.push({
          ref: docItem.ref,
          status: data.status || "",
        });
      }
    }

    // D. Validar que no existan deudas saldadas/declaradas (paridad Android: las shares
    // completadas NUNCA bloquean la cancelación, solo el estado de las deudas).
    const cancelBlock = resolveHouseholdEventCancelBlock(
      debtRefsAndData.map((d) => ({ id: d.ref.id, status: d.status }))
    );

    if (cancelBlock) {
      throw new Error("No se puede cancelar un gasto que ya tiene pagos declarados o completados.");
    }

    // E. Actualizaciones
    // - event.status = "cancelled"
    transaction.update(eventRef, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });

    // - shares pending_completion -> cancelled; las "completed" se preservan intactas.
    for (const share of shareRefsAndData) {
      if (share.status === "pending_completion") {
        transaction.update(share.ref, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      }
    }

    // - debts pending = "cancelled"
    for (const debt of debtRefsAndData) {
      if (debt.status === "pending") {
        transaction.update(debt.ref, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
};
