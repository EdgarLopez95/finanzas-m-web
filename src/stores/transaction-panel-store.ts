import { create } from "zustand";

import type { Transaction } from "@/types/transaction";

export type TransactionPanelKind = "expense" | "income" | "transfer" | "edit" | "delete" | null;

type TransactionPanelState = {
  kind: TransactionPanelKind;
  transaction: Transaction | null;
  openCreate: (kind: "expense" | "income" | "transfer") => void;
  openEdit: (transaction: Transaction) => void;
  openDelete: (transaction: Transaction) => void;
  close: () => void;
};

/**
 * Estado del panel de creación/edición/eliminación de movimientos. Vive en un
 * store para que el botón "Nuevo" del topbar (en el layout) y las filas de
 * movimientos (en las páginas) compartan el mismo panel sin prop drilling.
 */
export const useTransactionPanelStore = create<TransactionPanelState>((set) => ({
  kind: null,
  transaction: null,
  openCreate: (kind) => set({ kind, transaction: null }),
  openEdit: (transaction) => set({ kind: "edit", transaction }),
  openDelete: (transaction) => set({ kind: "delete", transaction }),
  close: () => set({ kind: null, transaction: null }),
}));
