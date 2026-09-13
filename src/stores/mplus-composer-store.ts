import { create } from "zustand";

import type { MovementType } from "@/lib/mplus/enums";
import type { MplusHouseholdExpense, MplusMovement } from "@/lib/mplus/models";

/**
 * Estado del composer de movimientos y gastos de Hogar del contrato v1.
 *
 * Soporta creación y edición tanto en Personal (ingreso/gasto) como en Hogar
 * (solo gastos con distribución entre integrantes).
 */

export type MplusComposerMode =
  | Readonly<{ kind: "closed" }>
  | Readonly<{
      kind: "create";
      type: MovementType;
      defaultAccountId: string | null;
      target?: "personal" | "household";
    }>
  | Readonly<{ kind: "edit"; movement: MplusMovement }>
  | Readonly<{ kind: "edit_household_expense"; expense: MplusHouseholdExpense }>
  | Readonly<{ kind: "trash"; movement: MplusMovement }>
  | Readonly<{ kind: "trash_household_expense"; expense: MplusHouseholdExpense }>;

type MplusComposerState = {
  mode: MplusComposerMode;
  openCreate: (
    type: MovementType,
    defaultAccountId?: string | null,
    target?: "personal" | "household",
  ) => void;
  openCreateHouseholdExpense: () => void;
  openEdit: (movement: MplusMovement) => void;
  openEditHouseholdExpense: (expense: MplusHouseholdExpense) => void;
  openTrash: (movement: MplusMovement) => void;
  openTrashHouseholdExpense: (expense: MplusHouseholdExpense) => void;
  close: () => void;
};

export const useMplusComposerStore = create<MplusComposerState>((set) => ({
  mode: { kind: "closed" },
  openCreate: (type, defaultAccountId = null, target = "personal") =>
    set({ mode: { kind: "create", type, defaultAccountId, target } }),
  openCreateHouseholdExpense: () =>
    set({
      mode: {
        kind: "create",
        type: "expense",
        defaultAccountId: null,
        target: "household",
      },
    }),
  openEdit: (movement) => set({ mode: { kind: "edit", movement } }),
  openEditHouseholdExpense: (expense) =>
    set({ mode: { kind: "edit_household_expense", expense } }),
  openTrash: (movement) => set({ mode: { kind: "trash", movement } }),
  openTrashHouseholdExpense: (expense) =>
    set({ mode: { kind: "trash_household_expense", expense } }),
  close: () => set({ mode: { kind: "closed" } }),
}));
