import assert from "node:assert/strict";

import {
  resolveCompleteShareSuggestionEffect,
  type SuggestionCandidateCategory,
} from "../../src/features/household/lib/resolve-suggested-personal-category";

console.log("Running unit tests for complete-share-suggestion-effect.test.ts...");

const cat = (over: Partial<SuggestionCandidateCategory> & { id: string; name: string }): SuggestionCandidateCategory => ({
  type: "expense",
  archived: false,
  iconKey: undefined,
  ...over,
});

/**
 * Simula la secuencia real de un usuario nuevo: `useEffect` se re-ejecuta en
 * cada tick con el `expenseCategories`/`personalStatus` vigentes y el
 * `alreadyApplied` acumulado del tick anterior (igual que `suggestionAppliedRef`
 * en el componente real). Cada llamada a este helper es UN tick del efecto.
 */
function runEffectTicks(
  ticks: Array<Omit<Parameters<typeof resolveCompleteShareSuggestionEffect>[0], "alreadyApplied">>,
) {
  let alreadyApplied = false;
  let categoryId = "";
  const results: ReturnType<typeof resolveCompleteShareSuggestionEffect>[] = [];

  for (const tick of ticks) {
    const step = resolveCompleteShareSuggestionEffect({ ...tick, alreadyApplied });
    results.push(step);
    if (step.shouldApply) {
      categoryId = step.categoryId;
      alreadyApplied = true;
    }
  }

  return { results, finalCategoryId: categoryId, finalApplied: alreadyApplied };
}

async function runCompleteShareSuggestionEffectTests() {
  // Test 1: diálogo abierto con categorías de gasto vacías -> la sugerencia NO se considera aplicada.
  {
    const step = resolveCompleteShareSuggestionEffect({
      open: true,
      personalStatus: "success",
      expenseCategories: [],
      householdCategoryName: "Mercado",
      householdCategoryIconKey: "groceries",
      alreadyApplied: false,
    });
    assert.strictEqual(step.shouldApply, false, "Con expenseCategories vacío, el efecto no debe marcarse como aplicado todavía");

    console.log("  ✓ Test 1: categorías de gasto vacías -> sugerencia NO se considera aplicada");
  }

  // Test 2 y 3: reproduce la secuencia exacta del bug confirmado -> tras llegar las categorías seed,
  // "Mercado" (Hogar) sugiere "Mercado" (Personal) y el id se aplica.
  {
    const { results, finalCategoryId, finalApplied } = runEffectTicks([
      // Tick 1: primera lectura Personal ya resuelta (status success) pero el seed todavía no corrió -> 0 categorías.
      { open: true, personalStatus: "success", expenseCategories: [], householdCategoryName: "Mercado", householdCategoryIconKey: "groceries" },
      // Tick 2: el seed ya creó las 16 categorías de gasto (incluida "Mercado"/"groceries").
      {
        open: true,
        personalStatus: "success",
        expenseCategories: [
          cat({ id: "p-mercado", name: "Mercado", iconKey: "groceries" }),
          cat({ id: "p-otros", name: "Otros" }),
        ],
        householdCategoryName: "Mercado",
        householdCategoryIconKey: "groceries",
      },
    ]);

    assert.strictEqual(results[0].shouldApply, false, "Tick 1 (categorías aún vacías) no debe aplicar nada");
    assert.strictEqual(results[1].shouldApply, true, "Tick 2 (categorías ya disponibles) debe aplicar la sugerencia");
    assert.strictEqual(finalCategoryId, "p-mercado", '"Mercado" (Hogar) debe sugerir "Mercado" (Personal) tras llegar las categorías seed');
    assert.strictEqual(finalApplied, true);

    console.log('  ✓ Test 2/3: tras llegar las categorías seed, "Mercado" sugiere "Mercado" y se aplica su id');
  }

  // Test 4: si ya había categorías y ninguna coincide, deja categoryId vacío y NO reevalúa en actualizaciones posteriores.
  {
    const { results, finalCategoryId } = runEffectTicks([
      // Tick 1: categorías ya disponibles, ninguna coincide con la categoría Hogar.
      {
        open: true,
        personalStatus: "success",
        expenseCategories: [cat({ id: "p-travel", name: "Viajes / paseos" }), cat({ id: "p-pets", name: "Mascota" })],
        householdCategoryName: "Otros hogar",
        householdCategoryIconKey: "other",
      },
      // Tick 2: llega una recarga con una categoría que SÍ coincidiría exacto -> no debe reevaluar.
      {
        open: true,
        personalStatus: "success",
        expenseCategories: [
          cat({ id: "p-travel", name: "Viajes / paseos" }),
          cat({ id: "p-pets", name: "Mascota" }),
          cat({ id: "p-otros-hogar", name: "Otros hogar", iconKey: "other" }),
        ],
        householdCategoryName: "Otros hogar",
        householdCategoryIconKey: "other",
      },
    ]);

    assert.strictEqual(results[0].shouldApply, true, "Tick 1 debe evaluar (categorías ya disponibles) y no encontrar coincidencia suficiente");
    assert.strictEqual(results[0].categoryId, "", "Sin coincidencia >= 70, categoryId debe quedar vacío");
    assert.strictEqual(results[1].shouldApply, false, "Tick 2 no debe reevaluar: la decisión ya quedó aplicada en el tick 1");
    assert.strictEqual(finalCategoryId, "", "categoryId debe seguir vacío tras la recarga posterior");

    console.log("  ✓ Test 4: sin coincidencia deja categoryId vacío y no reevalúa en actualizaciones posteriores");
  }

  // Test 5: si la persona selecciona manualmente una categoría tras la sugerencia, una actualización
  // posterior (nuevas categorías, cambio de status) no la sobrescribe.
  {
    let alreadyApplied = false;

    const firstTick = resolveCompleteShareSuggestionEffect({
      open: true,
      personalStatus: "success",
      expenseCategories: [cat({ id: "p-mercado", name: "Mercado", iconKey: "groceries" })],
      householdCategoryName: "Mercado",
      householdCategoryIconKey: "groceries",
      alreadyApplied,
    });
    assert.strictEqual(firstTick.shouldApply, true);
    alreadyApplied = true;
    let categoryId = firstTick.categoryId; // "p-mercado" (sugerido)

    // La persona cambia manualmente la selección (fuera de este efecto, vía onChange).
    categoryId = "p-otra-elegida-a-mano";

    // Una actualización posterior (nuevas categorías, recarga) no debe volver a tocar categoryId.
    const secondTick = resolveCompleteShareSuggestionEffect({
      open: true,
      personalStatus: "success",
      expenseCategories: [
        cat({ id: "p-mercado", name: "Mercado", iconKey: "groceries" }),
        cat({ id: "p-nueva", name: "Categoría nueva llegada por recarga" }),
      ],
      householdCategoryName: "Mercado",
      householdCategoryIconKey: "groceries",
      alreadyApplied,
    });

    assert.strictEqual(secondTick.shouldApply, false, "Tras aplicar una vez, una recarga posterior no debe sobrescribir la selección manual");
    assert.strictEqual(categoryId, "p-otra-elegida-a-mano", "La selección manual del usuario debe permanecer intacta");

    console.log("  ✓ Test 5: selección manual posterior a la sugerencia no es sobrescrita por actualizaciones posteriores");
  }

  console.log("All complete-share-suggestion-effect unit tests passed successfully!");
}

runCompleteShareSuggestionEffectTests().catch((err) => {
  console.error("Test failure in complete-share-suggestion-effect.test.ts:", err);
  process.exit(1);
});
