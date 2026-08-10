import { doc, Timestamp, writeBatch, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertValidTransactionAmount } from "@/lib/finance/transaction-validation";
import type { HouseholdCategory } from "@/types/household";

export type CreateHouseholdEventInput = {
  householdId: string;
  createdByUserId: string;
  paidByUserId?: string;
  settlementMode?: "invitation" | "advancedByPayer" | "eachPaysOwn";
  title: string;
  description?: string | null;
  totalAmount: number;
  householdCategoryId: string;
  eventDate: Date;
  memberShares: { memberUserId: string; responsibilityAmount: number }[];
  householdMemberIds: string[];
  availableCategories: HouseholdCategory[];
};

export type HouseholdEventWritePlan = {
  eventId: string;
  eventDoc: {
    path: string;
    data: Record<string, unknown>;
  };
  shareDocs: Array<{
    id: string;
    path: string;
    data: Record<string, unknown>;
  }>;
  debtDocs: Array<{
    id: string;
    path: string;
    data: Record<string, unknown>;
  }>;
};

const defaultGenerateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Genera de forma pura e inmutable el plan de escritura de Firestore para un nuevo evento de Hogar.
 * 
 * Contrato Canónico Android:
 * - Evento se crea en status: "active" con whitelist estricta de campos.
 * - Shares se crean en status: "pending_completion" con IDs deterministas (${eventId}_${memberUserId}).
 * - Deudas (advancedByPayer) usan UUID independiente por deuda (HouseholdEventRepository.kt:968),
 *   manteniendo eventId como campo de relación (Dependencia H1.5).
 */
