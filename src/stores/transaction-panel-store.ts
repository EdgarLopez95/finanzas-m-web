import { create } from "zustand";

import { isPersonalMovementEditable, isPersonalMovementDeletable } from "@/features/transactions/lib/personal-movement-mutability";
import type { Transaction } from "@/types/transaction";

export type TransactionPanelKind = "expense" | "income" | "transfer" | "edit" | "delete" | null;

type TransactionPanelState = {
  kind: TransactionPanelKind;
  transaction: Transaction | null;
  defaultAccountId: string | null;
  defaultPocketId: string | null;
  openCreate: (kind: "expense" | "income" | "transfer", defaultAccountId?: string | null, defaultPocketId?: string | null) => void;
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
  defaultPocketId: null,
  openCreate: (kind, defaultAccountId = null, defaultPocketId = null) => set({ kind, transaction: null, defaultAccountId, defaultPocketId }),
  // G3 — un movimiento inmutable (gasto no propio, transfer no propio,
  // técnico) nunca abre panel: la UI ya no ofrece la acción, y esto evita un
  // panel basura si se invoca por otra vía.
  openEdit: (transaction) => {
    if (!isPersonalMovementEditable(transaction)) return;
    set({ kind: "edit", transaction, defaultAccountId: null, defaultPocketId: null });
  },
  openDelete: (transaction) => {
    if (!isPersonalMovementDeletable(transaction)) return;
    set({ kind: "delete", transaction, defaultAccountId: null, defaultPocketId: null });
  },
  close: () => set({ kind: null, transaction: null, defaultAccountId: null, defaultPocketId: null }),
}));
