import { deleteField, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import { mapHouseholdDoc } from "@/features/household/services/read-household";
import { readHouseholdMemberProfiles } from "@/features/household/services/read-household-member-profiles";
import { startHouseholdDataSubscriptions, stopHouseholdDataSubscriptions } from "./use-household-data-subscriptions";

let activeSessionUid: string | null = null;

export const HOUSEHOLD_GONE_CONFIRM_MAX_RETRIES = 3;
export const HOUSEHOLD_GONE_CONFIRM_DELAY_MS = 700;

export type ConfirmHouseholdGoneResolution =
  | "KeepTransient"       // Household exists & user is member -> preserve session
  | "RemovedFromMembers"  // Household exists & user !in memberIds -> clear activeHouseholdId & empty
  | "ConfirmedDeleted"    // Household !exists or persistent permission-denied/not-found -> clear activeHouseholdId & empty
  | "NonFatalError";      // Network/unavailable -> retain session & report error

/**
 * Función privada compartida (HouseholdRepository.kt:699-766):
 * Confirma autoritativamente mediante reintentos acotados (máximo 3, 700ms entre reintentos)
 * si un error de permiso/no encontrado es transitorio o si el hogar efectivamente fue disuelto/eliminado.
 */
export const confirmHouseholdGoneThenResolve = async (
  householdId: string,
  uid: string,
  fetcher?: (id: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
): Promise<ConfirmHouseholdGoneResolution> => {
  const getDocFn = fetcher ?? (async (id: string) => {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, "households", id));
    return { exists: snap.exists(), data: () => snap.data() };
  });

  let lastErrorCode = "";

  for (let attempt = 1; attempt <= HOUSEHOLD_GONE_CONFIRM_MAX_RETRIES; attempt++) {
    try {
      const snap = await getDocFn(householdId);
      if (snap.exists) {
        const data = snap.data();
        const memberIds = (data?.memberIds as string[]) || [];
        if (memberIds.includes(uid)) {
          return "KeepTransient";
        }
        return "RemovedFromMembers";
      }
      return "ConfirmedDeleted";
    } catch (err: unknown) {
      lastErrorCode = (err as { code?: string })?.code || (err instanceof Error ? err.message : String(err));
      const isPermissionOrNotFound =
        lastErrorCode.includes("permission-denied") ||
        lastErrorCode.includes("not-found") ||
        lastErrorCode.includes("no existe") ||
        lastErrorCode.includes("No tienes permiso");

      if (!isPermissionOrNotFound) {
        return "NonFatalError";
      }

      if (attempt < HOUSEHOLD_GONE_CONFIRM_MAX_RETRIES) {
        await new Promise((res) => setTimeout(res, HOUSEHOLD_GONE_CONFIRM_DELAY_MS));
      }
    }
  }

  return "ConfirmedDeleted";
};

export interface HandleListenerErrorDeps {
  confirmHouseholdGoneThenResolve?: typeof confirmHouseholdGoneThenResolve;
  clearRemoteActiveHousehold?: (uid: string) => Promise<void>;
  getDocFn?: (id: string) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
}

export const isSessionAndHouseholdActive = (householdId: string, uid: string): boolean => {
  const store = useHouseholdDataStore.getState();
  return store.uid === uid && store.data.activeHouseholdId === householdId;
};

