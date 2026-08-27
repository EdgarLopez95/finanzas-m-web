import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import { readIdentityClaims } from "@/features/auth/auth-service";
import { mplusValidators } from "@/lib/mplus/schemas";
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

const INVITE_VALIDITY_MILLIS = 7 * 24 * 60 * 60 * 1000;

export type MplusGuardRejection = Readonly<{ code: string; message: string }>;

/**
 * Motivos por los que unirse con codigo va a ser rechazado POR EL SERVIDOR.
 *
 * Cada rama replica una condicion literal de `firestore.rules`. No se comprueban
 * aqui por comodidad: sin ellas, cada una de estas situaciones llega al usuario
 * como `Missing or insufficient permissions`, que no dice absolutamente nada
 * sobre que hacer a continuacion.
 */
export const resolveJoinRejection = (input: {
  invite: Pick<MplusHouseholdInvite, "state" | "expiresAtMillis" | "reservedForUid">;
  household: Pick<MplusHousehold, "status" | "memberAId" | "memberBId"> | null;
  membershipState: MplusUserProfile["householdMembershipState"] | null;
  joinerUid: string;
  nowMillis: number;
}): MplusGuardRejection | null => {
  const { invite, household, membershipState, joinerUid, nowMillis } = input;

  if (invite.state !== "active") {
    return {
      code: "invalid-state",
      message: "Este código de invitación ya no está activo o fue utilizado.",
    };
  }
  if (nowMillis >= invite.expiresAtMillis) {
    return {
      code: "expired",
      message: "Este código de invitación ha vencido (plazo de 7 días).",
    };
  }
  // DEC-076: un codigo de reingreso solo lo consume su UID reservado.
  if (invite.reservedForUid !== null && invite.reservedForUid !== joinerUid) {
    return {
      code: "permission-denied",
      message: "Este código de reingreso está reservado para la cuenta original de esa plaza.",
    };
  }
  if (household === null) {
    return { code: "not-found", message: "El hogar vinculado a esta invitación no existe." };
  }

  const isOpenJoin = invite.reservedForUid === null;

  // `validInviteConsumptionHouseholdUpdate`: `request.auth.uid != resource.data.memberAId`.
  if (isOpenJoin && household.memberAId === joinerUid) {
    return {
      code: "self-join",
      message: "Este es tu propio código: compártelo con la otra persona para que se una.",
    };
  }

  // Primer ingreso: `resource.data.status == 'waiting' && resource.data.memberBId == null`.
  if (isOpenJoin && (household.status !== "waiting" || household.memberBId !== null)) {
    return {
      code: "household-full",
      message: "Este hogar ya tiene dos integrantes. Un hogar no admite más de dos personas.",
    };
  }

  // Las Rules miran SOLO la membresia: `householdMembershipState == 'none'`.
  if (membershipState !== null && membershipState !== "none") {
    return {
      code: "already-in-household",
      message:
        membershipState === "left"
          ? "Tu cuenta sigue vinculada a un hogar en pausa. Regresa a ese hogar o sal del todo antes de unirte a otro."
          : "Ya eres miembro de un hogar activo. Debes salirte antes de unirte a otro.",
    };
  }

  return null;
};

/**
 * Motivos por los que renombrar va a ser rechazado POR EL SERVIDOR
 * (`validHouseholdRename` y `validHouseholdUpdateShape`).
 */
export const resolveRenameRejection = (input: {
  currentName: string | null;
  newName: string;
}): MplusGuardRejection | null => {
  const trimmed = input.newName.trim();

  if (trimmed.length < 1 || trimmed.length > 50) {
    return {
      code: "invalid-name",
      message: "El nombre del hogar debe tener entre 1 y 50 caracteres.",
    };
  }

  // `validHouseholdRename` exige `data.name != resource.data.name`: guardar el
  // mismo nombre no es un no-op, el servidor lo RECHAZA.
  if (input.currentName === trimmed) {
    return {
      code: "unchanged-name",
      message: "Ese ya es el nombre del hogar. Escribe uno distinto para cambiarlo.",
    };
  }

  // `validHouseholdUpdateShape` bifurca segun el documento TENGA o no `name`:
  // si no lo tiene (Hogar heredado), valida contra `validLegacyHouseholdShape`,
  // cuyo `hasOnly` no incluye `name` — anadirlo es rechazado. El cliente no
  // puede sortearlo; se dice claro en vez de dejar un error opaco.
  if (input.currentName === null) {
    return {
      code: "legacy-household",
      message:
        "Este hogar se creó sin nombre y las reglas del servidor no permiten añadirle uno. Debe resolverse desde el contrato compartido.",
    };
  }

  return null;
};

