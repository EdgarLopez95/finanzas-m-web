/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO. Retirar antes de producción.
 * ============================================================================
 *
 * Descubrimiento completo de Hogares del usuario actual, independiente de lo
 * que la UI tenga cargado (`users/{uid}.activeHouseholdId` puede estar vacío,
 * apuntar a un Hogar ya borrado, o un reset anterior pudo haber quedado a
 * medias). Consulta `households` donde `memberIds` contiene el UID — la
 * misma query que Android usa en `resetAllDataForCurrentUser`
 * (`whereArrayContains("memberIds", userId)`) — y NUNCA `where("ownerId",
 * "==", userId)` directo: Android documenta que esa query es rechazada por
 * las Rules (`allow read: if request.auth.uid in resource.data.memberIds`,
 * `android/firestore.rules`), porque Firestore no puede garantizar
 * estáticamente esa condición para un filtro por `ownerId`. Los Hogares
 * propios se derivan filtrando en memoria por `ownerId === uid` sobre el
 * resultado ya obtenido — nunca con una segunda query.
 */
import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type DiscoveredHousehold = { id: string; ownerId: string };

export type DiscoverHouseholdsResult = {
  owned: DiscoveredHousehold[];
  memberOnly: DiscoveredHousehold[];
};

export type DiscoverHouseholdsDeps = {
  queryMemberHouseholds?: (uid: string) => Promise<DiscoveredHousehold[]>;
};

const defaultQueryMemberHouseholds: NonNullable<DiscoverHouseholdsDeps["queryMemberHouseholds"]> = async (uid) => {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "households"), where("memberIds", "array-contains", uid)));
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ownerId: String(docSnap.data().ownerId || ""),
  }));
};

/**
 * Descubre TODOS los Hogares donde el usuario actual es miembro (propio o
 * ajeno), sin depender del `activeHouseholdId` cargado en la UI. Un fallo en
 * la query se propaga como un arreglo vacío + `queryFailed: true` para que el
 * llamador pueda reportarlo como fallo parcial en vez de asumir "sin
 * Hogares" en falso.
 */
export const discoverHouseholdsForCurrentUser = async (
  uid: string,
  deps: DiscoverHouseholdsDeps = {},
): Promise<DiscoverHouseholdsResult & { queryFailed: boolean }> => {
  const queryFn = deps.queryMemberHouseholds ?? defaultQueryMemberHouseholds;

  try {
    const households = await queryFn(uid);
    return {
      owned: households.filter((h) => h.ownerId === uid),
      memberOnly: households.filter((h) => h.ownerId !== uid),
      queryFailed: false,
    };
  } catch (err) {
    console.warn(`[qa-reset] Fallo descubriendo Hogares del usuario (uid=${uid}):`, err);
    return { owned: [], memberOnly: [], queryFailed: true };
  }
};
