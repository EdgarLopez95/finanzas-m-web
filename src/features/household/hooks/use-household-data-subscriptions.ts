import { collection, onSnapshot, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import { mapHouseholdCategoryDoc } from "@/features/household/services/read-household-categories";
import { mapHouseholdDebtDoc } from "@/features/household/services/read-household-debts";
import { mapHouseholdEventShareDoc } from "@/features/household/services/read-household-event-shares";
import { mapHouseholdEventDoc } from "@/features/household/services/read-household-events";
import { mapHouseholdIncomeEntryDoc } from "@/features/household/services/read-household-income-entries";

const reportDataSubscriptionError = (error: unknown) => {
  console.error("Error en suscripción de datos del hogar:", error);
  const store = useHouseholdDataStore.getState();
  if (store.status !== "success") {
    useHouseholdDataStore.setState({ status: "error", error: "Error de conexión al sincronizar el hogar." });
  } else {
    useHouseholdDataStore.setState({ error: "Error de conexión al sincronizar el hogar." });
  }
};

export const startHouseholdDataSubscriptions = (householdId: string, uid?: string): void => {
  const db = getFirebaseDb();

  const isCallbackValid = (): boolean => {
    const state = useHouseholdDataStore.getState();
    if (uid && state.uid !== uid) return false;
    if (state.data.activeHouseholdId !== householdId) return false;
    return true;
  };

  // 1. household_events
  const eventsQuery = query(collection(db, "household_events"), where("householdId", "==", householdId));
  const unsubEvents = onSnapshot(
    eventsQuery,
    (snapshot) => {
      if (!isCallbackValid()) return;
      const events = snapshot.docs.map((docItem) => mapHouseholdEventDoc(docItem, householdId));
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ events }, uid);
    },
    (error) => {
      if (!isCallbackValid()) return;
      reportDataSubscriptionError(error);
    }
  );
  subscriptionRegistry.register("household", "events", unsubEvents);

  // 2. household_event_shares
  const sharesQuery = query(collection(db, "household_event_shares"), where("householdId", "==", householdId));
  const unsubShares = onSnapshot(
    sharesQuery,
    (snapshot) => {
      if (!isCallbackValid()) return;
      const eventShares = snapshot.docs.map((docItem) => mapHouseholdEventShareDoc(docItem, householdId));
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ eventShares }, uid);
    },
    (error) => {
      if (!isCallbackValid()) return;
      reportDataSubscriptionError(error);
    }
  );
  subscriptionRegistry.register("household", "event-shares", unsubShares);

  // 3. household_debts
  const debtsQuery = query(collection(db, "household_debts"), where("householdId", "==", householdId));
  const unsubDebts = onSnapshot(
    debtsQuery,
    (snapshot) => {
      if (!isCallbackValid()) return;
      const debts = snapshot.docs.map((docItem) => mapHouseholdDebtDoc(docItem, householdId));
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ debts }, uid);
    },
    (error) => {
      if (!isCallbackValid()) return;
      reportDataSubscriptionError(error);
    }
  );
  subscriptionRegistry.register("household", "debts", unsubDebts);

  // 4. household_income_entries
  const incomeQuery = query(collection(db, "household_income_entries"), where("householdId", "==", householdId));
  const unsubIncome = onSnapshot(
    incomeQuery,
    (snapshot) => {
      if (!isCallbackValid()) return;
      const rawEntries = snapshot.docs.map((docItem) => mapHouseholdIncomeEntryDoc(docItem, householdId));
      const incomeEntries = rawEntries.filter((entry) => entry.status !== "cancelled" && entry.status !== "cancelado");
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ incomeEntries }, uid);
    },
    (error) => {
      if (!isCallbackValid()) return;
      reportDataSubscriptionError(error);
    }
  );
  subscriptionRegistry.register("household", "income-entries", unsubIncome);

  // 5. household_categories
  const categoriesQuery = query(collection(db, "household_categories"), where("householdId", "==", householdId));
  const unsubCategories = onSnapshot(
    categoriesQuery,
    (snapshot) => {
      if (!isCallbackValid()) return;
      const categories = snapshot.docs.map((docItem) => mapHouseholdCategoryDoc(docItem, householdId));
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ categories }, uid);
    },
    (error) => {
      if (!isCallbackValid()) return;
      reportDataSubscriptionError(error);
    }
  );
  subscriptionRegistry.register("household", "categories", unsubCategories);
};

export const stopHouseholdDataSubscriptions = (): void => {
  subscriptionRegistry.unregister("household", "events");
  subscriptionRegistry.unregister("household", "event-shares");
  subscriptionRegistry.unregister("household", "debts");
  subscriptionRegistry.unregister("household", "income-entries");
  subscriptionRegistry.unregister("household", "categories");
};
