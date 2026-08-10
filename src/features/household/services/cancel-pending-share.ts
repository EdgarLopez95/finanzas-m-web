import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type CancelPendingShareInput = {
  shareId: string;
  currentUid: string;
};

export type CancelPendingShareDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (db: unknown, collectionName: string, ...pathSegments: string[]) => unknown;
  getDocFn?: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  updateDocFn?: (ref: unknown, data: Record<string, unknown>) => Promise<void>;
};

/**
 * Cancela una cuota/responsabilidad pendiente (share) asignada al usuario actual.
 * Paridad canónica con Android (HouseholdEventRepository.cancelPendingShare):
 * - Solo la persona dueña del share (memberUserId == currentUid).
 * - Solo si la share está en estado "pending_completion".
 * - Solo si el evento padre del Hogar está activo ("active").
 * - Cambia únicamente la share a status: "cancelled" y updatedAt.
 * - No altera el evento padre, no crea movimientos personales ni deudas.
 */
export const cancelPendingShare = async (
  input: CancelPendingShareInput,
  deps: CancelPendingShareDeps = {},
): Promise<void> => {
  const { shareId, currentUid } = input;

  if (!shareId || !shareId.trim()) {
    throw new Error("El ID de la cuota pendiente es obligatorio.");
  }
  if (!currentUid || !currentUid.trim()) {
    throw new Error("El ID de usuario es obligatorio.");
  }

  const docImpl = deps.docFn ?? ((database, path, ...segments) => doc(database as ReturnType<typeof getFirebaseDb>, path, ...segments));
  const getDocImpl = deps.getDocFn ?? ((ref) => getDoc(ref as ReturnType<typeof doc>));
  const updateDocImpl = deps.updateDocFn ?? ((ref, data) => updateDoc(ref as ReturnType<typeof doc>, data));
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;

  const db = getDbImpl() as ReturnType<typeof getFirebaseDb>;
  const shareRef = docImpl(db, "household_event_shares", shareId.trim());
  const shareSnap = await getDocImpl(shareRef);

  if (!shareSnap.exists()) {
    throw new Error("La cuota pendiente seleccionada no existe.");
  }

  const shareData = shareSnap.data() as Record<string, unknown>;

  if (shareData.memberUserId !== currentUid.trim()) {
    throw new Error("No tienes permiso para cancelar una cuota que pertenece a otro miembro.");
  }

  const shareStatus = String(shareData.status ?? "");
  if (shareStatus !== "pending_completion") {
    if (shareStatus === "completed") {
      throw new Error("No se puede cancelar una cuota que ya fue completada.");
    }
    if (shareStatus === "cancelled") {
      throw new Error("Esta cuota ya está cancelada.");
    }
    throw new Error("Solo se pueden cancelar cuotas con estado 'pending_completion'.");
  }

  const eventId = shareData.eventId as string | undefined;
  if (!eventId) {
    throw new Error("La cuota no está vinculada a un evento válido.");
  }

  const eventRef = docImpl(db, "household_events", eventId);
  const eventSnap = await getDocImpl(eventRef);

  if (!eventSnap.exists()) {
    throw new Error("El evento del Hogar relacionado no existe.");
  }

  const eventData = eventSnap.data() as Record<string, unknown>;
  if (eventData.status !== "active") {
    throw new Error("No se puede cancelar la cuota de un evento que no está activo.");
  }

  await updateDocImpl(shareRef, {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
};
