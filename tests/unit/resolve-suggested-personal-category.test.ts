import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  resolveSuggestedPersonalCategoryForPending,
  categorySuggestionScore,
  type SuggestionCandidateCategory,
} from "../../src/features/household/lib/resolve-suggested-personal-category";

console.log("Running unit tests for resolve-suggested-personal-category.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

const cat = (over: Partial<SuggestionCandidateCategory> & { id: string; name: string }): SuggestionCandidateCategory => ({
  type: "expense",
  archived: false,
  iconKey: undefined,
  ...over,
});

async function runResolveSuggestedPersonalCategoryTests() {
  // Test 1: coincidencia exacta devuelve la categoría personal correcta.
  {
    const personalCategories = [
      cat({ id: "p-travel", name: "Viajes / paseos" }),
      cat({ id: "p-mercado", name: "Mercado" }),
      cat({ id: "p-other", name: "Otros" }),
    ];
    const result = resolveSuggestedPersonalCategoryForPending("Mercado", "groceries", personalCategories);
    assert.ok(result, "Debe encontrar una sugerencia");
    assert.strictEqual(result!.id, "p-mercado");

    console.log("  ✓ Test 1: coincidencia exacta devuelve la categoría personal correcta");
  }

  // Test 2: "Servicios del hogar" sugiere "Servicios" por contención.
  {
    const personalCategories = [
      cat({ id: "p-other", name: "Otros" }),
      cat({ id: "p-servicios", name: "Servicios" }),
      cat({ id: "p-travel", name: "Viajes / paseos" }),
    ];
    const result = resolveSuggestedPersonalCategoryForPending("Servicios del hogar", "bills", personalCategories);
    assert.ok(result, "Debe encontrar una sugerencia por contención");
    assert.strictEqual(result!.id, "p-servicios");

    console.log('  ✓ Test 2: "Servicios del hogar" sugiere "Servicios" por contención');
  }

  // Test 3: coincidencia de tokens con tildes y puntuación se normaliza correctamente.
  {
    const personalCategories = [cat({ id: "p-educacion", name: "Educacion" })];
    // Tilde + coma en el nombre Hogar: debe normalizarse a la misma key que "Educacion".
    const result = resolveSuggestedPersonalCategoryForPending("Educación,", "education", personalCategories);
    assert.ok(result, "Debe normalizar tildes y puntuación antes de comparar");
    assert.strictEqual(result!.id, "p-educacion");

    // Verificación directa del score: con tilde/puntuación la key debe coincidir igual que sin ellas (100).
    const scoreWithAccentsAndPunctuation = categorySuggestionScore(
      "Educación,",
      "education",
      cat({ id: "p-educacion", name: "Educacion" }),
    );
    assert.strictEqual(scoreWithAccentsAndPunctuation, 100);

    console.log("  ✓ Test 3: tildes y puntuación se normalizan correctamente antes de comparar");
  }

  // Test 4: iconKey igual añade exactamente +12.
  {
    // Nombres sin ninguna relación de key/tokens -> score base 0.
    const candidateNoIcon = cat({ id: "p-alimentos", name: "Alimentos", iconKey: undefined });
    const scoreNoIconMatch = categorySuggestionScore("Mercado", "groceries", candidateNoIcon);
    assert.strictEqual(scoreNoIconMatch, 0, "Sin relación de key/tokens ni iconKey, el score base debe ser 0");

    const candidateWithIcon = cat({ id: "p-alimentos", name: "Alimentos", iconKey: "groceries" });
    const scoreWithIconMatch = categorySuggestionScore("Mercado", "groceries", candidateWithIcon);
    assert.strictEqual(scoreWithIconMatch, scoreNoIconMatch + 12, "El iconKey coincidente debe sumar exactamente +12");
    assert.strictEqual(scoreWithIconMatch, 12);

    // iconKey debe compararse sin distinguir mayúsculas.
    const candidateWithIconUpper = cat({ id: "p-alimentos", name: "Alimentos", iconKey: "GROCERIES" });
    const scoreWithIconUpper = categorySuggestionScore("Mercado", "groceries", candidateWithIconUpper);
    assert.strictEqual(scoreWithIconUpper, 12, "La comparación de iconKey no debe distinguir mayúsculas");

    console.log("  ✓ Test 4: iconKey coincidente suma exactamente +12 (sin distinguir mayúsculas)");
  }

  // Test 5: un caso bajo 70 devuelve null.
  {
    const personalCategories = [
      cat({ id: "p-travel", name: "Viajes / paseos" }),
      cat({ id: "p-pets", name: "Mascota" }),
    ];
    const result = resolveSuggestedPersonalCategoryForPending("Otros hogar", "other", personalCategories);
    assert.strictEqual(result, null, "Sin ninguna coincidencia razonable, debe devolver null");

    console.log("  ✓ Test 5: caso bajo el umbral de 70 devuelve null");
  }

  // Test 6: ignora ingresos y categorías archivadas.
  {
    const personalCategories = [
      cat({ id: "p-income-exact", name: "Mercado", type: "income" }), // coincidencia exacta pero es ingreso -> debe ignorarse
      cat({ id: "p-archived-exact", name: "Mercado", type: "expense", archived: true }), // exacta pero archivada -> debe ignorarse
      cat({ id: "p-valid", name: "Mercado" }), // única candidata válida
    ];
    const result = resolveSuggestedPersonalCategoryForPending("Mercado", "groceries", personalCategories);
    assert.ok(result, "Debe encontrar la candidata válida (activa, de gasto)");
    assert.strictEqual(result!.id, "p-valid", "Debe ignorar el ingreso y la categoría archivada aunque coincidan exacto");

    console.log("  ✓ Test 6: ignora categorías de ingreso y archivadas aunque coincidan exacto");
  }

  // Test 7: empates siguen un criterio estable (primer elemento en el orden de entrada).
  {
    const personalCategories = [
      cat({ id: "p-first", name: "Mercado" }),
      cat({ id: "p-second", name: "Mercado" }),
    ];
    const result = resolveSuggestedPersonalCategoryForPending("Mercado", "groceries", personalCategories);
    assert.ok(result);
    assert.strictEqual(result!.id, "p-first", "En empate exacto, debe devolver el primer elemento en el orden recibido");

    // Reordenar la lista invierte cuál gana, confirmando que el criterio es el ORDEN de entrada, no el ID.
    const reordered = [
      cat({ id: "p-second", name: "Mercado" }),
      cat({ id: "p-first", name: "Mercado" }),
    ];
    const reorderedResult = resolveSuggestedPersonalCategoryForPending("Mercado", "groceries", reordered);
    assert.strictEqual(reorderedResult!.id, "p-second", "El desempate debe seguir el orden de entrada, no un ID fijo");

    console.log("  ✓ Test 7: empates resueltos de forma estable por orden de entrada (documentado)");
  }

  // Test 8: el diálogo recibe SOLO nombre e iconKey de la categoría Hogar (no el objeto completo, no otros datos).
  {
    const dialogSrc = readSrc("features/household/components/complete-share-dialog.tsx");
    assert.match(dialogSrc, /householdCategoryName\??:\s*string/, "CompleteShareDialog debe declarar la prop householdCategoryName");
    assert.match(dialogSrc, /householdCategoryIconKey\??:\s*string/, "CompleteShareDialog debe declarar la prop householdCategoryIconKey");
    assert.doesNotMatch(dialogSrc, /HouseholdCategory\b/, "CompleteShareDialog no debe importar/tipar el objeto HouseholdCategory completo");

    const detailDialogSrc = readSrc("features/household/components/household-event-detail-dialog.tsx");
    const completeShareUsage = detailDialogSrc.slice(detailDialogSrc.indexOf("<CompleteShareDialog"));
    assert.match(completeShareUsage, /householdCategoryName=\{category\?\.name\}/, "Debe pasar únicamente category?.name como householdCategoryName");
    assert.match(completeShareUsage, /householdCategoryIconKey=\{category\?\.iconKey\}/, "Debe pasar únicamente category?.iconKey como householdCategoryIconKey");
    assert.doesNotMatch(
      completeShareUsage.slice(0, completeShareUsage.indexOf("/>") + 2),
      /category=\{category\}|categoryId=\{category/,
      "No debe pasar el objeto/ID de categoría Hogar completo al diálogo"
    );

    console.log("  ✓ Test 8: el diálogo recibe solo nombre e iconKey de la categoría Hogar");
  }

  // Test 9: al abrir, aplica la sugerencia; sin sugerencia deja categoryId vacío y muestra "Elegir categoría".
  {
    const dialogSrc = readSrc("features/household/components/complete-share-dialog.tsx");
    assert.match(
      dialogSrc,
      /resolveCompleteShareSuggestionEffect\(/,
      "El diálogo debe invocar el helper de sugerencia (extraído como unidad testeable, corrección P1)"
    );
    assert.doesNotMatch(
      dialogSrc,
      /setCategoryId\(\s*expenseCategories\[0\]/,
      "Ya no debe tomar arbitrariamente la primera categoría de gasto"
    );
    assert.match(
      dialogSrc,
      /<option value="">\s*Elegir categoría\s*<\/option>/,
      'El selector debe mostrar la opción "Elegir categoría" cuando no hay sugerencia'
    );
    // Sin badge ni copy de "sugerida": Android preselecciona en silencio.
    assert.doesNotMatch(dialogSrc, /[Ss]ugerid/, 'No debe agregar copy ni badge de "sugerida"');

    console.log("  ✓ Test 9: aplica sugerencia al abrir; sin sugerencia deja categoryId vacío con placeholder");
  }

  // Test 10: una selección manual posterior no es sobrescrita por efectos/renders posteriores.
  {
    const dialogSrc = readSrc("features/household/components/complete-share-dialog.tsx");
    const setCategoryIdCalls = dialogSrc.match(/setCategoryId\(/g) ?? [];
    assert.strictEqual(
      setCategoryIdCalls.length,
      2,
      "setCategoryId solo debe llamarse en 2 lugares: el reset al abrir (sugerencia) y el onChange manual del usuario"
    );
    assert.match(
      dialogSrc,
      /onChange=\{\(e\)\s*=>\s*setCategoryId\(e\.target\.value\)\}/,
      "El onChange del selector debe seguir permitiendo la selección manual"
    );

    console.log("  ✓ Test 10: la selección manual no es sobrescrita por renders/efectos posteriores");
  }

  console.log("All resolve-suggested-personal-category unit tests passed successfully!");
}

runResolveSuggestedPersonalCategoryTests().catch((err) => {
  console.error("Test failure in resolve-suggested-personal-category.test.ts:", err);
  process.exit(1);
});
