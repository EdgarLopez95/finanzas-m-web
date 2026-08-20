import {
  collection,
  doc,
  getDoc,
  getDocs,
  type Transaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  categoryMappingFromFirestore,
  householdFromFirestore,
  householdInviteFromFirestore,
  householdInviteToFirestore,
  householdMemberFromFirestore,
  householdMemberToFirestore,
  householdToFirestore,
  memberAccountLabelFromFirestore,
  memberCategoryLabelFromFirestore,
  userProfileFromFirestore,
  userProfileToFirestore,
} from "@/lib/mplus/converters";
import {
  newHouseholdInviteCode,
  newMutationId,
  normalizeHouseholdInviteCode,
} from "@/lib/mplus/ids";
import type {
  MplusCategoryMapping,
  MplusHousehold,
  MplusHouseholdInvite,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusUserProfile,
} from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
} from "@/lib/mplus/mutation-runner";
import {
  householdDocPath,
  householdInviteDocPath,
  householdMemberDocPath,
  MPLUS_PATHS,
  userDocPath,
} from "@/lib/mplus/paths";
import {
  HOUSEHOLD_EXPENSE_SEED,
  householdSeedCategoryId,
} from "@/lib/mplus/seeds";

const INVITE_VALIDITY_MILLIS = 7 * 24 * 60 * 60 * 1000;

export const readMplusHousehold = async (
  householdId: string,
): Promise<MplusHousehold | null> => {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, ...householdDocPath(householdId)));
  if (!snap.exists()) return null;
  return householdFromFirestore(snap.id, snap.data());
};

export const readMplusHouseholdMembers = async (
  householdId: string,
): Promise<MplusHouseholdMember[]> => {
  const db = getFirebaseDb();
  const membersRef = collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.members);
  const snap = await getDocs(membersRef);
  return snap.docs.map((d) =>
    householdMemberFromFirestore(`${householdId}__${d.id}`, householdId, d.data()),
  );
};

export const readMplusHouseholdActiveInvite = async (
  inviteId: string | null,
): Promise<MplusHouseholdInvite | null> => {
  if (!inviteId) return null;
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, ...householdInviteDocPath(inviteId)));
  if (!snap.exists()) return null;
  return householdInviteFromFirestore(snap.id, snap.data());
};

export const readMplusCategoryMappings = async (
  householdId: string,
): Promise<MplusCategoryMapping[]> => {
  const db = getFirebaseDb();
  const mappingsRef = collection(
    db,
    MPLUS_PATHS.households,
    householdId,
    MPLUS_PATHS.categoryMappings,
  );
  const snap = await getDocs(mappingsRef);
  return snap.docs.map((d) => categoryMappingFromFirestore(d.id, d.data()));
};

export const readMplusMemberCategoryLabels = async (
  householdId: string,
): Promise<MplusMemberCategoryLabel[]> => {
  const db = getFirebaseDb();
  const labelsRef = collection(
    db,
    MPLUS_PATHS.households,
    householdId,
    MPLUS_PATHS.memberCategoryLabels,
  );
  const snap = await getDocs(labelsRef);
  return snap.docs.map((d) => memberCategoryLabelFromFirestore(d.id, d.data()));
};

export const readMplusMemberAccountLabels = async (
  householdId: string,
): Promise<MplusMemberAccountLabel[]> => {
  const db = getFirebaseDb();
  const labelsRef = collection(
    db,
    MPLUS_PATHS.households,
    householdId,
    MPLUS_PATHS.memberAccountLabels,
  );
  const snap = await getDocs(labelsRef);
  return snap.docs.map((d) => memberAccountLabelFromFirestore(d.id, d.data()));
};

/**
 * Crea un Hogar nuevo en estado `waiting` con invitación de 3 dígitos (contrato §10.2 / DEC-072).
 */
