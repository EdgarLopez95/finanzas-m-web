import { doc, runTransaction } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

/**
 * Renombra el hogar compartido.
 * El diff de actualización del hogar solo permite cambiar 'name', 'inviteCode' e 'inviteCodeExpiresAt'
 * de acuerdo a las Firestore Rules, por lo que no se debe incluir 'updatedAt' en el payload.
 */
export const renameHousehold = async (
  householdId: string,
  uid: string,
  name: string
): Promise<void> => {
  if (!householdId) throw new Error("ID de hogar es obligatorio.");
  if (!uid) throw new Error("UID es obligatorio.");
  if (!name.trim()) throw new Error("El nombre no puede estar vacío.");

  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    const householdRef = doc(db, "households", householdId);
    const householdSnap = await transaction.get(householdRef);

    if (!householdSnap.exists()) {
      throw new Error("El hogar no existe.");
    }

    const data = householdSnap.data();
    const memberIds = data.memberIds || [];
    if (!memberIds.includes(uid)) {
      throw new Error("No tienes permisos para renombrar este hogar.");
    }

    if (data.status === "dissolved") {
      throw new Error("No se puede renombrar un hogar disuelto.");
    }

    transaction.update(householdRef, {
      name: name.trim(),
    });
  });
};
