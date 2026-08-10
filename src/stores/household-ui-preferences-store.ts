import { create } from "zustand";

const HOUSEHOLD_BOARD_ORDER_KEY = "fm-hh-board-order";
const HOUSEHOLD_HIDDEN_CARDS_KEY = "fm-hh-board-hidden";

type HouseholdUiPreferencesState = {
  hydrated: boolean;
  isEditingHouseholdBoard: boolean;
  householdBoardOrder: string[];
  householdHiddenCards: string[];
  /** Carga las preferencias persistidas desde localStorage (una sola vez). */
  hydrate: () => void;
  setEditingHouseholdBoard: (editing: boolean) => void;
  setHouseholdBoardOrder: (order: string[]) => void;
  hideHouseholdCard: (cardId: string) => void;
  showHouseholdCard: (cardId: string) => void;
  resetHouseholdBoard: () => void;
};

export const useHouseholdUiPreferencesStore = create<HouseholdUiPreferencesState>((set, get) => ({
  hydrated: false,
  isEditingHouseholdBoard: false,
  householdBoardOrder: ["categories", "movements", "contributions"],
  householdHiddenCards: [],

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    const savedOrder = window.localStorage.getItem(HOUSEHOLD_BOARD_ORDER_KEY);
    const savedHidden = window.localStorage.getItem(HOUSEHOLD_HIDDEN_CARDS_KEY);

    let householdBoardOrder = ["categories", "movements", "contributions"];
    let householdHiddenCards: string[] = [];

    if (savedOrder) {
      try {
        householdBoardOrder = JSON.parse(savedOrder);
      } catch (e) {
        console.error("Error parsing household board order", e);
      }
    }
    if (savedHidden) {
      try {
        householdHiddenCards = JSON.parse(savedHidden);
      } catch (e) {
        console.error("Error parsing household hidden cards", e);
      }
    }

    set({
      householdBoardOrder,
      householdHiddenCards,
      hydrated: true,
    });
  },

  setEditingHouseholdBoard: (editing: boolean) => {
    set({ isEditingHouseholdBoard: editing });
  },

  setHouseholdBoardOrder: (order: string[]) => {
    set({ householdBoardOrder: order });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HOUSEHOLD_BOARD_ORDER_KEY, JSON.stringify(order));
    }
  },

  hideHouseholdCard: (cardId: string) => {
    set((state) => {
      const nextHidden = [...state.householdHiddenCards, cardId];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HOUSEHOLD_HIDDEN_CARDS_KEY, JSON.stringify(nextHidden));
      }
      return { householdHiddenCards: nextHidden };
    });
  },

  showHouseholdCard: (cardId: string) => {
    set((state) => {
      const nextHidden = state.householdHiddenCards.filter((id) => id !== cardId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HOUSEHOLD_HIDDEN_CARDS_KEY, JSON.stringify(nextHidden));
      }
      return { householdHiddenCards: nextHidden };
    });
  },

  resetHouseholdBoard: () => {
    const defaultOrder = ["categories", "movements", "contributions"];
    set({
      householdBoardOrder: defaultOrder,
      householdHiddenCards: [],
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(HOUSEHOLD_BOARD_ORDER_KEY);
      window.localStorage.removeItem(HOUSEHOLD_HIDDEN_CARDS_KEY);
    }
  },
}));
