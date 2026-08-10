import { doc, runTransaction, Timestamp, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { HouseholdCategory } from "@/types/household";

export type UpdateHouseholdEventInput = {
  eventId: string;
  householdId: string;
  title: string;
  description: string;
  householdCategoryId: string;
  /** Solo se aplica si el evento NO tiene sourceTransactionId. */
  eventDate?: Date;
  householdMemberIds: string[];
  availableCategories: HouseholdCategory[];
};

/**
 * Actualiza un household_event en una transacción atómica de forma solo informativa.
 * Solo se permite modificar metadatos: título, descripción, categoría y fecha 
 * (la fecha solo si no está vinculado a una transacción personal).
 * Las responsabilidades, montos y deudas ya no son mutables en este flujo.
 */
export const updateHouseholdEvent = async (input: UpdateHouseholdEventInput): Promise<void> => {
  const {
    eventId,
    householdId,
    title,
    description,
    householdCategoryId,
    eventDate,
    availableCategories,
  } = input;

  // — Validaciones en el cliente antes de enviar —
  if (!title.trim()) {
    throw new Error("El título del evento es obligatorio.");
  }

  if (!householdCategoryId?.trim()) {
    throw new Error("Selecciona una categoría del hogar.");
  }

  const cat = availableCategories.find((c) => c.id === householdCategoryId);
  if (!cat) {
    throw new Error("La categoría del hogar ya no está disponible.");
  }
  if (cat.householdId !== householdId) {
    throw new Error("La categoría no pertenece al hogar activo.");
  }
  if (cat.archived) {
    throw new Error("La categoría seleccionada está archivada.");
  }

  const db = getFirebaseDb();

  // 2. Ejecutar transacción
  await runTransaction(db, async (transaction) => {
    // A. Re-leer evento
    const eventRef = doc(db, "household_events", eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("El gasto del Hogar no existe.");
    }
    const eventData = eventSnap.data();

    if (eventData.status === "cancelled" || eventData.status === "deleted") {
      throw new Error("No se puede editar un gasto que ya ha sido cancelado o eliminado.");
    }

    // F. Ejecutar escrituras en la transacción
    const updatePayload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      householdCategoryId: householdCategoryId || null,
      updatedAt: serverTimestamp(),
    };

    // La fecha solo se cambia si el evento NO tiene sourceTransactionId
    if (!eventData.sourceTransactionId && eventDate) {
      updatePayload.eventDate = Timestamp.fromDate(eventDate);
    }

    transaction.update(eventRef, updatePayload);
  });
};
