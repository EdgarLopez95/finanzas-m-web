import { create } from "zustand";

import type { Transaction } from "@/types/transaction";

export type TransactionPanelKind = "expense" | "income" | "transfer" | "edit" | "delete" | null;

type TransactionPanelState = {
  kind: TransactionPanelKind;
  transaction: Transaction | null;
  defaultAccountId: string | null;
  openCreate: (kind: "expense" | "income" | "transfer", defaultAccountId?: string | null) => void;
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
  defaultAccountId: null,
  openCreate: (kind, defaultAccountId = null) => set({ kind, transaction: null, defaultAccountId }),
  openEdit: (transaction) => set({ kind: "edit", transaction, defaultAccountId: null }),
  openDelete: (transaction) => set({ kind: "delete", transaction, defaultAccountId: null }),
  close: () => set({ kind: null, transaction: null, defaultAccountId: null }),
}));
