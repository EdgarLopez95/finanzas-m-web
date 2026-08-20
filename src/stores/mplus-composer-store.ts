import { create } from "zustand";

import type { MovementType } from "@/lib/mplus/enums";
import type { MplusMovement } from "@/lib/mplus/models";

/**
 * Estado del composer de movimientos del contrato v1.
 *
 * Es un store propio, separado de `transaction-panel-store`: aquel transporta
 * el `Transaction` legacy y sigue sirviendo a las superficies que todavia no
 * migran (regla 6 de `docs/12`). Mezclar los dos modelos en un mismo store
 * obligaria a que cada consumidor supiera de que universo viene el documento.
 *
 * Solo hay tres modos, porque solo hay tres acciones del dueño sobre un
 * movimiento: crear, editar y enviar a la Papelera.
 */

export type MplusComposerMode =
  | Readonly<{ kind: "closed" }>
  | Readonly<{ kind: "create"; type: MovementType; defaultAccountId: string | null }>
  | Readonly<{ kind: "edit"; movement: MplusMovement }>
  | Readonly<{ kind: "trash"; movement: MplusMovement }>;

type MplusComposerState = {
  mode: MplusComposerMode;
  openCreate: (type: MovementType, defaultAccountId?: string | null) => void;
  openEdit: (movement: MplusMovement) => void;
  openTrash: (movement: MplusMovement) => void;
  close: () => void;
};

export const useMplusComposerStore = create<MplusComposerState>((set) => ({
  mode: { kind: "closed" },
  openCreate: (type, defaultAccountId = null) =>
    set({ mode: { kind: "create", type, defaultAccountId } }),
  openEdit: (movement) => set({ mode: { kind: "edit", movement } }),
  openTrash: (movement) => set({ mode: { kind: "trash", movement } }),
  close: () => set({ mode: { kind: "closed" } }),
}));
