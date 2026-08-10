import { create } from "zustand";

interface HouseholdUiState {
  isCreateExpenseOpen: boolean;
  openCreateExpense: () => void;
  closeCreateExpense: () => void;
  reset: () => void;
}

export const useHouseholdUiStore = create<HouseholdUiState>((set) => ({
  isCreateExpenseOpen: false,
  openCreateExpense: () => set({ isCreateExpenseOpen: true }),
  closeCreateExpense: () => set({ isCreateExpenseOpen: false }),
  reset: () => set({ isCreateExpenseOpen: false }),
}));