export const createHousehold = async (params: {
  householdId: string;
  name: string;
  creatorUid: string;
  displayName: string;
  photoUrl: string;
  userProfile: MplusUserProfile;
}): Promise<MplusMutationOutcome<{ household: MplusHousehold; inviteCode: string }>> => {
  const { householdId, name, creatorUid, displayName, photoUrl, userProfile } = params;
  const db = getFirebaseDb();
  const inviteCode = newHouseholdInviteCode();
  const mutationId = newMutationId();
  const now = Date.now();

  const householdRef = doc(db, ...householdDocPath(householdId));
  const memberRef = doc(db, ...householdMemberDocPath(householdId, creatorUid));
  const inviteRef = doc(db, ...householdInviteDocPath(inviteCode));
  const userRef = doc(db, ...userDocPath(creatorUid));

  const householdModel: MplusHousehold = {
    id: householdId,
    schemaVersion: 1,
    status: "waiting",
    memberAId: creatorUid,
    memberBId: null,
    activeInviteId: inviteCode,
    catalogVersion: 1,
    cleanupPhase: "none",
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: now,
    updatedAtMillis: now,
    name: name.trim(),
  };

  const memberModel: MplusHouseholdMember = {
    id: `${householdId}__${creatorUid}`,
    schemaVersion: 1,
    householdId,
    userId: creatorUid,
    state: "active",
    displayName: displayName.trim() || "Usuario",
    photoUrl: photoUrl.trim(),
    joinedAtMillis: now,
    leftAtMillis: null,
    revision: 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  const inviteModel: MplusHouseholdInvite = {
    id: inviteCode,
    schemaVersion: 1,
    householdId,
    createdBy: creatorUid,
    state: "active",
    createdAtMillis: now,
    expiresAtMillis: now + INVITE_VALIDITY_MILLIS,
    usedBy: null,
    usedAtMillis: null,
    reservedForUid: null,
    revision: 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  const updatedUserProfile: MplusUserProfile = {
    ...userProfile,
    householdId,
    householdMembershipState: "active",
    revision: userProfile.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<{ household: MplusHousehold; inviteCode: string }>(db, {
    mutationId,
    occ: [
      { resource: "users", id: creatorUid, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      tx.set(householdRef, householdToFirestore(householdModel));
      tx.set(memberRef, householdMemberToFirestore(memberModel));
      tx.set(inviteRef, householdInviteToFirestore(inviteModel));
      tx.update(userRef, userProfileToFirestore(updatedUserProfile));

      // Sembrar categorías de gasto de Hogar v1 (§13.1)
      for (const seed of HOUSEHOLD_EXPENSE_SEED) {
        const catId = householdSeedCategoryId(seed);
        const catRef = doc(
          db,
          MPLUS_PATHS.households,
          householdId,
          MPLUS_PATHS.expenseCategories,
          catId,
        );
        tx.set(catRef, {
          schemaVersion: 1,
          householdId,
          type: "expense",
          name: seed.name,
          iconKey: seed.iconKey,
          color: seed.color,
          state: "active",
          seedKey: seed.seedKey,
          sortOrder: seed.sortOrder,
          createdBy: creatorUid,
          revision: 1,
          lastMutationId: mutationId,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
      }

      return { household: householdModel, inviteCode };
    },
  });
};

/**
 * Unirse a un Hogar con código de 3 dígitos (contrato §12.3 / DEC-076).
 * Soporta primer ingreso (join abierto) y reingreso reservado (`reservedForUid`).
 */
export const joinHousehold = async (params: {
  rawInviteCode: string;
  joinerUid: string;
  displayName: string;
  photoUrl: string;
}): Promise<MplusMutationOutcome<{ householdId: string }>> => {
  const { rawInviteCode, joinerUid, displayName, photoUrl } = params;
  const inviteCode = normalizeHouseholdInviteCode(rawInviteCode);
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();

  const inviteRef = doc(db, ...householdInviteDocPath(inviteCode));
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) {
    return {
      kind: "rejected",
      code: "not-found",
      message: "No encontramos ninguna invitación activa con este código.",
    };
  }

  const invite = householdInviteFromFirestore(inviteSnap.id, inviteSnap.data());
  if (invite.state !== "active") {
    return {
      kind: "rejected",
      code: "invalid-state",
      message: "Este código de invitación ya no está activo o fue utilizado.",
    };
  }
  if (now >= invite.expiresAtMillis) {
    return {
      kind: "rejected",
      code: "expired",
      message: "Este código de invitación ha vencido (plazo de 7 días).",
    };
  }

  // DEC-076: Si la invitación tiene reserva, solo ese UID exacto puede consumirla.
  if (invite.reservedForUid !== null && invite.reservedForUid !== joinerUid) {
    return {
      kind: "rejected",
      code: "permission-denied",
      message: "Este código de reingreso está reservado para la cuenta original de esa plaza.",
    };
  }

  const householdId = invite.householdId;
  const householdRef = doc(db, ...householdDocPath(householdId));
  const householdSnap = await getDoc(householdRef);
  if (!householdSnap.exists()) {
    return {
      kind: "rejected",
      code: "not-found",
      message: "El hogar vinculado a esta invitación no existe.",
    };
  }
  const household = householdFromFirestore(householdSnap.id, householdSnap.data());

  const userRef = doc(db, ...userDocPath(joinerUid));
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return {
      kind: "rejected",
      code: "not-found",
      message: "Perfil de usuario no encontrado.",
    };
  }
  const userProfile = userProfileFromFirestore(userSnap.id, userSnap.data());
  if (userProfile.householdMembershipState !== "none" && userProfile.householdId !== null) {
    return {
      kind: "rejected",
      code: "already-in-household",
      message: "Ya eres miembro de un hogar activo. Debes salirte antes de unirte a otro.",
    };
  }

  const memberRef = doc(db, ...householdMemberDocPath(householdId, joinerUid));
  const memberSnap = await getDoc(memberRef);
  const existingMember = memberSnap.exists()
    ? householdMemberFromFirestore(`${householdId}__${joinerUid}`, householdId, memberSnap.data())
    : null;

  const isReentry = invite.reservedForUid === joinerUid;

  return runMplusMutation<{ householdId: string }>(db, {
    mutationId,
    occ: [
      { resource: "householdInvites", id: inviteCode, ref: inviteRef, baseRevision: invite.revision },
      { resource: "households", id: householdId, ref: householdRef, baseRevision: household.revision },
      { resource: "users", id: joinerUid, ref: userRef, baseRevision: userProfile.revision },
      ...(existingMember
        ? [{ resource: "members", id: `${householdId}__${joinerUid}`, ref: memberRef, baseRevision: existingMember.revision }]
        : []),
    ],
    work: (tx: Transaction) => {
      // 1. Actualizar invitación
      const updatedInvite: MplusHouseholdInvite = {
        ...invite,
        state: "used",
        usedBy: joinerUid,
        usedAtMillis: now,
        revision: invite.revision + 1,
        lastMutationId: mutationId,
        updatedAtMillis: now,
      };
      tx.update(inviteRef, householdInviteToFirestore(updatedInvite));

      // 2. Actualizar Hogar
      const updatedHousehold: MplusHousehold = isReentry
        ? {
            ...household,
            activeInviteId: null,
            revision: household.revision + 1,
            lastMutationId: mutationId,
            updatedAtMillis: now,
          }
        : {
            ...household,
            memberBId: joinerUid,
            status: "active",
            activeInviteId: null,
            revision: household.revision + 1,
            lastMutationId: mutationId,
            updatedAtMillis: now,
          };
      tx.update(householdRef, householdToFirestore(updatedHousehold));

      // 3. Crear o reactivar miembro
      const memberModel: MplusHouseholdMember = existingMember
        ? {
            ...existingMember,
            state: "active",
            leftAtMillis: null,
            displayName: displayName.trim() || existingMember.displayName,
            photoUrl: photoUrl.trim() || existingMember.photoUrl,
            revision: existingMember.revision + 1,
            lastMutationId: mutationId,
            updatedAtMillis: now,
          }
        : {
            id: `${householdId}__${joinerUid}`,
            schemaVersion: 1,
            householdId,
            userId: joinerUid,
            state: "active",
            displayName: displayName.trim() || "Usuario",
            photoUrl: photoUrl.trim(),
            joinedAtMillis: now,
            leftAtMillis: null,
            revision: 1,
            lastMutationId: mutationId,
            updatedAtMillis: now,
          };

      if (existingMember) {
        tx.update(memberRef, householdMemberToFirestore(memberModel));
      } else {
        tx.set(memberRef, householdMemberToFirestore(memberModel));
      }

      // 4. Actualizar usuario
      const updatedUser: MplusUserProfile = {
        ...userProfile,
        householdId,
        householdMembershipState: "active",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAtMillis: now,
      };
      tx.update(userRef, userProfileToFirestore(updatedUser));

      return { householdId };
    },
  });
};

/**
 * Cancela un Hogar en espera con un solo miembro (DEC-068 / contrato §10.2).
 */
export const cancelWaitingHousehold = async (params: {
  householdId: string;
  creatorUid: string;
  userProfile: MplusUserProfile;
  household: MplusHousehold;
}): Promise<MplusMutationOutcome<void>> => {
  const { householdId, creatorUid, userProfile, household } = params;
  if (household.status !== "waiting" || household.memberBId !== null || household.memberAId !== creatorUid) {
    return {
      kind: "rejected",
      code: "invalid-state",
      message: "Solo un hogar en espera con un único miembro puede cancelarse.",
    };
  }

  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();

  const householdRef = doc(db, ...householdDocPath(householdId));
  const memberRef = doc(db, ...householdMemberDocPath(householdId, creatorUid));
  const userRef = doc(db, ...userDocPath(creatorUid));

  // Obtener categorías de gasto sembradas para borrarlas
  const catsSnap = await getDocs(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.expenseCategories),
  );

  return runMplusMutation<void>(db, {
    mutationId,
    occ: [
      { resource: "households", id: householdId, ref: householdRef, baseRevision: household.revision },
      { resource: "users", id: creatorUid, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      // 1. Borrar invitación activa
      if (household.activeInviteId) {
        const inviteRef = doc(db, ...householdInviteDocPath(household.activeInviteId));
        tx.delete(inviteRef);
      }
      // 2. Borrar categorías de gasto
      for (const catDoc of catsSnap.docs) {
        tx.delete(catDoc.ref);
      }
      // 3. Borrar miembro
      tx.delete(memberRef);
      // 4. Borrar Hogar
      tx.delete(householdRef);
      // 5. Resetear usuario a `none`
      const updatedUser: MplusUserProfile = {
        ...userProfile,
        householdId: null,
        householdMembershipState: "none",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAtMillis: now,
      };
      tx.update(userRef, userProfileToFirestore(updatedUser));
    },
  });
};

/**
 * Regenera el código de invitación (DEC-072 / DEC-076).
 */
export const regenerateHouseholdInvite = async (params: {
  household: MplusHousehold;
  currentUid: string;
  reservedForUid?: string | null;
}): Promise<MplusMutationOutcome<{ inviteCode: string }>> => {
  const { household, currentUid, reservedForUid = null } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();
  const newCode = newHouseholdInviteCode();

  const householdRef = doc(db, ...householdDocPath(household.id));
  const nextInviteRef = doc(db, ...householdInviteDocPath(newCode));

  const previousInviteRef = household.activeInviteId
    ? doc(db, ...householdInviteDocPath(household.activeInviteId))
    : null;

  const newInviteModel: MplusHouseholdInvite = {
    id: newCode,
    schemaVersion: 1,
    householdId: household.id,
    createdBy: currentUid,
    state: "active",
    createdAtMillis: now,
    expiresAtMillis: now + INVITE_VALIDITY_MILLIS,
    usedBy: null,
    usedAtMillis: null,
    reservedForUid,
    revision: 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<{ inviteCode: string }>(db, {
    mutationId,
    occ: [
      { resource: "households", id: household.id, ref: householdRef, baseRevision: household.revision },
    ],
    work: (tx: Transaction) => {
      if (previousInviteRef) {
        tx.update(previousInviteRef, {
          state: "revoked",
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
      }
      tx.set(nextInviteRef, householdInviteToFirestore(newInviteModel));
      tx.update(householdRef, {
        activeInviteId: newCode,
        revision: household.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
      return { inviteCode: newCode };
    },
  });
};

/**
 * Renombrar Hogar con OCC (DEC-074 / spec §13.11).
 */
export const renameHousehold = async (params: {
  householdId: string;
  newName: string;
  expectedRevision: number;
}): Promise<MplusMutationOutcome<void>> => {
  const { householdId, newName, expectedRevision } = params;
  const trimmed = newName.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    return {
      kind: "rejected",
      code: "invalid-name",
      message: "El nombre del hogar debe tener entre 1 y 50 caracteres.",
    };
  }

  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();
  const householdRef = doc(db, ...householdDocPath(householdId));

  return runMplusMutation<void>(db, {
    mutationId,
    occ: [
      { resource: "households", id: householdId, ref: householdRef, baseRevision: expectedRevision },
    ],
    work: (tx: Transaction) => {
      tx.update(householdRef, {
        name: trimmed,
        revision: expectedRevision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
    },
  });
};

/**
 * Salir (Pausa) del Hogar (DEC-075 / spec §13.4).
 * Membresía pasa a `left`, usuario conserva `householdId` en su perfil, Hogar pasa a `waiting_return`.
 */
export const leaveHouseholdPause = async (params: {
  household: MplusHousehold;
  member: MplusHouseholdMember;
  userProfile: MplusUserProfile;
}): Promise<MplusMutationOutcome<void>> => {
  const { household, member, userProfile } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();

  const householdRef = doc(db, ...householdDocPath(household.id));
  const memberRef = doc(db, ...householdMemberDocPath(household.id, member.userId));
  const userRef = doc(db, ...userDocPath(member.userId));

  return runMplusMutation<void>(db, {
    mutationId,
    occ: [
      { resource: "households", id: household.id, ref: householdRef, baseRevision: household.revision },
      { resource: "members", id: member.id, ref: memberRef, baseRevision: member.revision },
      { resource: "users", id: member.userId, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      tx.update(memberRef, {
        state: "left",
        leftAt: new Date(now),
        revision: member.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
      tx.update(householdRef, {
        status: "waiting_return",
        revision: household.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
      tx.update(userRef, {
        householdMembershipState: "left",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
    },
  });
};

/**
 * Regresar al Hogar desde Pausa (DEC-075 / spec §13.5).
 */
export const returnToHousehold = async (params: {
  household: MplusHousehold;
  member: MplusHouseholdMember;
  otherMember: MplusHouseholdMember | null;
  userProfile: MplusUserProfile;
}): Promise<MplusMutationOutcome<void>> => {
  const { household, member, otherMember, userProfile } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();

  const householdRef = doc(db, ...householdDocPath(household.id));
  const memberRef = doc(db, ...householdMemberDocPath(household.id, member.userId));
  const userRef = doc(db, ...userDocPath(member.userId));

  const shouldBecomeActive = otherMember !== null && otherMember.state === "active";

  return runMplusMutation<void>(db, {
    mutationId,
    occ: [
      { resource: "households", id: household.id, ref: householdRef, baseRevision: household.revision },
      { resource: "members", id: member.id, ref: memberRef, baseRevision: member.revision },
      { resource: "users", id: member.userId, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      tx.update(memberRef, {
        state: "active",
        leftAt: null,
        revision: member.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
      if (shouldBecomeActive) {
        tx.update(householdRef, {
          status: "active",
          revision: household.revision + 1,
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
      }
      tx.update(userRef, {
        householdMembershipState: "active",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
    },
  });
};

/**
 * Salirme del todo (DEC-075, DEC-076, DEC-077).
 * El perfil queda `none` y `householdId = null`.
 * Si el otro miembro sigue en el Hogar, se genera un código de reingreso reservado (`reservedForUid = uid`).
 * Si ambos quedaron desvinculados, el Hogar se limpia y borra (DEC-077).
 */
export const leaveHouseholdPermanently = async (params: {
  household: MplusHousehold;
  member: MplusHouseholdMember;
  otherMember: MplusHouseholdMember | null;
  otherUserProfile: MplusUserProfile | null;
  userProfile: MplusUserProfile;
}): Promise<MplusMutationOutcome<void>> => {
  const { household, member, otherMember, otherUserProfile, userProfile } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();

  const householdRef = doc(db, ...householdDocPath(household.id));
  const memberRef = doc(db, ...householdMemberDocPath(household.id, member.userId));
  const userRef = doc(db, ...userDocPath(member.userId));

  const otherIsDetached =
    otherMember === null ||
    (otherUserProfile !== null &&
      otherUserProfile.householdMembershipState === "none" &&
      otherUserProfile.householdId === null);

  if (otherIsDetached) {
    // DEC-077: Ambas plazas quedan desvinculadas -> Borrado/Cierre de Hogar
    return runMplusMutation<void>(db, {
      mutationId,
      occ: [
        { resource: "households", id: household.id, ref: householdRef, baseRevision: household.revision },
        { resource: "members", id: member.id, ref: memberRef, baseRevision: member.revision },
        { resource: "users", id: member.userId, ref: userRef, baseRevision: userProfile.revision },
      ],
      work: (tx: Transaction) => {
        // En un solo miembro final saliendo, limpiamos el documento del Hogar
        tx.update(memberRef, {
          state: "left",
          leftAt: new Date(now),
          revision: member.revision + 1,
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
        tx.update(householdRef, {
          status: "closing",
          cleanupPhase: "detach_movements",
          revision: household.revision + 1,
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
        tx.update(userRef, {
          householdId: null,
          householdMembershipState: "none",
          revision: userProfile.revision + 1,
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
      },
    });
  }

  // El otro miembro sigue en el Hogar -> Emitir código de reingreso reservado (DEC-076)
  const reservedInviteCode = newHouseholdInviteCode();
  const nextInviteRef = doc(db, ...householdInviteDocPath(reservedInviteCode));
  const previousInviteRef = household.activeInviteId
    ? doc(db, ...householdInviteDocPath(household.activeInviteId))
    : null;

  const reservedInviteModel: MplusHouseholdInvite = {
    id: reservedInviteCode,
    schemaVersion: 1,
    householdId: household.id,
    createdBy: otherMember?.userId ?? household.memberAId,
    state: "active",
    createdAtMillis: now,
    expiresAtMillis: now + INVITE_VALIDITY_MILLIS,
    usedBy: null,
    usedAtMillis: null,
    reservedForUid: member.userId,
    revision: 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<void>(db, {
    mutationId,
    occ: [
      { resource: "households", id: household.id, ref: householdRef, baseRevision: household.revision },
      { resource: "members", id: member.id, ref: memberRef, baseRevision: member.revision },
      { resource: "users", id: member.userId, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      tx.update(memberRef, {
        state: "left",
        leftAt: new Date(now),
        revision: member.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });

      if (previousInviteRef) {
        tx.update(previousInviteRef, {
          state: "revoked",
          lastMutationId: mutationId,
          updatedAt: new Date(now),
        });
      }

      tx.set(nextInviteRef, householdInviteToFirestore(reservedInviteModel));

      tx.update(householdRef, {
        activeInviteId: reservedInviteCode,
        revision: household.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });

      tx.update(userRef, {
        householdId: null,
        householdMembershipState: "none",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAt: new Date(now),
      });
    },
  });
};
