import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

/**
 * Permite a un miembro abandonar el Hogar compartido (siempre que no sea el creador/dueño).
 * Remueve al usuario de households.memberIds y establece users/{uid}.activeHouseholdId = null.
 */
export const leaveHousehold = async (householdId: string, uid: string): Promise<void> => {
  if (!householdId) throw new Error("ID de hogar es obligatorio.");
  if (!uid) throw new Error("UID es obligatorio.");

  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    const householdRef = doc(db, "households", householdId);
    const householdSnap = await transaction.get(householdRef);

    if (!householdSnap.exists()) {
      throw new Error("El hogar no existe.");
    }

    const data = householdSnap.data();
    if (data.ownerId === uid) {
      throw new Error("El dueño no puede abandonar el hogar. Debe disolverlo.");
    }

    const memberIds = (data.memberIds || []) as string[];
    if (!memberIds.includes(uid)) {
      throw new Error("No eres miembro de este hogar.");
    }

    const nextMemberIds = memberIds.filter((id) => id !== uid);

    // 1. Remover del hogar
    transaction.update(householdRef, {
      memberIds: nextMemberIds,
    });

    // 2. Desvincular del perfil del usuario
    const userRef = doc(db, "users", uid);
    transaction.update(userRef, {
      activeHouseholdId: null,
      updatedAt: serverTimestamp(),
    });
  });
};
