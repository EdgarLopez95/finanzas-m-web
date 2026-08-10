import { arrayUnion, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type JoinHouseholdInput = {
  inviteCode: string;
  uid: string;
};

export type JoinHouseholdDeps = {
  getInviteDoc?: (code: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  getHouseholdDoc?: (id: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  commitJoin?: (params: { householdId: string; uid: string; newMemberIds: string[] }) => Promise<void>;
  commitBatchCalls?: Array<{ type: "update" | "set"; ref: string; payload: Record<string, unknown> }>;
};

/**
 * Une a un usuario a un Hogar compartido mediante código de invitación (HouseholdRepository.kt:205-271):
 * 1. Normaliza el código (trim, sin espacios, mayúsculas).
 * 2. GET directo únicamente a household_invites/{code} (las Security Rules permiten lectura pública de invitaciones).
 * 3. NO lee households/{id} ni users/{uid} antes del batch (el invitado no es miembro aún y sería rechazado por las Rules).
 * 4. Aplica writeBatch atómico:
 *    - update(households/{id}, "memberIds", arrayUnion(uid)) [EXCLUSIVAMENTE memberIds, SIN updatedAt]
 *    - set(users/{uid}, { activeHouseholdId: id }, { merge: true })
 * 5. Deja que las Security Rules validen estado activo, capacidad máxima (< 2 miembros) y no-pertenencia previa.
 * 6. Reconciliación idempotente post-PERMISSION_DENIED: relee el hogar (ahora que es miembro) para confirmar si ya quedó registrado. Si sí, asegura activeHouseholdId y retorna éxito idempotente.
 * 7. Errores de red u otros conservan su causa original (nunca se traducen a "hogar disuelto").
 */
export const joinHouseholdByInviteCode = async (
  input: JoinHouseholdInput,
  customDeps?: JoinHouseholdDeps
): Promise<string> => {
  const { inviteCode, uid } = input;

  if (!uid?.trim()) {
    throw new Error("El UID del usuario es obligatorio.");
  }

  const normalizedCode = inviteCode.trim().replace(/\s+/g, "").toUpperCase();

  if (!normalizedCode || normalizedCode.length !== 8) {
    throw new Error("El código de invitación debe tener 8 caracteres.");
  }

  // Costura de dependencias para pruebas instrumentadas sin Firebase real
  if (customDeps?.getInviteDoc && customDeps?.commitJoin) {
    const inviteSnap = await customDeps.getInviteDoc(normalizedCode);
    if (!inviteSnap.exists) {
      throw new Error("No encontramos un hogar con ese código.");
    }

    const inviteData = inviteSnap.data() || {};
    const householdId = (inviteData.householdId as string)?.trim();
    if (!householdId) {
      throw new Error("Código corrupto: falta householdId.");
    }

    const expiresAtRaw = inviteData.expiresAt as { toDate?: () => Date } | Date | number | undefined;
    const expiresAtTime =
      typeof expiresAtRaw === "object" && expiresAtRaw && "toDate" in expiresAtRaw && typeof expiresAtRaw.toDate === "function"
        ? expiresAtRaw.toDate().getTime()
        : expiresAtRaw instanceof Date
        ? expiresAtRaw.getTime()
        : typeof expiresAtRaw === "number"
        ? expiresAtRaw
        : 0;

    if (!expiresAtTime || expiresAtTime <= Date.now()) {
      throw new Error("Este código expiró. Pide uno nuevo.");
    }

    try {
      await customDeps.commitJoin({ householdId, uid, newMemberIds: [uid] });
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code || (err instanceof Error ? err.message : String(err));
      const isPermissionDenied = msg.includes("permission-denied") || msg.includes("No tienes permiso");

      if (isPermissionDenied) {
        if (customDeps.getHouseholdDoc) {
          const recheckHh = await customDeps.getHouseholdDoc(householdId);
          const recheckMembers = (recheckHh?.data()?.memberIds as string[]) || [];
          if (recheckHh.exists && recheckMembers.includes(uid)) {
            return householdId; // Éxito idempotente post-carrera
          }
        }
        throw new Error("Este hogar ya no acepta nuevos miembros (puede estar disuelto o lleno).");
      }
      throw err instanceof Error ? err : new Error((err as { message?: string })?.message || String(err));
    }

    return householdId;
  }

  const db = getFirebaseDb();

  // 1. GET directo al documento de invitación (permitido por las Security Rules)
  const inviteRef = doc(db, "household_invites", normalizedCode);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("No encontramos un hogar con ese código.");
  }

  const inviteData = inviteSnap.data();
  const householdId = inviteData.householdId ? String(inviteData.householdId).trim() : null;
  if (!householdId) {
    throw new Error("Código corrupto: falta householdId.");
  }

  const expiresAt = inviteData.expiresAt;
  if (!expiresAt || expiresAt.toDate().getTime() <= Date.now()) {
    throw new Error("Este código expiró. Pide uno nuevo.");
  }

  // 2. batch update idéntico a Android (HouseholdRepository.kt:222-231):
  // - update(households/{id}, "memberIds", arrayUnion(uid)) [SIN updatedAt]
  // - set(users/{uid}, { activeHouseholdId: id }, { merge: true })
  // Cero lecturas a households/{id} o users/{uid} previas a la escritura batch.
  const batch = writeBatch(db);
  const householdRef = doc(db, "households", householdId);
  const userRef = doc(db, "users", uid);

  batch.update(householdRef, "memberIds", arrayUnion(uid));
  batch.set(userRef, { activeHouseholdId: householdId }, { merge: true });

  try {
    await batch.commit();
  } catch (err: unknown) {
    const msg = (err as { code?: string })?.code || (err instanceof Error ? err.message : String(err));
    const isPermissionDenied = msg.includes("permission-denied") || msg.includes("No tienes permiso");

    if (isPermissionDenied) {
      // Re-confirmación autoritativa idempotente Android (HouseholdRepository.kt:241-263)
      // Ahora que el usuario fue agregado a memberIds, las Rules PERMITEN la relectura.
      try {
        const recheckSnap = await getDoc(doc(db, "households", householdId));
        if (recheckSnap.exists()) {
          const members = (recheckSnap.data()?.memberIds as string[]) || [];
          if (members.includes(uid)) {
            // Asegura activeHouseholdId en documento del usuario si la segunda escritura perdió la carrera
            await setDoc(doc(db, "users", uid), { activeHouseholdId: householdId }, { merge: true }).catch(() => {});
            return householdId;
          }
        }
      } catch (recheckErr) {
        console.warn("Error reconfirmando membresía idempotente post-join:", recheckErr);
      }
      throw new Error("Este hogar ya no acepta nuevos miembros (puede estar disuelto o lleno).");
    }

    throw err instanceof Error ? err : new Error((err as { message?: string })?.message || String(err));
  }

  return householdId;
};
