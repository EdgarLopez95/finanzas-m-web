import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running instrumental unit tests for household-focus-trap.test.ts...");

const readComponent = (fileName: string): string =>
  fs.readFileSync(
    path.resolve(__dirname, "../../src/features/household/components", fileName),
    "utf-8"
  );

async function runFocusTrapTests() {
  const {
    resolveFocusTrapTarget,
    pushFocusTrap,
    popFocusTrap,
    isTopFocusTrap,
  } = await import("../../src/features/household/hooks/use-focus-trap");

  // --- resolveFocusTrapTarget: algoritmo puro de ciclo Tab/Shift+Tab ---

  // 1. Cero controles focusables: nada que ciclar, el llamador debe mantener el foco en el
  //    contenedor (tabIndex=-1) en vez de dejar escapar el foco.
  {
    const target = resolveFocusTrapTarget({
      focusableCount: 0,
      isActiveInsideContainer: false,
      isActiveFirst: false,
      isActiveLast: false,
      shiftKey: false,
    });
    assert.strictEqual(target, null, "0 focusables: no debe intentar ciclar a first/last");
    console.log("  ✓ 0 controles focusables: target null (el contenedor conserva el foco)");
  }

  // 2. Un solo control: Tab en el último (que es también el primero) debe volver a focalizar
  //    ese mismo control (loop de un elemento), igual para Shift+Tab.
  {
    const forward = resolveFocusTrapTarget({
      focusableCount: 1,
      isActiveInsideContainer: true,
      isActiveFirst: true,
      isActiveLast: true,
      shiftKey: false,
    });
    assert.strictEqual(forward, "first", "1 control, Tab: debe ciclar de vuelta al único control (first === last)");

    const backward = resolveFocusTrapTarget({
      focusableCount: 1,
      isActiveInsideContainer: true,
      isActiveFirst: true,
      isActiveLast: true,
      shiftKey: true,
    });
    assert.strictEqual(backward, "last", "1 control, Shift+Tab: debe ciclar de vuelta al único control");
    console.log("  ✓ 1 control focusable: Tab y Shift+Tab ciclan sobre el mismo control");
  }

  // 3. Múltiples controles, Tab en un control intermedio: debe dejar el comportamiento nativo
  //    del navegador (no interceptar), devolviendo null.
  {
    const target = resolveFocusTrapTarget({
      focusableCount: 5,
      isActiveInsideContainer: true,
      isActiveFirst: false,
      isActiveLast: false,
      shiftKey: false,
    });
    assert.strictEqual(target, null, "Tab en control intermedio: no debe interceptar, debe dejar el foco nativo avanzar");
    console.log("  ✓ Tab en control intermedio (no es el primero ni el último): sin intercepción");
  }

  // 4. Múltiples controles, Tab en el último: debe ciclar al primero.
  {
    const target = resolveFocusTrapTarget({
      focusableCount: 5,
      isActiveInsideContainer: true,
      isActiveFirst: false,
      isActiveLast: true,
      shiftKey: false,
    });
    assert.strictEqual(target, "first", "Tab en el último control: debe ciclar al primero");
    console.log("  ✓ Tab en el último control: cicla al primero");
  }

  // 5. Múltiples controles, Shift+Tab en el primero: debe ciclar al último.
  {
    const target = resolveFocusTrapTarget({
      focusableCount: 5,
      isActiveInsideContainer: true,
      isActiveFirst: true,
      isActiveLast: false,
      shiftKey: true,
    });
    assert.strictEqual(target, "last", "Shift+Tab en el primer control: debe ciclar al último");
    console.log("  ✓ Shift+Tab en el primer control: cicla al último");
  }

  // 6. El foco está fuera del contenedor (se escapó por algún medio externo, ej. clic
  //    programático): Tab debe traerlo de vuelta al primero; Shift+Tab, al último.
  {
    const forward = resolveFocusTrapTarget({
      focusableCount: 3,
      isActiveInsideContainer: false,
      isActiveFirst: false,
      isActiveLast: false,
      shiftKey: false,
    });
    assert.strictEqual(forward, "first", "Foco fuera del contenedor + Tab: debe recuperarlo hacia el primero");

    const backward = resolveFocusTrapTarget({
      focusableCount: 3,
      isActiveInsideContainer: false,
      isActiveFirst: false,
      isActiveLast: false,
      shiftKey: true,
    });
    assert.strictEqual(backward, "last", "Foco fuera del contenedor + Shift+Tab: debe recuperarlo hacia el último");
    console.log("  ✓ Foco fuera del contenedor: Tab/Shift+Tab lo recuperan hacia el primero/último");
  }

  // --- Pila de traps (soporte de diálogos anidados) ---

  // 7. Diálogo simple: se registra como único elemento de la pila y es el tope.
  {
    const idA = Symbol("A");
    let stack: symbol[] = [];
    stack = pushFocusTrap(stack, idA);
    assert.strictEqual(isTopFocusTrap(stack, idA), true, "Único trap registrado: debe ser el tope");
    console.log("  ✓ Diálogo simple: único trap es el tope de la pila");
  }

  // 8. Diálogo anidado: al abrir el hijo (push), SOLO el hijo debe ser el tope; el padre deja
  //    de capturar Tab mientras el hijo esté abierto.
  {
    const parent = Symbol("parent");
    const child = Symbol("child");
    let stack: symbol[] = [];
    stack = pushFocusTrap(stack, parent);
    assert.strictEqual(isTopFocusTrap(stack, parent), true, "Solo el padre abierto: el padre es el tope");

    stack = pushFocusTrap(stack, child);
    assert.strictEqual(isTopFocusTrap(stack, child), true, "Hijo abierto sobre el padre: el hijo debe ser el tope");
    assert.strictEqual(isTopFocusTrap(stack, parent), false, "Con el hijo abierto, el padre YA NO debe ser el tope (no debe capturar Tab)");

    // 9. Al cerrar el hijo (pop), el padre vuelve a ser el tope y recupera la captura de Tab.
    stack = popFocusTrap(stack, child);
    assert.strictEqual(isTopFocusTrap(stack, parent), true, "Al cerrar el hijo, el padre debe volver a ser el tope");
    console.log("  ✓ Diálogo anidado: solo el hijo (tope) captura Tab; al cerrarse, el padre recupera la captura");
  }

  // 10. Pila vacía: ningún id es el tope (caso trivial de seguridad).
  {
    assert.strictEqual(isTopFocusTrap([], Symbol("x")), false, "Pila vacía: ningún trap es el tope");
    console.log("  ✓ Pila vacía: ningún trap es el tope (caso trivial)");
  }

  // --- Contrato de integración estructural: los 8 diálogos de Hogar deben usar el hook ---
  const DIALOG_FILES = [
    "declare-payment-dialog.tsx",
    "confirm-reception-dialog.tsx",
    "complete-share-dialog.tsx",
    "create-household-expense-dialog.tsx",
    "edit-household-expense-dialog.tsx",
    "household-event-detail-dialog.tsx",
  ];

  for (const fileName of DIALOG_FILES) {
    const content = readComponent(fileName);
    assert.ok(
      content.includes('from "@/features/household/hooks/use-focus-trap"') ||
        content.includes("use-focus-trap"),
      `${fileName}: debe importar el hook useFocusTrap`
    );
    assert.ok(
      content.includes("useFocusTrap(dialogRef,"),
      `${fileName}: debe invocar useFocusTrap(dialogRef, open) para atrapar el foco del modal`
    );
  }
  console.log(`  ✓ Contrato de integración: los ${DIALOG_FILES.length} diálogos de Hogar invocan useFocusTrap`);

  // --- No-regresión: lógica de Escape y scroll-lock por archivo deben permanecer intactos ---
  // Nota H4.7: la lógica de Escape de household-categories-dialog.tsx (retroceder de modo antes
  // de cerrar) ya no vive en un listener propio de document — se relocalizó al callback
  // onEscape que recibe useFocusTrap (ver tests/unit/household-nested-escape.test.ts). Se
  // sigue verificando aquí que esa lógica (goList()) no se haya perdido en la relocalización.
  {
    const categoriesContent = readComponent("views/household-categories-view.tsx");
    assert.ok(
      categoriesContent.includes("goList()"),
      "views/household-categories-view.tsx: la lógica de Escape debe seguir intacta"
    );
    const eventDetailContent = readComponent("household-event-detail-dialog.tsx");
    assert.ok(
      eventDetailContent.includes('document.body.style.overflow = "hidden"'),
      "household-event-detail-dialog.tsx: el bloqueo de scroll debe seguir intacto"
    );
    console.log("  ✓ No-regresión: lógica de Escape (relocalizada a onEscape) y bloqueo de scroll por archivo permanecen intactos");
  }

  console.log("All household-focus-trap unit tests passed successfully!");
}

runFocusTrapTests().catch((err) => {
  console.error("Test failure in household-focus-trap.test.ts:", err);
  process.exit(1);
});
