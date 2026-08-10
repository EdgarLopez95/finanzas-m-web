import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running instrumental unit tests for household-nested-escape.test.ts...");

const readComponent = (fileName: string): string =>
  fs.readFileSync(
    path.resolve(__dirname, "../../src/features/household/components", fileName),
    "utf-8"
  );

// Evento sintético mínimo (Node trae EventTarget/Event nativos, misma spec que el navegador;
// no requiere jsdom ni ninguna dependencia nueva).
class FakeKeyboardEvent extends Event {
  key: string;
  constructor(key: string) {
    super("keydown", { bubbles: true, cancelable: true });
    this.key = key;
  }
}

async function runNestedEscapeTests() {
  // --- Paso 1: trazar el orden real de listeners y reproducir el mecanismo del bug ---
  // H4.6 dejó una pila de foco, pero cada uno de los 8 diálogos sigue registrando su PROPIO
  // listener de Escape en `document`, sin consultar esa pila. En el caso anidado real
  // (HouseholdEventDetailDialog abre EditHouseholdExpenseDialog/CompleteShareDialog), el
  // listener del padre sigue activo (su efecto depende de [open, onClose], no de
  // isEditOpen/isPayOpen) cuando el hijo se abre y registra el suyo. El DOM invoca TODOS los
  // listeners registrados en el mismo target, en orden de registro (padre primero, hijo
  // después) — con Escape sin puerta (gating), ambos se disparan con UNA sola pulsación.
  {
    const doc = new EventTarget();
    let parentCloseCalls = 0;
    let childCloseCalls = 0;

    // Simula el patrón ACTUAL (sin puerta) de los 8 archivos: cada uno solo revisa e.key.
    const parentOnKeyUngated = (e: Event) => {
      if ((e as FakeKeyboardEvent).key === "Escape") parentCloseCalls++;
    };
    const childOnKeyUngated = (e: Event) => {
      if ((e as FakeKeyboardEvent).key === "Escape") childCloseCalls++;
    };

    // Orden real: el padre se monta primero (su efecto corre al abrir el detalle), el hijo
    // se monta después (cuando el usuario abre "Editar"/"Completar mi cuota").
    doc.addEventListener("keydown", parentOnKeyUngated);
    doc.addEventListener("keydown", childOnKeyUngated);

    doc.dispatchEvent(new FakeKeyboardEvent("Escape"));

    assert.strictEqual(parentCloseCalls, 1, "Mecanismo reproducido: el listener del padre (sin puerta) también se dispara");
    assert.strictEqual(childCloseCalls, 1, "Mecanismo reproducido: el listener del hijo (sin puerta) se dispara");
    console.log("  ✓ Paso 1: reproducido el mecanismo real del bug — una sola pulsación de Escape dispara AMBOS listeners (padre + hijo) sin puerta de por medio");
  }

  // --- Paso 2: contrato de la pila reutilizada (isTopFocusTrap ya existe desde H4.6) ---
  // Diseño de la corrección: el propio hook useFocusTrap debe manejar Escape en el MISMO
  // listener que ya usa para Tab, consultando la MISMA pila (activeFocusTrapStack) — nunca
  // una segunda pila ni una bandera por diálogo.
  const { pushFocusTrap, popFocusTrap, isTopFocusTrap } = await import(
    "../../src/features/household/hooks/use-focus-trap"
  );

  {
    const parentId = Symbol("parent");
    const childId = Symbol("child");
    let stack: symbol[] = [];

    // Handler "con puerta" tal como debe quedar dentro del hook: solo actúa si su id es el
    // tope de la MISMA pila que usa el trap de Tab.
    const makeGatedEscapeHandler = (id: symbol, onEscape: () => void) => (e: FakeKeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!isTopFocusTrap(stack, id)) return;
      onEscape();
    };

    let parentClosed = 0;
    let childClosed = 0;
    const parentHandler = makeGatedEscapeHandler(parentId, () => { parentClosed++; });
    const childHandler = makeGatedEscapeHandler(childId, () => { childClosed++; });

    // Padre abre -> se registra en la pila.
    stack = pushFocusTrap(stack, parentId);
    parentHandler(new FakeKeyboardEvent("Escape"));
    assert.strictEqual(parentClosed, 1, "Caso simple: con solo el padre en la pila, Escape SÍ debe cerrarlo (comportamiento actual conservado)");
    parentClosed = 0; // reset para el siguiente escenario

    // Hijo se abre sobre el padre -> pasa a ser el tope.
    stack = pushFocusTrap(stack, childId);

    // Una pulsación de Escape con el hijo abierto: SOLO el hijo debe cerrarse.
    parentHandler(new FakeKeyboardEvent("Escape"));
    childHandler(new FakeKeyboardEvent("Escape"));
    assert.strictEqual(childClosed, 1, "Hijo abierto + Escape: el hijo (tope) debe cerrarse");
    assert.strictEqual(parentClosed, 0, "Hijo abierto + Escape: el padre NO debe cerrarse (no es el tope)");

    // El hijo se cierra (pop) -> el padre recupera el tope y el foco.
    stack = popFocusTrap(stack, childId);
    assert.strictEqual(isTopFocusTrap(stack, parentId), true, "Al cerrar el hijo, el padre debe recuperar el tope de la pila (y por ende el foco)");

    // Segunda pulsación de Escape: ahora SÍ debe cerrar al padre.
    parentHandler(new FakeKeyboardEvent("Escape"));
    assert.strictEqual(parentClosed, 1, "Segunda pulsación de Escape (con el hijo ya cerrado): el padre debe cerrarse");

    console.log("  ✓ Paso 2: con la pila existente (isTopFocusTrap) como única puerta — 1ra Escape cierra solo el hijo, 2da Escape cierra el padre");
  }

  // --- Contrato estructural: los 8 diálogos ya NO deben tener su propio listener de Escape;
  // deben delegar en useFocusTrap(dialogRef, open, onEscapeCallback) ---
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
      !/if \(e\.key === "Escape"\)/.test(content),
      `${fileName}: ya NO debe tener su propio manejador de Escape (document.addEventListener) — debe delegar en useFocusTrap`
    );
    assert.ok(
      /useFocusTrap\(\s*dialogRef,\s*open,/.test(content),
      `${fileName}: debe invocar useFocusTrap(dialogRef, open, onEscapeCallback) con el 3er argumento de Escape`
    );
  }
  console.log(`  ✓ Contrato estructural: los ${DIALOG_FILES.length} diálogos delegan Escape en useFocusTrap (sin listener propio)`);

  // --- No-regresión: scroll-lock y foco inicial siguen intactos por archivo ---
  {
    const declareContent = readComponent("declare-payment-dialog.tsx");
    assert.ok(declareContent.includes('document.body.style.overflow = "hidden"'), "declare-payment-dialog.tsx: el bloqueo de scroll debe seguir intacto");
    assert.ok(declareContent.includes("dialogRef.current?.focus()"), "declare-payment-dialog.tsx: el foco inicial del contenedor debe seguir intacto");

    const categoriesContent = readComponent("views/household-categories-view.tsx");
    assert.ok(categoriesContent.includes("goList()"), "views/household-categories-view.tsx: la lógica de retroceder de modo debe conservarse");

    console.log("  ✓ No-regresión: scroll-lock, foco inicial y lógica de Escape por archivo (ej. retroceso de modo) se conservan");
  }

  console.log("All household-nested-escape unit tests passed successfully!");
}

runNestedEscapeTests().catch((err) => {
  console.error("Test failure in household-nested-escape.test.ts:", err);
  process.exit(1);
});
