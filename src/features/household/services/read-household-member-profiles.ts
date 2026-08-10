import { doc, getDoc } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdMemberProfile } from "@/types/household";

/**
 * Lee perfiles mínimos (displayName, photoUrl) de otros miembros del Hogar.
 * La regla users/{userId} permite la lectura si el caller comparte hogar con
 * el target (tercera cláusula del allow read). Si algún doc falla con
 * permission-denied o no existe, ese miembro se omite sin lanzar error.
 *
 * No expone datos financieros: solo displayName y photoUrl del documento users/.
 */
export const readHouseholdMemberProfiles = async (
  memberIds: string[],
  currentUid: string,
): Promise<Record<string, HouseholdMemberProfile>> => {
  const db = getFirebaseDb();
  const otherIds = memberIds.filter((id) => id !== currentUid);

  if (otherIds.length === 0) {
    return {};
  }

  const results = await Promise.allSettled(
    otherIds.map((uid) => getDoc(doc(db, "users", uid))),
  );

  const profiles: Record<string, HouseholdMemberProfile> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const uid = otherIds[i];

    if (result.status === "rejected" || !result.value.exists()) {
      continue;
    }

    const data = result.value.data();
    profiles[uid] = {
      uid,
      displayName: toSafeString(data.displayName) || "Miembro del hogar",
      photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : null,
    };
  }

  return profiles;
};
