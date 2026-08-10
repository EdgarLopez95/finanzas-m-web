import { doc, runTransaction, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type GenerateInviteCodeInput = {
  householdId: string;
  uid: string;
};

export type GenerateInviteCodeDeps = {
  getHouseholdDoc?: (householdId: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  commitTransaction?: (params: {
    newCode: string;
    expiresAt: Timestamp;
    oldCode: string | null;
    householdId: string;
  }) => Promise<void>;
};

/**
 * Genera un código aleatorio de 8 caracteres alfanuméricos en mayúsculas,
 * excluyendo caracteres confusos: 0, O, 1, I. Alfabeto canónico Android: ABCDEFGHJKLMNPQRSTUVWXYZ23456789.
 */
export const generateCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const randomValues = new Uint32Array(8);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
};

/**
 * Genera o regenera un código de invitación para un Hogar (HouseholdRepository.kt:284-310):
 * 1. Valida que el usuario sea miembro del hogar.
 * 2. Mantiene la semántica Android: CUALQUIER miembro del hogar puede regenerar el código. NO se bloquea si hay 2 miembros.
 * 3. Si ya existía un código previo (oldCode), se elimina household_invites/{oldCode} de forma atómica.
 * 4. Crea household_invites/{newCode} con vigencia de 7 días exactos.
 * 5. Actualiza households/{householdId} con el nuevo código y su fecha de expiración.
 */
export const generateHouseholdInviteCode = async (
  input: GenerateInviteCodeInput,
  customDeps?: GenerateInviteCodeDeps
): Promise<string> => {
  const { householdId, uid } = input;

  if (!householdId?.trim()) {
    throw new Error("El ID del Hogar es obligatorio.");
  }
  if (!uid?.trim()) {
    throw new Error("El UID de usuario es obligatorio.");
  }

  const db = customDeps ? null : getFirebaseDb();
  let newCode = "";

  if (customDeps?.getHouseholdDoc && customDeps?.commitTransaction) {
    const householdSnap = await customDeps.getHouseholdDoc(householdId);
    if (!householdSnap.exists) {
      throw new Error("El Hogar no existe.");
    }

    const householdData = householdSnap.data() || {};
    const memberIds = (householdData.memberIds as string[]) || [];
    if (!memberIds.includes(uid)) {
      throw new Error("No tienes permisos en este Hogar.");
    }
    if (householdData.status && householdData.status !== "active") {
      throw new Error("El Hogar no está activo.");
    }

    newCode = generateCode();
    const oldCode = householdData.inviteCode ? String(householdData.inviteCode).trim() : null;
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    await customDeps.commitTransaction({
      newCode,
      expiresAt,
      oldCode,
      householdId,
    });

    return newCode;
  }

  await runTransaction(db!, async (transaction) => {
    const householdRef = doc(db!, "households", householdId);
    const householdSnap = await transaction.get(householdRef);

    if (!householdSnap.exists()) {
      throw new Error("El Hogar no existe.");
    }

    const householdData = householdSnap.data();
    const memberIds = (householdData.memberIds as string[]) || [];

    // Validar membresía (Semántica Android: cualquier miembro puede regenerar el código)
    if (!memberIds.includes(uid)) {
      throw new Error("No tienes permisos en este Hogar.");
    }

    if (householdData.status && householdData.status !== "active") {
      throw new Error("El Hogar no está activo.");
    }

    newCode = generateCode();

    const oldCode = householdData.inviteCode ? String(householdData.inviteCode).trim() : null;
    if (oldCode && oldCode !== newCode) {
      const oldInviteRef = doc(db!, "household_invites", oldCode);
      transaction.delete(oldInviteRef);
    }

    const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días exactos
    const expiresAtTimestamp = Timestamp.fromDate(expiresAtDate);

    const newInviteRef = doc(db!, "household_invites", newCode);
    transaction.set(newInviteRef, {
      householdId,
      expiresAt: expiresAtTimestamp,
    });

    transaction.update(householdRef, {
      inviteCode: newCode,
      inviteCodeExpiresAt: expiresAtTimestamp,
    });
  });

  return newCode;
};
