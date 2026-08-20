import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * El shell no puede volver a condicionar la superficie Personal al circuito
 * legacy.
 *
 * Regresion real de W2: el shell seguia decidiendo "cargando / error / listo"
 * con `personal-data-store`, que lee `transactions`, `pockets` y
 * `third_party_fund_*`. Esas colecciones no existen en el contrato v1 y las
 * Rules canonicas las niegan por defecto, asi que contra el proyecto real la
 * lectura fallaba SIEMPRE y el tablero mostraba "Error al cargar datos" sin
 * llegar a montar ninguna pantalla nueva.
 *
 * Esta prueba fija la direccion correcta: el estado Personal del shell sale
 * del store del contrato v1.
 */

const repoRoot = path.resolve(__dirname, "../..");
const shell = fs.readFileSync(
  path.resolve(repoRoot, "src/components/layout/dashboard-shell.tsx"),
  "utf-8",
);

console.log("Running unit tests for personal-shell-data-gate.test.ts...");

export function runPersonalShellDataGateTests() {
  let checks = 0;

  // 1. El cargador legacy no se monta.
  assert.doesNotMatch(
    shell,
    /usePersonalDataLoader\(/,
    "el cargador Personal legacy no puede volver a montarse: sus colecciones no existen en el contrato v1",
  );
  checks += 1;

  // 2. El driver del contrato v1 si se monta, y una sola vez.
  const mplusLoaderCalls = shell.match(/useMplusPersonalLoader\(/g) ?? [];
  assert.equal(
    mplusLoaderCalls.length,
    1,
    "debe haber exactamente un driver del estado Personal del contrato v1",
  );
  checks += 1;

  // 3. El gate de contenido Personal se decide con el store del contrato v1.
  assert.match(
    shell,
    /} else if \(mplusStatus === "loading" \|\| mplusStatus === "idle"\) \{/,
    "el estado de carga Personal sale del store del contrato v1",
  );
  assert.match(
    shell,
    /} else if \(mplusStatus === "error"\) \{/,
    "el estado de error Personal sale del store del contrato v1",
  );
  checks += 2;

  // 4. Ninguna rama del gate puede volver a leer el estado legacy.
  for (const legacyGate of [
    'personalData.status === "loading"',
    'personalData.status === "error"',
    'personalData.status === "partial"',
    "personalData.hasThirdPartyInconsistency",
  ]) {
    assert.ok(
      !shell.includes(legacyGate),
      `el shell no puede decidir la superficie Personal con '${legacyGate}'`,
    );
  }
  checks += 4;

  // 5. El contador del sidebar cuenta movimientos del contrato v1.
  assert.match(
    shell,
    /movementCount: mplusMovementCount,/,
    "el contador de Movimientos debe salir de los movimientos del contrato v1",
  );
  checks += 1;

  console.log(`  ✓ Gate Personal del shell atado al contrato v1 (${checks} aserciones pasadas).`);
}

runPersonalShellDataGateTests();