export const handleListenerError = async (
  householdId: string,
  uid: string,
  error: unknown,
  deps?: HandleListenerErrorDeps
) => {
  if (!isSessionAndHouseholdActive(householdId, uid)) return;

  const confirmFn = deps?.confirmHouseholdGoneThenResolve ?? confirmHouseholdGoneThenResolve;
  const resolution = await confirmFn(householdId, uid, deps?.getDocFn);

  if (!isSessionAndHouseholdActive(householdId, uid)) return;

  if (resolution === "KeepTransient") {
    try {
      const getDocFn = deps?.getDocFn ?? (async (id: string) => {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, "households", id));
        return { exists: snap.exists(), data: () => snap.data() };
      });
      const snap = await getDocFn(householdId);
      if (!isSessionAndHouseholdActive(householdId, uid)) return;

      if (snap.exists) {
        const data = snap.data();
        if (data) {
          const fakeSnap = {
            id: householdId,
            data: () => data,
          };
          const household = mapHouseholdDoc(fakeSnap as Parameters<typeof mapHouseholdDoc>[0]);
          if (isSessionAndHouseholdActive(householdId, uid)) {
            useHouseholdDataStore.getState().applyHouseholdSnapshot({ household }, uid);
          }
        }
      }
    } catch (e) {
      console.warn("Fallo re-lectura tras KeepTransient:", e);
    }
    return;
  }

  if (resolution === "RemovedFromMembers" || resolution === "ConfirmedDeleted") {
    if (!isSessionAndHouseholdActive(householdId, uid)) return;

    stopHouseholdDataSubscriptions();
    if (!isSessionAndHouseholdActive(householdId, uid)) return;

    useHouseholdDataStore.getState().applyHouseholdSnapshot({ household: null }, uid);

    const clearFn = deps?.clearRemoteActiveHousehold ?? (async (userId: string) => {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "users", userId), { activeHouseholdId: deleteField() });
    });

    clearFn(uid).catch((err) => {
      console.warn("Fallo escritura remota best-effort al limpiar activeHouseholdId:", err);
    });
    return;
  }

  // NonFatalError (red, unavailable): conservar sesión y publicar estado error consumible sin vaciar
  if (!isSessionAndHouseholdActive(householdId, uid)) return;

  const store = useHouseholdDataStore.getState();
  if (store.status !== "success") {
    useHouseholdDataStore.setState({ status: "error", error: "Error de conexión al sincronizar el hogar." });
  } else {
    useHouseholdDataStore.setState({ error: "Error de conexión al sincronizar el hogar." });
  }
};

