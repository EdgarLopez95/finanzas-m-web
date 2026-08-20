import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import {
  personalCategoryToFirestore,
  userProfileFromFirestore,
  userProfileToFirestore,
} from "@/lib/mplus/converters";
import { newMutationId } from "@/lib/mplus/ids";
import type { MplusUserProfile } from "@/lib/mplus/models";
import {
  categoryDocPath,
  householdDocPath,
  MPLUS_PATHS,
  userDocPath,
} from "@/lib/mplus/paths";
import { PERSONAL_SEED } from "@/lib/mplus/seeds";
import { buildSeedCategory } from "@/lib/mplus/user-bootstrap";

export class MplusAccountResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MplusAccountResetError";
  }
}

export type MplusAccountResetResult = {
  success: boolean;
  deletedMovementsCount: number;
  deletedAccountsCount: number;
  deletedCategoriesCount: number;
  deletedHouseholdId: string | null;
  recreatedSeedCategoriesCount: number;
};

/**
 * Servicio de Reinicio Profundo de Cuenta M+ (DEC-080 / Contrato §20).
 *
 * Flujo reanudable y exhaustivo:
 * 1. Pone al usuario en `status = "resetting"`.
 * 2. Si el usuario pertenece a un Hogar, se elimina el Hogar por completo
 *    (documento, subcolecciones, invitaciones, movimientos compartidos de AMBOS miembros)
 *    y se desvincula al compañero (`status = "none"`).
 * 3. Borra todos los movimientos personales propios (activos y Papelera).
 * 4. Borra todas las cuentas del usuario.
 * 5. Borra todas las categorías del usuario.
 * 6. Siembra el catálogo Personal v1 (22 categorías).
 * 7. Pasa `users/{uid}` a `status = "ready"` y `householdId = null`.
 */
