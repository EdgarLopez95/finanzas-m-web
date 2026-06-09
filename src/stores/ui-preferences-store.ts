import { create } from "zustand";

const HIDE_BALANCES_KEY = "fm-hide-balances";
const NOTIFICATIONS_KEY = "fm-notifications-enabled";

type UiPreferencesState = {
  balancesHidden: boolean;
  notificationsEnabled: boolean;
  hydrated: boolean;
  /** Carga las preferencias persistidas desde localStorage (una sola vez). */
  hydrate: () => void;
  toggleBalancesHidden: () => void;
  toggleNotifications: () => void;
};

export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => ({
  balancesHidden: false,
  notificationsEnabled: true,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    const savedBalances = window.localStorage.getItem(HIDE_BALANCES_KEY);
    const savedNotifications = window.localStorage.getItem(NOTIFICATIONS_KEY);

    set({
      balancesHidden: savedBalances === "true",
      notificationsEnabled: savedNotifications !== "false",
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
}));
