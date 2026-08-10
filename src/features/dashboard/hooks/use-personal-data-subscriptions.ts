import { collection, onSnapshot, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { usePersonalDataStore, PocketFanoutController, type PersonalAsyncContext } from "@/stores/personal-data-store";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import { mapAccountDoc } from "@/features/accounts/services/read-personal-accounts";
import { mapCategoryDoc } from "@/features/categories/services/read-personal-categories";
import { mapTransactionDoc } from "@/features/transactions/services/read-personal-transactions";
import { toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { ThirdPartyFundEntry, ThirdPartyFundConsumption, ThirdPartyFundEntryStatus } from "@/types/third-party-funds";
import type { Pocket } from "@/types/pocket";

export type SubscriptionSessionState = "idle" | "starting" | "active";

export class PersonalSubscriptionSessionController {
  private state: SubscriptionSessionState = "idle";
  private activeContext: PersonalAsyncContext | null = null;
  private cleanups: (() => void)[] = [];

  getState(): SubscriptionSessionState {
    return this.state;
  }

  getContext(): PersonalAsyncContext | null {
    return this.activeContext;
  }

  stop(): void {
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.error("Error during subscription cleanup:", err);
      }
    }
    this.cleanups = [];
    subscriptionRegistry.unregister("personal");
    this.state = "idle";
    this.activeContext = null;
  }

  start(
    context: PersonalAsyncContext,
    setup: (registerCleanup: (unsub: () => void) => void) => void
  ): boolean {
    if (
      this.state === "active" &&
      this.activeContext !== null &&
      this.activeContext.ownerId === context.ownerId &&
      this.activeContext.generation === context.generation
    ) {
      return false;
    }

    this.stop();

    this.state = "starting";
    this.activeContext = context;

    const registeredCleanups: (() => void)[] = [];
    const registerCleanup = (unsub: () => void) => {
      registeredCleanups.push(unsub);
    };

    try {
      setup(registerCleanup);

      this.cleanups = registeredCleanups;
      this.state = "active";
      return true;
    } catch (err) {
      for (const cleanup of registeredCleanups) {
        try {
          cleanup();
        } catch {
          // ignore
        }
      }
      subscriptionRegistry.unregister("personal");
      this.cleanups = [];
      this.state = "idle";
      this.activeContext = null;
      throw err;
    }
  }
}

export const personalSubscriptionSession = new PersonalSubscriptionSessionController();

