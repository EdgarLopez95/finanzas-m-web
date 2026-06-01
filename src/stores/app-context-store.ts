import { create } from "zustand";

type AppContextState = {
  householdMode: boolean;
  toggleHouseholdMode: () => void;
};

export const useAppContextStore = create<AppContextState>((set) => ({
  householdMode: false,
  toggleHouseholdMode: () => set((state) => ({ householdMode: !state.householdMode })),
}));
