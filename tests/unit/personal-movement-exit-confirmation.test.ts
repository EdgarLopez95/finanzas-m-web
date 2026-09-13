import assert from "node:assert/strict";
import fsMod from "node:fs";
import pathMod from "node:path";

import type { MplusMovement } from "@/lib/mplus/models";
import {
  isExitBlocked,
  shouldConfirmExit,
} from "@/features/movements/lib/personal-movement-exit-policy";
import type { MplusComposerMode } from "@/stores/mplus-composer-store";

const mockMovement: MplusMovement = {
  id: "mov-test-1",
  schemaVersion: 1,
  ownerId: "user-123",
  type: "expense",
  title: "Supermercado",
  amount: 45000,
  categoryId: "cat-groceries",
  accountId: null,
  note: "",
  occurredAtMillis: Date.now(),
  lifecycleState: "active",
  trashedAtMillis: null,
  purgeAfterMillis: null,
  householdId: null,
  householdCategoryId: null,
  revision: 1,
  lastMutationId: "11111111-1111-4111-8111-111111111111",
  createdAtMillis: Date.now(),
  updatedAtMillis: Date.now(),
};

export async function runPersonalMovementExitConfirmationTests() {
  console.log("Running unit tests for personal-movement-exit-confirmation.test.ts...");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Política pura: alta limpia (sin dirty) SIEMPRE confirma salida (paridad Android f16a0b8)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const createExpenseMode: MplusComposerMode = {
      kind: "create",
      type: "expense",
      defaultAccountId: null,
    };

    assert.equal(
      shouldConfirmExit({ mode: createExpenseMode, isSubmitting: false }),
      true,
      "Alta de gasto limpia (incluso vacía) debe requerir confirmación de salida",
    );

    const createIncomeMode: MplusComposerMode = {
      kind: "create",
      type: "income",
      defaultAccountId: null,
    };

    assert.equal(
      shouldConfirmExit({ mode: createIncomeMode, isSubmitting: false }),
      true,
      "Alta de ingreso limpia (incluso vacía) debe requerir confirmación de salida",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Política pura: edición SIEMPRE confirma salida (paridad Android f16a0b8)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const editMode: MplusComposerMode = {
      kind: "edit",
      movement: mockMovement,
    };

    assert.equal(
      shouldConfirmExit({ mode: editMode, isSubmitting: false }),
      true,
      "Edición de movimiento (con o sin cambios) debe requerir confirmación de salida",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Política pura: mientras se guarda (isSubmitting = true), no se permite salir
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const createMode: MplusComposerMode = {
      kind: "create",
      type: "expense",
      defaultAccountId: null,
    };

    assert.equal(
      shouldConfirmExit({ mode: createMode, isSubmitting: true }),
      false,
      "Mientras isSubmitting está activo, no se debe procesar confirmación de salida",
    );

    assert.equal(
      isExitBlocked(true),
      true,
      "La acción de salir está bloqueada durante guardado remoto",
    );

    assert.equal(
      isExitBlocked(false),
      false,
      "La acción de salir no está bloqueada cuando no se está guardando",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Política pura: no apilar confirmaciones si el diálogo ya está abierto
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const createMode: MplusComposerMode = {
      kind: "create",
      type: "expense",
      defaultAccountId: null,
    };

    assert.equal(
      shouldConfirmExit({ mode: createMode, isSubmitting: false, isConfirmOpen: true }),
      false,
      "No se deben apilar confirmaciones de salida si el diálogo ya se encuentra visible",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Política pura: modo papelera y modo cerrado no usan este confirm
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const trashMode: MplusComposerMode = {
      kind: "trash",
      movement: mockMovement,
    };

    assert.equal(
      shouldConfirmExit({ mode: trashMode, isSubmitting: false }),
      false,
      "Modo Papelera no utiliza el diálogo genérico de descarte (tiene su propia UX)",
    );

    const closedMode: MplusComposerMode = {
      kind: "closed",
    };

    assert.equal(
      shouldConfirmExit({ mode: closedMode, isSubmitting: false }),
      false,
      "Modo cerrado no requiere confirmación",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Guardrail estructural: DiscardConfirmDialog implementa copy canónico Android
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const dialogPath = pathMod.resolve(
      __dirname,
      "../../src/components/finance/discard-confirm-dialog.tsx",
    );
    const dialogSource = fsMod.readFileSync(dialogPath, "utf8");

    assert.ok(
      dialogSource.includes('title = "¿Seguro que quieres salir?"'),
      "DiscardConfirmDialog debe tener como título por defecto '¿Seguro que quieres salir?'",
    );
    assert.ok(
      dialogSource.includes('description = "Se perderá lo que escribiste."'),
      "DiscardConfirmDialog debe tener como descripción por defecto 'Se perderá lo que escribiste.'",
    );
    assert.ok(
      dialogSource.includes('cancelButtonText = "Cancelar"'),
      "DiscardConfirmDialog debe tener como botón de cancelar/quedarse 'Cancelar'",
    );
    assert.ok(
      dialogSource.includes('exitButtonText = "Salir"'),
      "DiscardConfirmDialog debe tener como botón de salir/descartar 'Salir'",
    );

    // Escape y backdrop invocan onKeepEditing (permanecer editando sin descartar)
    assert.ok(
      dialogSource.includes("useFocusTrap(panelRef, open, onKeepEditing)"),
      "Escape debe invocar onKeepEditing (no descarta)",
    );
    assert.ok(
      dialogSource.includes("onKeepEditing();"),
      "Clic en backdrop debe invocar onKeepEditing (no descarta)",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Guardrail estructural: MovementComposerDialog aplica política sin depender de dirty
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const composerDialogPath = pathMod.resolve(
      __dirname,
      "../../src/features/movements/components/movement-composer-dialog.tsx",
    );
    const composerSource = fsMod.readFileSync(composerDialogPath, "utf8");

    assert.ok(
      composerSource.includes("shouldConfirmExit"),
      "MovementComposerDialog debe importar e invocar shouldConfirmExit",
    );
    assert.equal(
      composerSource.includes('mode.kind === "create" && isDirty'),
      false,
      "MovementComposerDialog NO debe condicionar la salida exclusivamente a isDirty",
    );
    assert.ok(
      composerSource.includes("DiscardConfirmDialog"),
      "MovementComposerDialog debe renderizar DiscardConfirmDialog",
    );
    assert.ok(
      composerSource.includes("if (showDiscardConfirm)"),
      "MovementComposerDialog debe ser no-op si la confirmación ya está abierta",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Máquina de estados: ciclo de salida y confirmación
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type State = {
      mode: MplusComposerMode;
      isDirty: boolean;
      showDiscardConfirm: boolean;
      isSubmitting: boolean;
    };

    let state: State = {
      mode: { kind: "create", type: "expense", defaultAccountId: null },
      isDirty: false,
      showDiscardConfirm: false,
      isSubmitting: false,
    };

    const handleRequestClose = () => {
      // Bugfix P1: si la confirmación ya está abierta, es no-op protector
      if (state.showDiscardConfirm) return;
      if (state.isSubmitting) return;
      if (shouldConfirmExit({
        mode: state.mode,
        isSubmitting: state.isSubmitting,
        isConfirmOpen: state.showDiscardConfirm,
      })) {
        state.showDiscardConfirm = true;
        return;
      }
      state = { ...state, mode: { kind: "closed" }, showDiscardConfirm: false, isDirty: false };
    };

    const handleKeepEditing = () => {
      state.showDiscardConfirm = false;
    };

    const handleDiscardConfirm = () => {
      state = { ...state, mode: { kind: "closed" }, showDiscardConfirm: false, isDirty: false };
    };

    // A: Alta limpia -> pedir salida abre confirm
    handleRequestClose();
    assert.equal(state.showDiscardConfirm, true, "Intento de salir abre confirmación");
    assert.equal(state.mode.kind, "create", "Composer sigue abierto");

    // A2: Bugfix P1 - con confirm abierto, nuevo intento de cierre debe ser NO-OP (no cierra ni descarta)
    handleRequestClose();
    assert.equal(state.showDiscardConfirm, true, "Confirmación sigue abierta tras segundo intento de cierre");
    assert.equal(state.mode.kind, "create", "Composer sigue en create (no se cerró por error)");

    // B: Cancelar confirmación -> composer sigue abierto
    handleKeepEditing();
    assert.equal(state.showDiscardConfirm, false, "Confirmación se cierra");
    assert.equal(state.mode.kind, "create", "Composer sigue abierto");

    // C: Confirmar salida («Salir») -> cierra composer
    handleRequestClose();
    assert.equal(state.showDiscardConfirm, true);
    handleDiscardConfirm();
    assert.equal(state.showDiscardConfirm, false);
    assert.equal(state.mode.kind, "closed", "Confirmar salida cierra el composer");

    // D: Edición -> pedir salida abre confirm
    state = {
      mode: { kind: "edit", movement: mockMovement },
      isDirty: false,
      showDiscardConfirm: false,
      isSubmitting: false,
    };
    handleRequestClose();
    assert.equal(state.showDiscardConfirm, true, "Edición abre confirmación de salida");
    handleDiscardConfirm();
    assert.equal(state.mode.kind, "closed", "Confirmar salida en edición cierra el composer");

    // E: Durante guardado (isSubmitting) -> request close es no-op
    state = {
      mode: { kind: "create", type: "expense", defaultAccountId: null },
      isDirty: true,
      showDiscardConfirm: false,
      isSubmitting: true,
    };
    handleRequestClose();
    assert.equal(state.showDiscardConfirm, false, "No abre confirm durante guardado");
    assert.equal(state.mode.kind, "create", "No cierra durante guardado");

    // F: Guardado exitoso -> closeAll directo sin confirmación
    const handleSaveSuccess = () => {
      state = { ...state, mode: { kind: "closed" }, showDiscardConfirm: false, isDirty: false, isSubmitting: false };
    };
    handleSaveSuccess();
    assert.equal(state.showDiscardConfirm, false, "Guardado exitoso no pasa por diálogo de confirmación");
    assert.equal(state.mode.kind, "closed", "Guardado exitoso cierra composer");
  }

  console.log("personal-movement-exit-confirmation.test.ts: OK");
}

if (require.main === module) {
  runPersonalMovementExitConfirmationTests().catch((err) => {
    console.error("Test failure in personal-movement-exit-confirmation.test.ts:", err);
    process.exit(1);
  });
}
