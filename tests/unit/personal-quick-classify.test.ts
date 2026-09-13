import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

import type {
  MplusMovement,
  MplusPersonalCategory,
} from "../../src/lib/mplus/models";
import { updateMovementPersonalCategory } from "../../src/features/movements/services/movement-mutations";
import { filterPersonalUnclassifiedMovements } from "../../src/features/movements/lib/personal-quick-classify";

console.log("Running unit tests for personal-quick-classify.test.ts (ORQ-054)...");

export const runPersonalQuickClassifyTests = async () => {
  let passed = 0;

  // Firestore local para construir referencias
  const db: Firestore = getFirestore(
    initializeApp({ apiKey: "dummy", projectId: "dummy" }, "mplus-personal-qc-test-" + Date.now()),
  );

  const currentUid = "user_felipe";
  const partnerUid = "user_camila";

  const personalCatFood: MplusPersonalCategory = {
    id: "pcat_food",
    schemaVersion: 1,
    ownerId: currentUid,
    name: "Alimentación",
    iconKey: "utensils",
    color: "#10B981",
    state: "active",
    type: "expense",
    seedKey: "food",
    sortOrder: 1,
    revision: 1,
    lastMutationId: "mut_cat_1",
    createdAtMillis: 1000,
    updatedAtMillis: 1000,
  };

  const personalCatTransport: MplusPersonalCategory = {
    id: "pcat_transport",
    schemaVersion: 1,
    ownerId: currentUid,
    name: "Transporte",
    iconKey: "car",
    color: "#3B82F6",
    state: "active",
    type: "expense",
    seedKey: "transport",
    sortOrder: 2,
    revision: 1,
    lastMutationId: "mut_cat_2",
    createdAtMillis: 1000,
    updatedAtMillis: 1000,
  };

  const archivedCategory: MplusPersonalCategory = {
    id: "pcat_archived",
    schemaVersion: 1,
    ownerId: currentUid,
    name: "Vieja",
    iconKey: "tag",
    color: "#94A3B8",
    state: "archived",
    type: "expense",
    seedKey: null,
    sortOrder: 3,
    revision: 1,
    lastMutationId: "mut_cat_3",
    createdAtMillis: 1000,
    updatedAtMillis: 1000,
  };

  // ── 1. Filtrado exclusivo de derivadas propias sin clasificar ───────────────
  // Movimiento 1: Derivada propia activa de Hogar SIN categoría (DEBE ENTRAR)
  const validUnclassifiedDerivation: MplusMovement = {
    id: "mov_unclass_1",
    schemaVersion: 1,
    ownerId: currentUid,
    type: "expense",
    title: "Mercado D1",
    amount: 85000,
    occurredAtMillis: 1700000000000,
    lifecycleState: "active",
    origin: "household_expense",
    householdId: null,
    householdExpenseId: "hexp_001",
    householdCategoryId: null,
    categoryId: null,
    accountId: null,
    note: "Compra quincenal",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    revision: 1,
    lastMutationId: "mut_001",
    createdAtMillis: 1700000000000,
    updatedAtMillis: 1700000000000,
  };

  // Movimiento 2: Derivada propia activa de Hogar YA clasificada (NO ENTRA)
  const alreadyClassifiedDerivation: MplusMovement = {
    ...validUnclassifiedDerivation,
    id: "mov_classified",
    categoryId: "pcat_food",
  };

  // Movimiento 3: Derivada en papelera (NO ENTRA)
  const trashedDerivation: MplusMovement = {
    ...validUnclassifiedDerivation,
    id: "mov_trashed",
    lifecycleState: "trashed",
    trashedAtMillis: 1700000000000,
    purgeAfterMillis: 1700000000000 + 30 * 24 * 60 * 60 * 1000,
  };

  // Movimiento 4: Movimiento directo de Personal sin categoría (NO ENTRA, origin no es household_expense)
  const directPersonalMovement: MplusMovement = {
    ...validUnclassifiedDerivation,
    id: "mov_direct",
    origin: "personal",
    householdExpenseId: null,
  };

  // Movimiento 5: Movimiento de otro usuario (NO ENTRA)
  const partnerMovement: MplusMovement = {
    ...validUnclassifiedDerivation,
    id: "mov_partner",
    ownerId: partnerUid,
  };

  const candidateMovements = [
    validUnclassifiedDerivation,
    alreadyClassifiedDerivation,
    trashedDerivation,
    directPersonalMovement,
    partnerMovement,
  ];

  const filtered = filterPersonalUnclassifiedMovements(candidateMovements, currentUid);
  assert.equal(filtered.length, 1, "Solo debe retornar exactamente la derivada propia activa sin categoría");
  assert.equal(filtered[0].id, "mov_unclass_1");
  passed++;
  console.log("  ✓ [ORQ-054-01] filterPersonalUnclassifiedMovements filtra exclusivamente derivadas activas propias sin categoría");

  // ── 2. Mutación updateMovementPersonalCategory modifica solo categoryId ───
  let committedMovement: MplusMovement | null = null;
  const mockDeps = {
    runTransaction: async <T>(_db: Firestore, updateFn: (tx: any) => Promise<T>): Promise<T> => {
      const mockTx = {
        get: async () => ({
          exists: () => true,
          data: () => ({ revision: validUnclassifiedDerivation.revision }),
        }),
        set: (_ref: any, data: any) => {
          committedMovement = data;
        },
      };
      return updateFn(mockTx);
    },
  };

  const mutResult = await updateMovementPersonalCategory(
    validUnclassifiedDerivation,
    "pcat_food",
    { db, deps: mockDeps as any },
  );

  assert.equal(mutResult.kind, "success", "La mutación debe completarse con éxito");
  if (mutResult.kind === "success") {
    const committed = (mutResult as any).value ?? (mutResult as any).data;
    assert.equal(committed.categoryId, "pcat_food", "Debe actualizar categoryId a pcat_food");
    assert.equal(committed.id, validUnclassifiedDerivation.id, "Conserva id");
    assert.equal(committed.amount, validUnclassifiedDerivation.amount, "Conserva amount");
    assert.equal(committed.title, validUnclassifiedDerivation.title, "Conserva title");
    assert.equal(committed.origin, "household_expense", "Conserva origin");
    assert.equal(committed.householdExpenseId, "hexp_001", "Conserva householdExpenseId");
    assert.equal(committed.ownerId, currentUid, "Conserva ownerId");
    assert.equal(committed.revision, validUnclassifiedDerivation.revision + 1, "Incrementa revision");
  }
  passed++;
  console.log("  ✓ [ORQ-054-02] updateMovementPersonalCategory actualiza exclusivamente categoryId sin alterar datos compartidos");

  // ── 3. Estructura y frontera visual de PersonalQuickClassifyDialog ───────────
  const dialogPath = path.resolve(
    __dirname,
    "../../src/features/movements/components/personal-quick-classify-dialog.tsx",
  );
  assert.ok(fs.existsSync(dialogPath), "Debe existir personal-quick-classify-dialog.tsx");
  const dialogSource = fs.readFileSync(dialogPath, "utf8");

  // No debe contener tokens de hogar ni componentes de hogar
  assert.ok(!dialogSource.includes("--hh-"), "No debe contener tokens visuales de Hogar (--hh-*)");
  assert.ok(!dialogSource.includes("HouseholdButton"), "No debe usar HouseholdButton");
  assert.ok(!dialogSource.includes("HouseholdDialog"), "No debe usar HouseholdDialog");
  assert.ok(!dialogSource.includes("HouseholdAmount"), "No debe usar HouseholdAmount");
  assert.ok(dialogSource.includes("FinanceDialog") || dialogSource.includes("FinanceButton") || dialogSource.includes("--fm-"), "Debe usar tokens o componentes de Personal");
  assert.ok(dialogSource.includes("updateMovementPersonalCategory"), "Debe usar updateMovementPersonalCategory");
  passed++;
  console.log("  ✓ [ORQ-054-03] PersonalQuickClassifyDialog respeta tokens de Personal y no reutiliza componentes de Hogar");

  // ── 4. Integración en Inicio Personal (personal-home-view.tsx) ──────────────
  const homeViewPath = path.resolve(
    __dirname,
    "../../src/features/movements/components/personal-home-view.tsx",
  );
  const homeViewSource = fs.readFileSync(homeViewPath, "utf8");
  assert.ok(
    homeViewSource.includes("PersonalQuickClassifyDialog"),
    "personal-home-view.tsx debe importar y montar PersonalQuickClassifyDialog",
  );
  assert.ok(
    homeViewSource.includes("onSelectCategory"),
    "personal-home-view.tsx debe pasar onSelectCategory a PersonalCategoryChart para interceptar 'unclassified'",
  );
  passed++;
  console.log("  ✓ [ORQ-054-04] personal-home-view.tsx conecta el diálogo de clasificación rápida Personal");

  // ── 6. Comportamiento de navegación vs diálogo en Inicio Personal ─────────
  assert.ok(
    homeViewSource.includes("setIsQuickClassifyOpen(true)") &&
      homeViewSource.includes("router.push"),
    "Inicio Personal debe abrir el diálogo para Por clasificar y llamar a router.push para categorías normales",
  );
  passed++;
  console.log("  ✓ [ORQ-054-06] Inicio Personal bifurca: Por clasificar abre diálogo, categorías clasificadas navegan");

  // ── 7. Estado vacío seguro, cierre y manejo de errores en el diálogo ───────
  assert.ok(
    dialogSource.includes("¡Todo al día!"),
    "El diálogo debe incluir estado vacío seguro ('¡Todo al día!')",
  );
  assert.ok(
    dialogSource.includes("role=\"alert\""),
    "El diálogo debe manejar errores de guardado con rol accesible role='alert'",
  );
  assert.ok(
    dialogSource.includes("pendingMovements.length <= 1") && dialogSource.includes("onClose()"),
    "El diálogo debe invocar onClose() al clasificar el último elemento",
  );
  passed++;
  console.log("  ✓ [ORQ-054-07] PersonalQuickClassifyDialog contempla cierre al terminar, estado vacío seguro y alert de error");

  // ── 8. Aislamiento de datos: mutación rechaza movimientos no derivados ─────
  await assert.rejects(
    () => updateMovementPersonalCategory(directPersonalMovement, "pcat_food", { db }),
    /exclusiva para derivaciones originadas en Hogar/,
    "La mutación debe rechazar movimientos que no provengan de un gasto de Hogar",
  );
  passed++;
  console.log("  ✓ [ORQ-054-08] updateMovementPersonalCategory rechaza movimientos ajenos o directos, protegiendo fuentes de Hogar");

  console.log(`\nTests for personal-quick-classify: ${passed} passed, 0 failed\n`);
};

if (require.main === module) {
  runPersonalQuickClassifyTests().catch((err) => {
    console.error("Test failure in personal-quick-classify.test.ts:", err);
    process.exit(1);
  });
}