export const startPersonalSubscriptions = (ownerId: string): void => {
  const store = usePersonalDataStore.getState();
  const subContext = store.getAsyncContext();

  if (!subContext || subContext.ownerId !== ownerId) {
    return;
  }

  personalSubscriptionSession.start(subContext, (registerCleanup) => {
    store.setSyncMode("live");
    const db = getFirebaseDb();

    // 1. Suscripción a Cuentas
    const accountsQuery = query(collection(db, "accounts"), where("ownerId", "==", ownerId));
    const unsubscribeAccounts = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const accounts = snapshot.docs.map((docItem) => mapAccountDoc(docItem, ownerId));
        usePersonalDataStore.getState().applyPersonalSnapshot({ accounts }, "accounts", subContext);
      },
      (error) => {
        console.error("Error al suscribirse a cuentas:", error);
        usePersonalDataStore.getState().reportDatasetError("accounts", error, subContext);
      }
    );
    subscriptionRegistry.register("personal", "accounts", unsubscribeAccounts);
    registerCleanup(unsubscribeAccounts);

    // 2. Suscripción a Categorías
    const categoriesQuery = query(collection(db, "categories"), where("ownerId", "==", ownerId));
    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const categories = snapshot.docs.map((docItem) => mapCategoryDoc(docItem, ownerId));
        usePersonalDataStore.getState().applyPersonalSnapshot({ categories }, "categories", subContext);
      },
      (error) => {
        console.error("Error al suscribirse a categorías:", error);
        usePersonalDataStore.getState().reportDatasetError("categories", error, subContext);
      }
    );
    subscriptionRegistry.register("personal", "categories", unsubscribeCategories);
    registerCleanup(unsubscribeCategories);

    // 3. Suscripción a Transacciones
    const transactionsQuery = query(collection(db, "transactions"), where("ownerId", "==", ownerId));
    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const transactions = snapshot.docs.map((docItem) => mapTransactionDoc(docItem, ownerId));
        transactions.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        usePersonalDataStore.getState().applyPersonalSnapshot({ transactions }, "transactions", subContext);
      },
      (error) => {
        console.error("Error al suscribirse a transacciones:", error);
        usePersonalDataStore.getState().reportDatasetError("transactions", error, subContext);
      }
    );
    subscriptionRegistry.register("personal", "transactions", unsubscribeTransactions);
    registerCleanup(unsubscribeTransactions);

    // 4. Suscripción a Entradas de Fondos de Terceros
    const entriesQuery = query(
      collection(db, "third_party_fund_entries"),
      where("ownerId", "==", ownerId),
      where("status", "in", ["open", "consumed"])
    );
    const unsubscribeEntries = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const entries = snapshot.docs.map((docItem) => {
          const data = docItem.data();
          return {
            id: docItem.id,
            ownerId: String(data.ownerId || ""),
            sourceIncomeTransactionId: String(data.sourceIncomeTransactionId || ""),
            originalAmount: Number(data.originalAmount || 0),
            status: (data.status as ThirdPartyFundEntryStatus) || "open",
            createdAt: data.createdAt?.toDate() || null,
            updatedAt: data.updatedAt?.toDate() || null,
          } as ThirdPartyFundEntry;
        });
        usePersonalDataStore.getState().applyPersonalSnapshot({ thirdPartyEntries: entries }, "thirdPartyEntries", subContext);
      },
      (error) => {
        console.error("Error al suscribirse a entradas de terceros:", error);
        usePersonalDataStore.getState().reportDatasetError("thirdPartyEntries", error, subContext);
      }
    );
    subscriptionRegistry.register("personal", "third-party-entries", unsubscribeEntries);
    registerCleanup(unsubscribeEntries);

    // 5. Suscripción a Consumos de Fondos de Terceros
    const consumptionsQuery = query(
      collection(db, "third_party_fund_consumptions"),
      where("ownerId", "==", ownerId)
    );
    const unsubscribeConsumptions = onSnapshot(
      consumptionsQuery,
      (snapshot) => {
        const consumptions = snapshot.docs.map((docItem) => {
          const data = docItem.data();
          return {
            id: docItem.id,
            ownerId: String(data.ownerId || ""),
            entryId: String(data.entryId || ""),
            consumerExpenseTransactionId: String(data.consumerExpenseTransactionId || ""),
            amount: Number(data.amount || 0),
            createdAt: data.createdAt?.toDate() || null,
            updatedAt: data.updatedAt?.toDate() || null,
          } as ThirdPartyFundConsumption;
        });
        usePersonalDataStore.getState().applyPersonalSnapshot({ thirdPartyConsumptions: consumptions }, "thirdPartyConsumptions", subContext);
      },
      (error) => {
        console.error("Error al suscribirse a consumos de terceros:", error);
        usePersonalDataStore.getState().reportDatasetError("thirdPartyConsumptions", error, subContext);
      }
    );
    subscriptionRegistry.register("personal", "third-party-consumptions", unsubscribeConsumptions);
    registerCleanup(unsubscribeConsumptions);



    // 6. Suscripción a Bolsillos (dependientes de ids de cuentas activas y controladas por PocketFanoutController con barrierId)
    let lastActiveAccountIdsStr = "";
    let currentPocketUnsubscribes: (() => void)[] = [];
    const pocketController = new PocketFanoutController();

    const unsubscribeStore = usePersonalDataStore.subscribe((state) => {
      if (!state.isContextActive(subContext)) {
        return;
      }

      const rawAccounts = state.rawAccounts || [];
      const activeAccountIds = rawAccounts.filter((a) => !a.archived).map((a) => a.id);
      const activeAccountIdsStr = activeAccountIds.join(",");

      if (activeAccountIdsStr === lastActiveAccountIdsStr) {
        return;
      }
      lastActiveAccountIdsStr = activeAccountIdsStr;

      currentPocketUnsubscribes.forEach((unsub) => unsub());
      currentPocketUnsubscribes = [];

      if (activeAccountIds.length === 0) {
        usePersonalDataStore.getState().applyPersonalSnapshot({ pockets: [] }, "pockets", subContext);
        return;
      }

      const barrierContext = pocketController.reset(activeAccountIds, subContext);

      const currentPocketDS = usePersonalDataStore.getState().datasets.pockets;
      usePersonalDataStore.getState().setDatasetState("pockets", {
        status: currentPocketDS.hasValue ? "stale" : "loading",
      }, subContext);

      activeAccountIds.forEach((accountId) => {
        const pocketsQuery = collection(db, "accounts", accountId, "pockets");
        const unsub = onSnapshot(
          pocketsQuery,
          (snapshot) => {
            const accountPockets = snapshot.docs.map((docItem) => {
              const data = docItem.data();
              return {
                id: docItem.id,
                accountId,
                name: toSafeString(data.name, "Bolsillo sin nombre"),
                balance: toSafeNumber(data.balance ?? data.amount),
              } as Pocket;
            });

            const combined = pocketController.onAccountSnapshot(accountId, accountPockets, barrierContext);
            if (combined !== null) {
              usePersonalDataStore.getState().applyPersonalSnapshot({ pockets: combined }, "pockets", subContext);
            }
          },
          (error) => {
            console.error(`Error al suscribirse a bolsillos de cuenta ${accountId}:`, error);
            if (pocketController.onAccountError(accountId, barrierContext)) {
              usePersonalDataStore.getState().reportDatasetError("pockets", error, subContext);
            }
          }
        );
        currentPocketUnsubscribes.push(unsub);
      });
    });

    const unsubscribeAllPocketsWatcher = () => {
      unsubscribeStore();
      currentPocketUnsubscribes.forEach((unsub) => unsub());
    };
    subscriptionRegistry.register("personal", "pockets", unsubscribeAllPocketsWatcher);
    registerCleanup(unsubscribeAllPocketsWatcher);
  });
};