export const startHouseholdSessionSubscriptions = (uid: string): void => {
  if (activeSessionUid === uid) {
    return;
  }
  activeSessionUid = uid;

  const store = useHouseholdDataStore.getState();
  store.setSyncMode("live");

  const db = getFirebaseDb();

  // 1. Suscripción al Documento de Usuario (para vigilar activeHouseholdId)
  const userDocRef = doc(db, "users", uid);
  const unsubscribeUser = onSnapshot(
    userDocRef,
    (snapshot) => {
      if (useHouseholdDataStore.getState().uid !== uid) return;
      const data = snapshot.data();
      const activeHouseholdId = data?.activeHouseholdId ? String(data.activeHouseholdId) : null;

      const currentStore = useHouseholdDataStore.getState();
      if (activeHouseholdId !== currentStore.data.activeHouseholdId) {
        useHouseholdDataStore.getState().applyHouseholdSnapshot({ activeHouseholdId }, uid);
      }
    },
    (error) => {
      console.error("Error al suscribirse al documento del usuario:", error);
    }
  );
  subscriptionRegistry.register("household", "user-doc", unsubscribeUser);

  // 2. Watcher para re-suscribir el documento de Hogar cuando cambie el activeHouseholdId
  let currentHouseholdId = useHouseholdDataStore.getState().data.activeHouseholdId;

  const unsubscribeStore = useHouseholdDataStore.subscribe((state) => {
    if (state.uid !== uid) return;
    const nextHouseholdId = state.data.activeHouseholdId;
    if (nextHouseholdId === currentHouseholdId) {
      return;
    }
    currentHouseholdId = nextHouseholdId;

    subscriptionRegistry.unregister("household", "household-doc");

    if (!nextHouseholdId) {
      stopHouseholdDataSubscriptions();
      return;
    }

    const hhDocRef = doc(db, "households", nextHouseholdId);
    const unsubHh = onSnapshot(
      hhDocRef,
      (snapshot) => {
        if (useHouseholdDataStore.getState().uid !== uid) return;

        if (!snapshot.exists()) {
          handleListenerError(nextHouseholdId, uid, new Error("snapshot-not-found"));
          return;
        }

        try {
          const household = mapHouseholdDoc(snapshot);

          if (household.memberIds.length > 0 && !household.memberIds.includes(uid)) {
            handleListenerError(nextHouseholdId, uid, new Error("removed-from-members"));
            return;
          }

          const currentStoreState = useHouseholdDataStore.getState();
          const lastMemberIdsStr = currentStoreState.data.household?.memberIds.join(",") || "";
          const nextMemberIdsStr = household.memberIds.join(",");
          if (nextMemberIdsStr !== lastMemberIdsStr) {
            readHouseholdMemberProfiles(household.memberIds, uid)
              .then((memberProfiles) => {
                if (useHouseholdDataStore.getState().uid === uid) {
                  useHouseholdDataStore.getState().applyHouseholdSnapshot({ household, memberProfiles }, uid);
                }
              })
              .catch((err) => {
                console.error("Error al cargar perfiles de miembros:", err);
                if (useHouseholdDataStore.getState().uid === uid) {
                  useHouseholdDataStore.getState().applyHouseholdSnapshot({ household }, uid);
                }
              });
          } else {
            useHouseholdDataStore.getState().applyHouseholdSnapshot({ household }, uid);
          }
        } catch (err) {
          console.error("Error al parsear el documento de hogar:", err);
        }
      },
      (error) => handleListenerError(nextHouseholdId, uid, error)
    );
    subscriptionRegistry.register("household", "household-doc", unsubHh);
  });

  // 3. Watcher reactivo de estado para montar/desmontar colecciones de datos del Hogar
  let lastSubscribedHouseholdId: string | null = null;

  const unsubscribeWatcher = useHouseholdDataStore.subscribe((state) => {
    if (state.uid !== uid) return;
    const status = state.status;
    const activeHouseholdId = state.data.activeHouseholdId;
    const household = state.data.household;

    const shouldSubscribe =
      status === "success" &&
      activeHouseholdId &&
      household &&
      household.status === "active";

    if (shouldSubscribe) {
      if (lastSubscribedHouseholdId !== activeHouseholdId) {
        lastSubscribedHouseholdId = activeHouseholdId;
        startHouseholdDataSubscriptions(activeHouseholdId, uid);
      }
    } else {
      if (lastSubscribedHouseholdId !== null) {
        lastSubscribedHouseholdId = null;
        stopHouseholdDataSubscriptions();
      }
    }
  });

  const unsubscribeAllHouseholdSessions = () => {
    activeSessionUid = null;
    unsubscribeStore();
    unsubscribeWatcher();
    subscriptionRegistry.unregister("household", "household-doc");
    stopHouseholdDataSubscriptions();
  };
  subscriptionRegistry.register("household", "household-session-watcher", unsubscribeAllHouseholdSessions);

  if (currentHouseholdId) {
    const hhDocRef = doc(db, "households", currentHouseholdId);
    const unsubHh = onSnapshot(
      hhDocRef,
      (snapshot) => {
        if (useHouseholdDataStore.getState().uid !== uid) return;

        if (!snapshot.exists()) {
          handleListenerError(currentHouseholdId!, uid, new Error("snapshot-not-found"));
          return;
        }

        try {
          const household = mapHouseholdDoc(snapshot);
          if (household.memberIds.length > 0 && !household.memberIds.includes(uid)) {
            handleListenerError(currentHouseholdId!, uid, new Error("removed-from-members"));
            return;
          }

          const currentStoreState = useHouseholdDataStore.getState();
          const lastMemberIdsStr = currentStoreState.data.household?.memberIds.join(",") || "";
          const nextMemberIdsStr = household.memberIds.join(",");
          if (nextMemberIdsStr !== lastMemberIdsStr) {
            readHouseholdMemberProfiles(household.memberIds, uid)
              .then((memberProfiles) => {
                if (useHouseholdDataStore.getState().uid === uid) {
                  useHouseholdDataStore.getState().applyHouseholdSnapshot({ household, memberProfiles }, uid);
                }
              })
              .catch((err) => {
                console.error("Error al cargar perfiles de miembros inicial:", err);
                if (useHouseholdDataStore.getState().uid === uid) {
                  useHouseholdDataStore.getState().applyHouseholdSnapshot({ household }, uid);
                }
              });
          } else {
            useHouseholdDataStore.getState().applyHouseholdSnapshot({ household }, uid);
          }
        } catch (err) {
          console.error("Error al parsear el documento de hogar inicial:", err);
        }
      },
      (error) => handleListenerError(currentHouseholdId!, uid, error)
    );
    subscriptionRegistry.register("household", "household-doc", unsubHh);
  }

  const initialState = useHouseholdDataStore.getState();
  if (
    initialState.uid === uid &&
    initialState.status === "success" &&
    initialState.data.activeHouseholdId &&
    initialState.data.household &&
    initialState.data.household.status === "active"
  ) {
    lastSubscribedHouseholdId = initialState.data.activeHouseholdId;
    startHouseholdDataSubscriptions(initialState.data.activeHouseholdId, uid);
  }
};
