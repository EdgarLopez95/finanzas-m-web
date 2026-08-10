import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type CreateHouseholdInput = {
  name: string;
  uid: string;
};

/**
 * Crea un nuevo Hogar compartido en una transacción atómica:
 * 1. Lee el perfil del usuario users/{uid} para validar que no tenga ya un hogar activo.
 * 2. Crea el documento households/{householdId}.
 * 3. Actualiza users/{uid}.activeHouseholdId con el nuevo ID.
 */
export const createHousehold = async (input: CreateHouseholdInput): Promise<string> => {
  const { name, uid } = input;

  if (!name.trim()) {
    throw new Error("El nombre del Hogar es obligatorio.");
  }
  if (!uid.trim()) {
    throw new Error("El UID del usuario es obligatorio.");
  }

  const db = getFirebaseDb();
  let newHouseholdId = "";

  await runTransaction(db, async (transaction) => {
    // 1. Leer y validar users/{uid}
    const userRef = doc(db, "users", uid);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
      throw new Error("El perfil de usuario no existe en la base de datos.");
    }

    const userData = userSnap.data();
    if (userData.activeHouseholdId) {
      throw new Error("El usuario ya tiene un Hogar activo asignado.");
    }

    // 2. Generar una referencia para el nuevo hogar
    const householdRef = doc(collection(db, "households"));
    newHouseholdId = householdRef.id;

    // 3. Crear el hogar
    transaction.set(householdRef, {
      name: name.trim(),
      ownerId: uid,
      memberIds: [uid],
      status: "active",
      inviteCode: null,
      inviteCodeExpiresAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Vincular el hogar al usuario
    transaction.update(userRef, {
      activeHouseholdId: newHouseholdId,
      updatedAt: serverTimestamp(),
    });
  });

  return newHouseholdId;
};
