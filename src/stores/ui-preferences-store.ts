import { create } from "zustand";

const HIDE_BALANCES_KEY = "fm-hide-balances";
const NOTIFICATIONS_KEY = "fm-notifications-enabled";
const BOARD_ORDER_KEY = "fm-board-order";
const HIDDEN_CARDS_KEY = "fm-board-hidden";

type UiPreferencesState = {
  balancesHidden: boolean;
  notificationsEnabled: boolean;
  hydrated: boolean;
  isEditingBoard: boolean;
  boardOrder: string[];
  hiddenCards: string[];
  /** Carga las preferencias persistidas desde localStorage (una sola vez). */
  hydrate: () => void;
  toggleBalancesHidden: () => void;
  toggleNotifications: () => void;
  setEditingBoard: (editing: boolean) => void;
  setBoardOrder: (order: string[]) => void;
  hideCard: (cardId: string) => void;
  showCard: (cardId: string) => void;
  resetBoard: () => void;
};

export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => ({
  balancesHidden: false,
  notificationsEnabled: true,
  hydrated: false,
  isEditingBoard: false,
  boardOrder: ["accounts", "categories", "movements", "household"],
  hiddenCards: [],

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    const savedBalances = window.localStorage.getItem(HIDE_BALANCES_KEY);
    const savedNotifications = window.localStorage.getItem(NOTIFICATIONS_KEY);
    const savedOrder = window.localStorage.getItem(BOARD_ORDER_KEY);
    const savedHidden = window.localStorage.getItem(HIDDEN_CARDS_KEY);

    let boardOrder = ["accounts", "categories", "movements", "household"];
    let hiddenCards: string[] = [];

    if (savedOrder) {
      try {
        boardOrder = JSON.parse(savedOrder);
      } catch (e) {
        console.error("Error parsing board order", e);
      }
    }
    if (savedHidden) {
      try {
        hiddenCards = JSON.parse(savedHidden);
      } catch (e) {
        console.error("Error parsing hidden cards", e);
      }
    }

    set({
      balancesHidden: savedBalances === "true",
      notificationsEnabled: savedNotifications !== "false",
      boardOrder,
      hiddenCards,
      hydrated: true,
    });
  },

  toggleBalancesHidden: () => {
    set((state) => {
      const next = !state.balancesHidden;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIDE_BALANCES_KEY, String(next));
      }
      return { balancesHidden: next };
    });
  },

  toggleNotifications: () => {
    set((state) => {
      const next = !state.notificationsEnabled;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(NOTIFICATIONS_KEY, String(next));
      }
      return { notificationsEnabled: next };
    });
  },

  setEditingBoard: (editing: boolean) => {
    set({ isEditingBoard: editing });
  },

  setBoardOrder: (order: string[]) => {
    set({ boardOrder: order });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BOARD_ORDER_KEY, JSON.stringify(order));
    }
  },

  hideCard: (cardId: string) => {
    set((state) => {
      const nextHidden = [...state.hiddenCards, cardId];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify(nextHidden));
      }
      return { hiddenCards: nextHidden };
    });
  },

  showCard: (cardId: string) => {
    set((state) => {
      const nextHidden = state.hiddenCards.filter((id) => id !== cardId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify(nextHidden));
      }
      return { hiddenCards: nextHidden };
    });
  },

  resetBoard: () => {
    const defaultOrder = ["accounts", "categories", "movements", "household"];
    set({
      boardOrder: defaultOrder,
      hiddenCards: [],
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BOARD_ORDER_KEY);
      window.localStorage.removeItem(HIDDEN_CARDS_KEY);
    }
  },
}));