export async function executeMplusAccountReset(
  db: Firestore,
  uid: string,
): Promise<MplusAccountResetResult> {
  if (!uid) {
    throw new MplusAccountResetError("UID no válido para reinicio de cuenta.");
  }

  const userDocRef = doc(db, ...userDocPath(uid));
  const userSnap = await getDoc(userDocRef);

  if (!userSnap.exists()) {
    throw new MplusAccountResetError("El usuario a reiniciar no existe en Firestore.");
  }

  const userProfile = userProfileFromFirestore(uid, userSnap.data() as never);
  const now = Date.now();
  let currentRevision = userProfile.revision;

  // Paso 1: Poner el usuario en resetting
  const resettingProfile: MplusUserProfile = {
    ...userProfile,
    status: "resetting",
    resetRequestedAtMillis: now,
    revision: currentRevision + 1,
    lastMutationId: newMutationId(),
    updatedAtMillis: now,
  };
  currentRevision = resettingProfile.revision;

  const startBatch = writeBatch(db);
  startBatch.set(userDocRef, userProfileToFirestore(resettingProfile));
  await startBatch.commit();

  let deletedMovementsCount = 0;
  let deletedAccountsCount = 0;
  let deletedCategoriesCount = 0;
  let deletedHouseholdId: string | null = null;

  // Paso 2: Si tiene Hogar, borrado destructivo del Hogar (DEC-080)
  const householdId = userProfile.householdId;
  if (householdId) {
    deletedHouseholdId = householdId;
    const householdRef = doc(db, ...householdDocPath(householdId));
    const householdSnap = await getDoc(householdRef);

    if (householdSnap.exists()) {
      const hhData = householdSnap.data();
      const memberAId = hhData?.memberAId as string | undefined;
      const memberBId = hhData?.memberBId as string | undefined;
      const otherUid = memberAId === uid ? memberBId : memberAId;

      // Borrar subcolecciones del hogar
      const subcollectionNames = [
        MPLUS_PATHS.members,
        MPLUS_PATHS.expenseCategories,
        MPLUS_PATHS.categoryMappings,
        MPLUS_PATHS.memberCategoryLabels,
        MPLUS_PATHS.memberAccountLabels,
        MPLUS_PATHS.closureApprovals,
      ];

      for (const subName of subcollectionNames) {
        const subSnap = await getDocs(
          collection(db, ...householdDocPath(householdId), subName),
        );
        if (!subSnap.empty) {
          const subBatch = writeBatch(db);
          for (const docSnap of subSnap.docs) {
            subBatch.delete(docSnap.ref);
          }
          await subBatch.commit();
        }
      }

      // Borrar invitaciones del hogar
      const invitesQuery = query(
        collection(db, MPLUS_PATHS.householdInvites),
        where("householdId", "==", householdId),
      );
      const invitesSnap = await getDocs(invitesQuery);
      if (!invitesSnap.empty) {
        const inviteBatch = writeBatch(db);
        for (const docSnap of invitesSnap.docs) {
          inviteBatch.delete(docSnap.ref);
        }
        await inviteBatch.commit();
      }

      // Borrar todos los movimientos compartidos de AMBOS miembros
      const sharedMovementsQuery = query(
        collection(db, MPLUS_PATHS.movements),
        where("householdId", "==", householdId),
      );
      const sharedMovementsSnap = await getDocs(sharedMovementsQuery);
      if (!sharedMovementsSnap.empty) {
        const sharedBatch = writeBatch(db);
        for (const docSnap of sharedMovementsSnap.docs) {
          sharedBatch.delete(docSnap.ref);
          deletedMovementsCount += 1;
        }
        await sharedBatch.commit();
      }

      // Desvincular al otro miembro si existe
      if (otherUid) {
        const otherUserRef = doc(db, ...userDocPath(otherUid));
        const otherUserSnap = await getDoc(otherUserRef);
        if (otherUserSnap.exists()) {
          const otherProfile = userProfileFromFirestore(
            otherUid,
            otherUserSnap.data() as never,
          );
          const updatedOther: MplusUserProfile = {
            ...otherProfile,
            householdId: null,
            householdMembershipState: "none",
            revision: otherProfile.revision + 1,
            lastMutationId: newMutationId(),
            updatedAtMillis: Date.now(),
          };
          const otherBatch = writeBatch(db);
          otherBatch.set(otherUserRef, userProfileToFirestore(updatedOther));
          await otherBatch.commit();
        }
      }

      // Borrar el documento del hogar
      const deleteHhBatch = writeBatch(db);
      deleteHhBatch.delete(householdRef);
      await deleteHhBatch.commit();
    }
  }

  // Paso 3: Borrar todos los movimientos personales propios (activos y Papelera)
  const userMovementsQuery = query(
    collection(db, MPLUS_PATHS.movements),
    where("ownerId", "==", uid),
  );
  const userMovementsSnap = await getDocs(userMovementsQuery);
  if (!userMovementsSnap.empty) {
    const movBatch = writeBatch(db);
    for (const docSnap of userMovementsSnap.docs) {
      movBatch.delete(docSnap.ref);
      deletedMovementsCount += 1;
    }
    await movBatch.commit();
  }

  // Paso 4: Borrar cuentas del usuario
  const accountsSnap = await getDocs(
    collection(db, ...userDocPath(uid), MPLUS_PATHS.accounts),
  );
  if (!accountsSnap.empty) {
    const accBatch = writeBatch(db);
    for (const docSnap of accountsSnap.docs) {
      accBatch.delete(docSnap.ref);
      deletedAccountsCount += 1;
    }
    await accBatch.commit();
  }

  // Paso 5: Borrar categorías del usuario
  const categoriesSnap = await getDocs(
    collection(db, ...userDocPath(uid), MPLUS_PATHS.categories),
  );
  if (!categoriesSnap.empty) {
    const catBatch = writeBatch(db);
    for (const docSnap of categoriesSnap.docs) {
      catBatch.delete(docSnap.ref);
      deletedCategoriesCount += 1;
    }
    await catBatch.commit();
  }

  // Paso 6: Sembrar catálogo Personal v1 (22 categorías)
  const seedBatch = writeBatch(db);
  const seedNow = Date.now();
  const seedMutationId = newMutationId();

  for (const seed of PERSONAL_SEED) {
    const cat = buildSeedCategory(uid, seed, seedNow, seedMutationId);
    const catRef = doc(db, ...categoryDocPath(uid, cat.id));
    seedBatch.set(catRef, personalCategoryToFirestore(cat));
  }
  await seedBatch.commit();

  // Paso 7: Restaurar el usuario a ready
  const finalNow = Date.now();
  const readyProfile: MplusUserProfile = {
    ...resettingProfile,
    status: "ready",
    householdId: null,
    householdMembershipState: "none",
    resetRequestedAtMillis: null,
    personalCatalogVersion: 1,
    revision: currentRevision + 1,
    lastMutationId: newMutationId(),
    updatedAtMillis: finalNow,
  };

  const finalBatch = writeBatch(db);
  finalBatch.set(userDocRef, userProfileToFirestore(readyProfile));
  await finalBatch.commit();

  return {
    success: true,
    deletedMovementsCount,
    deletedAccountsCount,
    deletedCategoriesCount,
    deletedHouseholdId,
    recreatedSeedCategoriesCount: PERSONAL_SEED.length,
  };
}
