import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runPersonalMovementDetailTests = () => {
  console.log("Running unit tests for personal-movement-detail.test.ts...");
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`  ✗ ${name}`);
      console.error(error);
      failed++;
    }
  };

  const readSource = (relativePath: string): string =>
    readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");

  // --- Bloque 1: Diálogo de Detalle Personal (personal-movement-detail-dialog.tsx) ---

  test("WA-PER-DET-001: [Estructural] PersonalMovementDetailDialog usa FinanceDialog y tokens Personal sin tocar Hogar", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    assert.ok(source.includes("FinanceDialog"), "Debe usar FinanceDialog");
    assert.ok(source.includes("FinanceButton"), "Debe usar FinanceButton");
    assert.ok(source.includes("Amount"), "Debe usar Amount para montos");
    assert.equal(
      source.includes("HouseholdDialog"),
      false,
      "No debe usar HouseholdDialog en Personal",
    );
    assert.equal(
      source.includes("@/features/household"),
      false,
      "No debe importar nada de features/household",
    );
    assert.equal(
      source.includes("--hh-"),
      false,
      "No debe contener tokens --hh-* de Hogar",
    );
  });

  test("WA-PER-DET-002: [Estructural] PersonalMovementDetailDialog recibe el modelo MplusMovement vigente y renderiza campos completos", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    // Modelo MplusMovement
    assert.ok(source.includes("movement: MplusMovement"), "Debe recibir MplusMovement");
    assert.equal(
      source.includes("PersonalTransaction") || source.includes("TransactionLegacy"),
      false,
      "No debe usar modelos legacy",
    );

    // Campos: Categoría, Cuenta, Nota, Fecha, Tipo, Destino Hogar
    assert.ok(source.includes("Categoría"), "Debe mostrar sección de Categoría");
    assert.ok(source.includes("Cuenta"), "Debe mostrar sección de Cuenta");
    assert.ok(source.includes("movement.note"), "Debe soportar nota opcional");
    assert.ok(source.includes("formatDateEs"), "Debe formatear fecha");
    assert.ok(source.includes("movement.type"), "Debe discriminar tipo ingreso/gasto");
    assert.ok(source.includes("Cuenta en Hogar"), "Debe indicar 'Cuenta en Hogar' cuando está compartido");
    assert.ok(source.includes("Solo personal"), "Debe indicar 'Solo personal' cuando no está compartido");
  });

  test("WA-PER-DET-003: [Montos] Muestra el monto con Amount y sin la preferencia retirada de ocultar saldos", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    assert.ok(source.includes("<Amount"), "Debe renderizar el monto con el componente Amount");
    assert.equal(
      source.includes("masked"),
      false,
      "El detalle no puede conservar la prop retirada masked",
    );
  });

  test("WA-PER-DET-004: [Acciones] Acciones Editar y Eliminar invocan onEdit y onDelete cerrando el diálogo", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    assert.ok(source.includes("onEdit(movement)"), "Debe invocar onEdit(movement)");
    assert.ok(source.includes("onDelete(movement)"), "Debe invocar onDelete(movement)");
    assert.ok(source.includes("onClose()"), "Debe invocar onClose()");
  });

  // --- Bloque 2: Integración en movements-view.tsx y personal-transaction-row.tsx ---

  test("WA-PER-DET-005: [Integración] MplusMovementsView conecta onSelect en modo activo y lo desactiva en Papelera", () => {
    const source = readSource("src/features/movements/components/movements-view.tsx");

    assert.ok(
      source.includes("onSelect={mode === \"active\" ? () => setSelectedMovement(movement) : undefined}"),
      "Debe asignar onSelect solo cuando mode === 'active'",
    );
    assert.ok(
      source.includes("<PersonalMovementDetailDialog"),
      "Debe montar PersonalMovementDetailDialog",
    );
    assert.ok(
      source.includes("openEdit(mov)"),
      "Debe delegar la edición a openEdit del composer store",
    );
    assert.ok(
      source.includes("openTrash(mov)"),
      "Debe delegar la eliminación a openTrash del composer store",
    );
  });

  test("WA-PER-DET-006: [Accesibilidad y Semántica] PersonalTransactionRow ofrece botón accesible sin anidar botones", () => {
    const source = readSource("src/components/finance/personal-transaction-row.tsx");

    assert.ok(
      source.includes("aria-label={`Ver detalle de ${row.title}`}"),
      "El botón de la fila debe tener aria-label descriptivo para lectores de pantalla",
    );
    assert.ok(
      source.includes("focus-visible:ring-[var(--fm-pending)]"),
      "Debe tener anillo de foco visible accesible",
    );
    // El actionSlot (dropdown con botones) debe estar fuera del botón de selección
    const selectButtonIndex = source.indexOf("<button");
    const actionSlotIndex = source.indexOf("{actionSlot}");
    const buttonCloseIndex = source.indexOf("</button>");

    assert.ok(selectButtonIndex !== -1, "Debe existir <button");
    assert.ok(buttonCloseIndex !== -1, "Debe existir </button>");
    assert.ok(
      actionSlotIndex > buttonCloseIndex,
      "El actionSlot debe renderizarse fuera del botón interactivo para evitar botones anidados",
    );
  });

  console.log(`\nTests for personal-movement-detail: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalMovementDetailTests();
