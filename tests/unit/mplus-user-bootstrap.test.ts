import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { personalCategoryToFirestore } from "../../src/lib/mplus/converters";
import { UUID_PATTERN } from "../../src/lib/mplus/catalogs";
import { newMutationId, newUuid } from "../../src/lib/mplus/ids";
import { mplusValidators } from "../../src/lib/mplus/schemas";
import { PERSONAL_SEED, personalSeedCategoryId } from "../../src/lib/mplus/seeds";
import { buildSeedCategory } from "../../src/lib/mplus/user-bootstrap";

/**
 * Bootstrap del seed Personal v1 (contrato §8.3): las 22 categorias que se
 * crean en el primer login son validas contra el contrato, tienen IDs
 * deterministas y no traen ningun campo fuera de esquema.
 */

const NOW = 1_700_000_000_000;

const built = PERSONAL_SEED.map((seed) =>
  buildSeedCategory("uid-1", seed, NOW, "11111111-1111-4111-8111-111111111111"),
);

assert.equal(built.length, 22);

for (const category of built) {
  // Debe pasar el validador de contrato tal cual se va a escribir.
  mplusValidators.category(category);

  assert.equal(category.ownerId, "uid-1");
  assert.equal(category.state, "active");
  assert.equal(category.revision, 1, "toda creacion nace en revision 1 (contrato §4.3)");
  assert.equal(category.schemaVersion, 1);
  assert.equal(category.createdAtMillis, NOW);
  assert.equal(category.updatedAtMillis, NOW);
  assert.notEqual(category.seedKey, null, "una categoria seed siempre declara su seedKey");

  const wire = personalCategoryToFirestore(category);
  assert.equal("id" in wire, false, "el ID no viaja como campo (contrato §4.1)");
  assert.equal("parentId" in wire, false, "no existen subcategorias (contrato §8.2)");
}

// IDs deterministas: el mismo insumo produce el mismo ID, siempre.
{
  const expense = built.find((c) => c.seedKey === "groceries" && c.type === "expense");
  const income = built.find((c) => c.seedKey === "salary" && c.type === "income");
  assert.equal(expense?.id, "seed_expense_groceries");
  assert.equal(income?.id, "seed_income_salary");

  const ids = built.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "no puede haber IDs de seed repetidos");
  assert.deepEqual(ids, PERSONAL_SEED.map(personalSeedCategoryId));
}

// Los UUID generados en cliente cumplen `validUuid` de las Rules canonicas.
for (let i = 0; i < 20; i += 1) {
  const id = newUuid();
  assert.equal(id, id.toLowerCase(), "el UUID viaja en minusculas (contrato §4.2)");
  assert.equal(id.length, 36);
  assert.match(id, UUID_PATTERN);
  assert.match(newMutationId(), UUID_PATTERN);
}

// ─── Crear el perfil dos veces a la vez no puede romper el acceso ────────────
//
// Fallo real de QA: al entrar con Google, `signInWithGoogle` y el listener
// `onAuthState` disparan el bootstrap A LA VEZ. Mientras `users/{uid}` ya
// existia eso era inocuo (los dos solo leian), pero desde que el reinicio QA
// elimina el perfil, ambos intentan CREARLO: el commit lleva la precondicion
// `currentDocument.exists = false` y el que pierde recibe `already-exists`.
// Eso tumbaba el inicio de sesion entero — el perfil SI quedaba creado en
// Firestore y la pantalla se quedaba igual, sin decir nada.

const bootstrapSource = readFileSync(
  path.resolve(__dirname, "../../src/lib/mplus/user-bootstrap.ts"),
  "utf-8",
);

// 1. La carrera se elimina en su origen: un solo bootstrap en vuelo por uid.
assert.ok(
  bootstrapSource.includes("inFlightBootstrap"),
  "dos bootstraps simultaneos del mismo uid deben compartir la misma promesa",
);

// 2. Y si la carrera ocurre igual (otra pestania, otro dispositivo), crear algo
//    que ya existe con el estado que queriamos es exito, no fallo.
assert.ok(
  bootstrapSource.includes('outcome.code === "already-exists"'),
  "`already-exists` al crear el perfil no puede tratarse como un fallo de acceso",
);

// 3. Ese caso debe quedar ANTES del `throw`, o el throw se lo come.
{
  const alreadyExistsAt = bootstrapSource.indexOf('outcome.code === "already-exists"');
  const throwAt = bootstrapSource.indexOf("No se pudo crear el perfil del contrato v1");
  assert.ok(alreadyExistsAt > -1 && throwAt > -1);
  assert.ok(
    alreadyExistsAt < throwAt,
    "la tolerancia a `already-exists` debe evaluarse antes de lanzar el error",
  );
}

console.log("OK mplus-user-bootstrap");