export const buildHouseholdEventWritePlan = (
  input: CreateHouseholdEventInput,
  generatedEventId: string,
  generateDebtId: () => string = defaultGenerateId
): HouseholdEventWritePlan => {
  const {
    householdId,
    createdByUserId,
    paidByUserId: rawPaidByUserId,
    settlementMode = "advancedByPayer",
    title,
    description,
    totalAmount,
    householdCategoryId,
    eventDate,
    memberShares,
    householdMemberIds,
    availableCategories,
  } = input;

  const paidByUserId = rawPaidByUserId || createdByUserId;

  // 1. Validaciones runtime del settlementMode
  if (!["invitation", "advancedByPayer", "eachPaysOwn"].includes(settlementMode)) {
    throw new Error(`Modo de liquidación '${settlementMode}' no es válido.`);
  }

  // 2. Validaciones obligatorias de ID y pertenencia a miembros
  if (!householdId?.trim()) {
    throw new Error("El ID del hogar es obligatorio.");
  }
  if (!createdByUserId?.trim()) {
    throw new Error("El ID del creador es obligatorio.");
  }
  if (!Array.isArray(householdMemberIds) || householdMemberIds.length === 0) {
    throw new Error("La lista de miembros del hogar es obligatoria.");
  }
  if (!householdMemberIds.includes(createdByUserId)) {
    throw new Error("El creador del evento debe pertenecer al hogar activo.");
  }
  if (!householdMemberIds.includes(paidByUserId)) {
    throw new Error("El pagador debe pertenecer al hogar activo.");
  }

  // 3. Validación de título y monto
  if (!title?.trim()) {
    throw new Error("El título del evento es obligatorio.");
  }
  assertValidTransactionAmount(totalAmount);

  // 4. Validación estricta de categoría del hogar
  if (!householdCategoryId?.trim()) {
    throw new Error("Selecciona una categoría del hogar.");
  }
  if (!Array.isArray(availableCategories)) {
    throw new Error("El catálogo de categorías disponibles es obligatorio.");
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

  // 5. Validación de responsabilidades (shares)
  if (!Array.isArray(memberShares) || memberShares.length === 0) {
    throw new Error("Debe haber al menos una responsabilidad asignada.");
  }

  const seenMembers = new Set<string>();
  for (const share of memberShares) {
    if (seenMembers.has(share.memberUserId)) {
      throw new Error("No puede haber responsabilidades duplicadas para el mismo miembro.");
    }
    seenMembers.add(share.memberUserId);

    if (!householdMemberIds.includes(share.memberUserId)) {
      throw new Error("La responsabilidad asignada debe pertenecer a un miembro del hogar activo.");
    }

    if (!Number.isFinite(share.responsibilityAmount) || share.responsibilityAmount < 0) {
      throw new Error("Cada responsabilidad debe ser un número mayor o igual a cero.");
    }
  }

  if (settlementMode !== "invitation") {
    const sharesSum = memberShares.reduce((s, m) => s + m.responsibilityAmount, 0);
    // Tolerancia canónica Android de ±1 peso por redondeo entero
    if (Math.abs(sharesSum - totalAmount) > 1) {
      throw new Error(`La suma de responsabilidades (${sharesSum}) debe ser igual al monto total (${totalAmount}).`);
    }
  }

  const eventPath = `household_events/${generatedEventId}`;
  const eventData: Record<string, unknown> = {
    householdId,
    createdByUserId,
    paidByUserId,
    settlementMode,
    sourceTransactionId: null,
    householdCategoryId,
    title: title.trim(),
    description: description?.trim() || null,
    eventDate: Timestamp.fromDate(eventDate),
    totalAmount,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const shareDocs: HouseholdEventWritePlan["shareDocs"] = [];

  if (settlementMode === "invitation" || settlementMode === "advancedByPayer") {
    const shareId = `${generatedEventId}_${paidByUserId}`;
    shareDocs.push({
      id: shareId,
      path: `household_event_shares/${shareId}`,
      data: {
        eventId: generatedEventId,
        householdId,
        memberUserId: paidByUserId,
        responsibilityAmount: totalAmount,
        status: "pending_completion",
        completedAt: null,
        completedByTransactionId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  } else if (settlementMode === "eachPaysOwn") {
    for (const share of memberShares) {
      if (share.responsibilityAmount > 0) {
        const shareId = `${generatedEventId}_${share.memberUserId}`;
        shareDocs.push({
          id: shareId,
          path: `household_event_shares/${shareId}`,
          data: {
            eventId: generatedEventId,
            householdId,
            memberUserId: share.memberUserId,
            responsibilityAmount: share.responsibilityAmount,
            status: "pending_completion",
            completedAt: null,
            completedByTransactionId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }
    }
  }

  const debtDocs: HouseholdEventWritePlan["debtDocs"] = [];

  if (settlementMode === "advancedByPayer") {
    for (const share of memberShares) {
      if (share.memberUserId !== paidByUserId && share.responsibilityAmount > 0) {
        const debtId = generateDebtId();
        debtDocs.push({
          id: debtId,
          path: `household_debts/${debtId}`,
          data: {
            householdId,
            eventId: generatedEventId,
            fromUserId: share.memberUserId,
            toUserId: paidByUserId,
            amount: share.responsibilityAmount,
            status: "pending",
            outgoingTransactionId: null,
            incomingTransactionId: null,
            paymentDeclaredAt: null,
            paidAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }
    }
  }

  return {
    eventId: generatedEventId,
    eventDoc: { path: eventPath, data: eventData },
    shareDocs,
    debtDocs,
  };
};

/**
 * Crea un household_event y sus artefactos consumiendo el plan productivo atómico de Firestore.
 */
export const createHouseholdEvent = async (
  input: CreateHouseholdEventInput,
  customBatchRunner?: (plan: HouseholdEventWritePlan) => Promise<void>
): Promise<string> => {
  const generatedId = defaultGenerateId();
  const plan = buildHouseholdEventWritePlan(input, generatedId);

  if (customBatchRunner) {
    await customBatchRunner(plan);
    return plan.eventId;
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Escribir evento
  batch.set(doc(db, "household_events", plan.eventId), plan.eventDoc.data);

  // Escribir shares
  for (const share of plan.shareDocs) {
    batch.set(doc(db, "household_event_shares", share.id), share.data);
  }

  // Escribir deudas
  for (const debt of plan.debtDocs) {
    batch.set(doc(db, "household_debts", debt.id), debt.data);
  }

  await batch.commit();
  return plan.eventId;
};
