import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export const HOUSEHOLD_SUBCOLLECTIONS = [
  "household_income_entries",
  "household_event_shares",
  "household_debts",
  "household_review_items",
  "household_categories",
  "household_events",
];

export const WIPE_PAGE_SIZE = 400;

export type DissolveHouseholdDeps = {
  getHouseholdDoc?: (householdId: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  wipeCollectionPage?: (collectionName: string, householdId: string, pageSize: number) => Promise<{ docRefs: unknown[]; hasMore: boolean }>;
  commitBatchDelete?: (refs: unknown[]) => Promise<void>;
  deleteInviteDoc?: (inviteCode: string) => Promise<void>;
  deleteHouseholdDoc?: (householdId: string) => Promise<void>;
  clearOwnerActiveHousehold?: (ownerUid: string) => Promise<void>;
};

/**
 * Semántica Android Canónica (HouseholdRepository.kt:407-494):
 * 1. Paginación de máximo 400 elementos por batch en cada una de las 6 subcolecciones.
 * 2. Orden estricto: subcolecciones -> invitación auxiliar -> documento de hogar -> deleteField() del owner.
 * 3. Resiliencia: si falla una colección, se registra el aviso y se continúa con el borrado final del padre.
 */
export const dissolveHousehold = async (
  householdId: string,
  uid: string,
  customDeps?: DissolveHouseholdDeps
): Promise<void> => {
  if (!householdId) throw new Error("ID de hogar es obligatorio.");
  if (!uid) throw new Error("UID es obligatorio.");

  const db = customDeps ? null : getFirebaseDb();

  // 1. Obtener metadata del documento de hogar
  const getHhDoc = customDeps?.getHouseholdDoc ?? (async (id: string) => {
    const snap = await getDoc(doc(db!, "households", id));
    return { exists: snap.exists(), data: () => snap.data() };
  });

  const householdSnap = await getHhDoc(householdId);

  if (!householdSnap.exists) {
    const clearOwner = customDeps?.clearOwnerActiveHousehold ?? (async (ownerUid: string) => {
      await updateDoc(doc(db!, "users", ownerUid), { activeHouseholdId: deleteField() }).catch(() => {});
    });
    await clearOwner(uid);
    return;
  }

  const data = householdSnap.data();
  if (!data || data.ownerId !== uid) {
    throw new Error("Solo el dueño administrador puede disolver el hogar.");
  }

  const inviteCode = data.inviteCode ? String(data.inviteCode).trim() : null;

  // 2. Limpieza paginada de las 6 subcolecciones (máximo 400 docs por batch)
  const wipePage = customDeps?.wipeCollectionPage ?? (async (colName: string, hhId: string, pageSize: number) => {
    const q = query(
      collection(db!, colName),
      where("householdId", "==", hhId),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const docRefs = snap.docs.map((d) => d.ref);
    return { docRefs, hasMore: snap.docs.length >= pageSize };
  });

  const commitDelete = customDeps?.commitBatchDelete ?? (async (refs: unknown[]) => {
    if (refs.length === 0) return;
    const batch = writeBatch(db!);
    refs.forEach((ref) => batch.delete(ref as Parameters<typeof batch.delete>[0]));
    await batch.commit();
  });

  for (const collectionName of HOUSEHOLD_SUBCOLLECTIONS) {
    try {
      let hasMore = true;
      while (hasMore) {
        const page = await wipePage(collectionName, householdId, WIPE_PAGE_SIZE);
        if (page.docRefs.length > 0) {
          await commitDelete(page.docRefs);
        }
        hasMore = page.hasMore;
      }
    } catch (err) {
      console.warn(`Error limpiando subcolección ${collectionName} durante disolución:`, err);
    }
  }

  // 3. Borrar invitación auxiliar si existía
  if (inviteCode) {
    const delInvite = customDeps?.deleteInviteDoc ?? (async (code: string) => {
      await deleteDoc(doc(db!, "household_invites", code)).catch(() => {});
    });
    try {
      await delInvite(inviteCode);
    } catch (err) {
      console.warn(`Fallo borrando invitación ${inviteCode}:`, err);
    }
  }

  // 4. Hard-delete del documento principal del hogar
  const delHhDoc = customDeps?.deleteHouseholdDoc ?? (async (id: string) => {
    await deleteDoc(doc(db!, "households", id));
  });

  try {
    await delHhDoc(householdId);
  } catch (err) {
    console.warn(`Fallo borrando documento de hogar ${householdId}:`, err);
  }

  // 5. Limpiar el campo activeHouseholdId del owner con deleteField()
  const clearOwner = customDeps?.clearOwnerActiveHousehold ?? (async (ownerUid: string) => {
    await updateDoc(doc(db!, "users", ownerUid), { activeHouseholdId: deleteField() });
  });

  try {
    await clearOwner(uid);
  } catch (err) {
    console.warn("Fallo limpiando activeHouseholdId del owner:", err);
  }
};