/**
 * Identidad que se escribe en la membresia, alineada con lo que las Rules
 * comparan (`identityMatchesClaims`).
 *
 * Los valores que llegan de la UI son solo el respaldo para cuando el token no
 * trae el claim: en ese caso la regla no lo exige y basta con algo valido de
 * forma. Si el claim SI viene, manda el claim — es literalmente el valor con el
 * que el servidor va a comparar.
 */
const resolveMemberIdentity = async (fallback: {
  displayName: string;
  photoUrl: string;
}): Promise<{ displayName: string; photoUrl: string }> => {
  const claims = await readIdentityClaims();
  return {
    displayName: claims.name ?? (fallback.displayName.trim() || "Usuario"),
    photoUrl: claims.picture ?? fallback.photoUrl.trim(),
  };
};

export const readMplusHousehold = async (
  householdId: string,
): Promise<MplusHousehold | null> => {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, ...householdDocPath(householdId)));
  if (!snap.exists()) return null;
  return householdFromFirestore(snap.id, snap.data());
};

/**
 * Suscripción en tiempo real al documento del Hogar (`households/{householdId}`).
 * Emite inmediatamente y ante cambios de estado (ej: pareja entra/sale/regresa),
 * nombre o nueva invitación activa.
 */
export const subscribeMplusHousehold = (
  householdId: string,
  onUpdate: (household: MplusHousehold | null) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    doc(db, ...householdDocPath(householdId)),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(householdFromFirestore(snap.id, snap.data()));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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

/**
 * Suscripción en tiempo real a los integrantes del Hogar (`households/{householdId}/members`).
 */
export const subscribeMplusHouseholdMembers = (
  householdId: string,
  onUpdate: (members: MplusHouseholdMember[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.members),
    (snap) => {
      const members = snap.docs.map((d) =>
        householdMemberFromFirestore(`${householdId}__${d.id}`, householdId, d.data()),
      );
      onUpdate(members);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
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

/**
 * Suscripción en tiempo real a la invitación activa del Hogar (`household_invites/{inviteId}`).
 */
export const subscribeMplusHouseholdActiveInvite = (
  inviteId: string,
  onUpdate: (invite: MplusHouseholdInvite | null) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    doc(db, ...householdInviteDocPath(inviteId)),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(householdInviteFromFirestore(snap.id, snap.data()));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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

/**
 * Suscripción en tiempo real a los mapeos de categorías del Hogar (`households/{householdId}/categoryMappings`).
 */
export const subscribeMplusCategoryMappings = (
  householdId: string,
  onUpdate: (mappings: MplusCategoryMapping[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.categoryMappings),
    (snap) => {
      const mappings = snap.docs.map((d) => categoryMappingFromFirestore(d.id, d.data()));
      onUpdate(mappings);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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

/**
 * Suscripción en tiempo real a las etiquetas de categorías de miembros (`households/{householdId}/memberCategoryLabels`).
 */
export const subscribeMplusMemberCategoryLabels = (
  householdId: string,
  onUpdate: (labels: MplusMemberCategoryLabel[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.memberCategoryLabels),
    (snap) => {
      const labels = snap.docs.map((d) => memberCategoryLabelFromFirestore(d.id, d.data()));
      onUpdate(labels);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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
 * Suscripción en tiempo real a las etiquetas de cuentas de miembros (`households/{householdId}/memberAccountLabels`).
 */
export const subscribeMplusMemberAccountLabels = (
  householdId: string,
  onUpdate: (labels: MplusMemberAccountLabel[]) => void,
  onError?: (error: Error) => void,
  db: Firestore = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.memberAccountLabels),
    (snap) => {
      const labels = snap.docs.map((d) => memberAccountLabelFromFirestore(d.id, d.data()));
      onUpdate(labels);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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
  const identity = await resolveMemberIdentity({ displayName, photoUrl });
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
    displayName: identity.displayName,
    photoUrl: identity.photoUrl,
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

  // Preflight local. Las Rules rechazan una forma invalida con un
  // `Missing or insufficient permissions` que no dice QUE campo esta mal;
  // los validadores del contrato si lo dicen, y ademas no gastan un viaje.
  try {
    mplusValidators.household(householdModel);
    mplusValidators.householdMember(memberModel);
    mplusValidators.householdInvite(inviteModel);
    mplusValidators.user(updatedUserProfile);
  } catch (error) {
    return {
      kind: "rejected",
      code: "contract-validation",
      message: error instanceof Error ? error.message : String(error),
    };
  }

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

      // NO se siembran aquí las categorías de gasto del Hogar.
      //
      // `firestore.rules` (expenseCategories, línea 1155) exige DOS cosas que
      // este mismo batch todavía no puede cumplir:
      //
      //   allow create: if currentUserIsActiveMember(householdId) &&
      //     get(householdPath(householdId)).data.status == 'active' && ...
      //
      // El Hogar nace `waiting`, no `active`; y `currentUserIsActiveMember`
      // resuelve con `get()`, que lee el estado ANTERIOR al batch, cuando la
      // membresía aún no existe. Sembrar aquí hacía que el servidor rechazara
      // la creación ENTERA con `Missing or insufficient permissions` — por eso
      // crear un Hogar funcionaba en Android y no en Web.
      //
      // Android lo resuelve igual y lo deja escrito en
      // `MplusHouseholdCategoryRepository`: «el seed solo puede sembrarse con
      // el Hogar `active` […] por eso `ensureSeed` se llama al detectar la
      // transición a activo, no al crear el Hogar». Web hace lo mismo desde
      // `ensureHouseholdExpenseSeed`, disparado por el loader de Hogar.
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
  const identity = await resolveMemberIdentity({ displayName, photoUrl });
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

  const inviteOnlyRejection = resolveJoinRejection({
    invite,
    household: null,
    membershipState: null,
    joinerUid,
    nowMillis: now,
  });
  if (inviteOnlyRejection && inviteOnlyRejection.code !== "not-found") {
    return { kind: "rejected", ...inviteOnlyRejection };
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

  const rejection = resolveJoinRejection({
    invite,
    household,
    membershipState: userProfile.householdMembershipState,
    joinerUid,
    nowMillis: now,
  });
  if (rejection) {
    return { kind: "rejected", ...rejection };
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
            displayName: identity.displayName,
            photoUrl: identity.photoUrl,
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
            displayName: identity.displayName,
            photoUrl: identity.photoUrl,
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
  household: MplusHousehold;
  newName: string;
}): Promise<MplusMutationOutcome<void>> => {
  const { household, newName } = params;
  const householdId = household.id;
  const expectedRevision = household.revision;
  const trimmed = newName.trim();

  const rejection = resolveRenameRejection({ currentName: household.name, newName });
  if (rejection) {
    return { kind: "rejected", ...rejection };
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

/**
 * Limpia un vínculo de Hogar que quedó apuntando a un Hogar inexistente.
 *
 * Contrato §16.3: «Si después del cierre conservan un `householdId`
 * inexistente, al abrir la app el dueño lo limpia y cambia su membresía a
 * `none`». Es el ÚNICO camino posible para desvincular al otro miembro después
 * de un reinicio profundo (DEC-080): Rules solo permiten escribir el propio
 * `users/{uid}` (`ownsPath`), así que quien reinicia no puede tocar el perfil
 * de su compañero — lo hace el compañero, en su propio cliente.
 *
 * Sin esto, el otro miembro se quedaba con un `householdId` colgado que le
 * impedía crear o unirse a un Hogar nuevo (`createMplusHousehold` rechaza si la
 * membresía no es `none`).
 *
 * Es idempotente y seguro de repetir: no hace nada si el perfil ya está
 * desvinculado o si el Hogar sí existe.
 */
export const reconcileOrphanHouseholdLink = async (params: {
  uid: string;
  db?: Firestore;
}): Promise<MplusMutationOutcome<boolean>> => {
  const db = params.db ?? getFirebaseDb();
  const { uid } = params;

  const userRef = doc(db, ...userDocPath(uid));
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return { kind: "success", value: false, replayed: false };
  }

  const userProfile = userProfileFromFirestore(userSnap.id, userSnap.data());
  if (userProfile.householdId === null && userProfile.householdMembershipState === "none") {
    return { kind: "success", value: false, replayed: false };
  }

  // Solo se limpia si el Hogar de verdad ya no está. Un fallo de permisos o de
  // red no puede confundirse con "el Hogar no existe".
  const householdSnap = await getDoc(
    doc(db, ...householdDocPath(userProfile.householdId ?? "__sin_hogar__")),
  );
  if (userProfile.householdId !== null && householdSnap.exists()) {
    return { kind: "success", value: false, replayed: false };
  }

  const mutationId = newMutationId();
  const now = Date.now();

  return runMplusMutation<boolean>(db, {
    mutationId,
    occ: [
      { resource: "users", id: uid, ref: userRef, baseRevision: userProfile.revision },
    ],
    work: (tx: Transaction) => {
      const cleaned: MplusUserProfile = {
        ...userProfile,
        householdId: null,
        householdMembershipState: "none",
        revision: userProfile.revision + 1,
        lastMutationId: mutationId,
        updatedAtMillis: now,
      };
      tx.update(userRef, userProfileToFirestore(cleaned));
      return true;
    },
  });
};
