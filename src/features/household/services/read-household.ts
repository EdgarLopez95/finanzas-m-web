import { doc, getDoc, DocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeNumber, toSafeString, toDateOrNull } from "@/lib/firebase/firestore-parsers";
import type { Household } from "@/types/household";

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toFirestoreError = (error: unknown, label: string): Error => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "permission-denied"
  ) {
    return new Error(`permission-denied en ${label}`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`No se pudo leer ${label}.`);
};

export const mapHouseholdDoc = (snapshot: DocumentSnapshot<DocumentData>): Household => {
  const data = snapshot.data();
  if (!data) {
    throw new Error("El hogar activo no existe.");
  }
  const memberIds = toStringArray(data.memberIds ?? data.members ?? data.memberUids);

  return {
    id: snapshot.id,
    name: toSafeString(data.name, "Hogar"),
    ownerId: toSafeString(data.ownerId, ""),
    memberIds,
    memberCount: memberIds.length || toSafeNumber(data.memberCount ?? data.membersCount),
    inviteCode: data.inviteCode ? toSafeString(data.inviteCode) : null,
    inviteCodeExpiresAt: toDateOrNull(data.inviteCodeExpiresAt),
    status: data.status === "dissolved" ? "dissolved" : "active",
  };
};

export const readHousehold = async (householdId: string, uid: string): Promise<Household> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDoc(doc(db, "households", householdId));

    if (!snapshot.exists()) {
      throw new Error("El hogar activo no existe.");
    }

    const household = mapHouseholdDoc(snapshot);

    if (household.memberIds.length > 0 && !household.memberIds.includes(uid)) {
      throw new Error("No tienes permiso para ver este hogar.");
    }

    return household;
  } catch (error) {
    throw toFirestoreError(error, "households");
  }
};
