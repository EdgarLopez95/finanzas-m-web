import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveJoinRejection,
  resolveRenameRejection,
} from "../../src/features/household/services/mplus-household-service";

/**
 * Guardas de "unirse con código" y "renombrar el Hogar".
 *
 * Cada rama replica una condición literal de `android/firestore.rules`. Sin
 * ellas, todas estas situaciones llegan al usuario como
 * `Missing or insufficient permissions`, que no dice qué hacer a continuación.
 *
 * Reglas cubiertas:
 *
 * - `validInviteConsumptionHouseholdUpdate` (línea 827): el Hogar sigue
 *   `waiting` con la plaza B libre, y quien consume NO es `memberAId`.
 * - `validInviteShape` / `validInviteConsumption`: la invitación está `active`
 *   y no ha vencido.
 * - DEC-076: un código de reingreso solo lo consume su `reservedForUid`.
 * - Ambas rutas de consumo: `householdMembershipState == 'none'` ANTES.
 * - `validHouseholdRename` (línea 590): el nombre tiene que CAMBIAR.
 * - `validHouseholdUpdateShape` (línea 601): un Hogar sin `name` valida contra
 *   `validLegacyHouseholdShape`, cuyo `hasOnly` no admite `name`.
 */

console.log("Running unit tests for mplus-household-join-rename-guards.test.ts...");

const NOW = 1_800_000_000_000;
const CREATOR = "uid-a";
const JOINER = "uid-b";

const activeInvite = {
  state: "active" as const,
  expiresAtMillis: NOW + 1000,
  reservedForUid: null as string | null,
};

const waitingHousehold = {
  status: "waiting" as const,
  memberAId: CREATOR,
  memberBId: null as string | null,
};

const join = (over: Partial<Parameters<typeof resolveJoinRejection>[0]> = {}) =>
  resolveJoinRejection({
    invite: activeInvite,
    household: waitingHousehold,
    membershipState: "none",
    joinerUid: JOINER,
    nowMillis: NOW,
    ...over,
  });

// ─── Unirse: el camino feliz no se bloquea ───────────────────────────────────

assert.equal(join(), null, "un primer ingreso válido no puede rechazarse");

// Reingreso reservado para este UID (DEC-076): el Hogar ya está `active`.
assert.equal(
  join({
    invite: { ...activeInvite, reservedForUid: JOINER },
    household: { status: "active", memberAId: CREATOR, memberBId: JOINER },
  }),
  null,
  "un reingreso con código reservado para este UID es válido aunque el Hogar esté active",
);

// ─── Unirse: cada rechazo, con su razón ──────────────────────────────────────

assert.equal(join({ invite: { ...activeInvite, state: "used" } })?.code, "invalid-state");
assert.equal(join({ invite: { ...activeInvite, state: "revoked" } })?.code, "invalid-state");

assert.equal(
  join({ invite: { ...activeInvite, expiresAtMillis: NOW } })?.code,
  "expired",
  "el vencimiento es inclusivo: a la hora exacta ya no sirve",
);

assert.equal(
  join({ invite: { ...activeInvite, reservedForUid: "uid-otro" } })?.code,
  "permission-denied",
  "un código reservado para otra cuenta no lo consume nadie más",
);

assert.equal(join({ household: null })?.code, "not-found");

// El creador consumiendo su propio código: la situación más fácil de encontrar
// probando en solitario.
assert.equal(
  join({ joinerUid: CREATOR })?.code,
  "self-join",
  "`request.auth.uid != resource.data.memberAId`",
);

// Hogar ya completo.
assert.equal(
  join({ household: { status: "active", memberAId: CREATOR, memberBId: "uid-c" } })?.code,
  "household-full",
);
assert.equal(
  join({ household: { status: "waiting", memberAId: CREATOR, memberBId: "uid-c" } })?.code,
  "household-full",
  "una plaza B ocupada invalida el primer ingreso aunque el estado siga waiting",
);

// Membresía previa. Las Rules miran SOLO esto, no el `householdId`.
assert.equal(join({ membershipState: "active" })?.code, "already-in-household");

const paused = join({ membershipState: "left" });
assert.equal(paused?.code, "already-in-household");
assert.match(
  paused?.message ?? "",
  /pausa/,
  "un perfil en pausa merece un mensaje distinto al de un hogar activo: la salida no es la misma",
);

// El orden importa: un código vencido se reporta como vencido, no como
// "ya tienes hogar", aunque ambas condiciones se den a la vez.
assert.equal(
  join({ invite: { ...activeInvite, state: "used" }, membershipState: "active" })?.code,
  "invalid-state",
);

// ─── Renombrar ───────────────────────────────────────────────────────────────

assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "Casa nueva" }),
  null,
  "un renombrado normal no puede rechazarse",
);

assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "   " })?.code,
  "invalid-name",
);
assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "x".repeat(51) })?.code,
  "invalid-name",
);
assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "x".repeat(50) }),
  null,
  "50 caracteres es válido: el límite es inclusivo",
);

// `validHouseholdRename` exige `data.name != resource.data.name`.
assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "Casa" })?.code,
  "unchanged-name",
  "guardar el mismo nombre lo RECHAZA el servidor; no es un no-op",
);
assert.equal(
  resolveRenameRejection({ currentName: "Casa", newName: "  Casa  " })?.code,
  "unchanged-name",
  "el recorte se aplica antes de comparar: espacios no hacen distinto un nombre",
);

// Hogar heredado sin `name`: `validLegacyHouseholdShape` no admite el campo.
const legacy = resolveRenameRejection({ currentName: null, newName: "Casa" });
assert.equal(legacy?.code, "legacy-household");
assert.match(
  legacy?.message ?? "",
  /contrato compartido/,
  "el mensaje debe decir que no se resuelve desde el cliente",
);

// Y un nombre inválido se reporta como tal antes que la condición de heredado:
// lo primero que hay que corregir es lo que la persona sí puede corregir.
assert.equal(
  resolveRenameRejection({ currentName: null, newName: "" })?.code,
  "invalid-name",
);

// ─── El catálogo de Hogar NO se siembra al crear el Hogar ────────────────────
//
// Fallo real de QA: crear un Hogar funcionaba en Android y en Web fallaba con
// `Missing or insufficient permissions`. `firestore.rules` (expenseCategories,
// línea 1155) exige DOS cosas que el batch de creación no puede cumplir:
//
//   allow create: if currentUserIsActiveMember(householdId) &&
//     get(householdPath(householdId)).data.status == 'active' && ...
//
// El Hogar nace `waiting`, y `currentUserIsActiveMember` resuelve con `get()`,
// que lee el estado ANTERIOR al batch, cuando la membresía aún no existe.
// Android lo deja escrito en `MplusHouseholdCategoryRepository`: el seed se
// lanza al detectar la transición a activo, no al crear.

const householdServiceSource = readFileSync(
  path.resolve(__dirname, "../../src/features/household/services/mplus-household-service.ts"),
  "utf-8",
);
const categoriesServiceSource = readFileSync(
  path.resolve(
    __dirname,
    "../../src/features/household/services/mplus-household-categories-service.ts",
  ),
  "utf-8",
);

assert.equal(
  householdServiceSource.includes("HOUSEHOLD_EXPENSE_SEED"),
  false,
  "crear el Hogar no puede sembrar su catálogo: el batch lo rechaza entero",
);
assert.ok(
  categoriesServiceSource.includes("ensureHouseholdExpenseSeed"),
  "la siembra vive aparte, para lanzarse con el Hogar ya active",
);
// Idempotente: solo crea lo que falta, así que es segura desde los dos
// miembros a la vez y en cada carga.
assert.ok(
  categoriesServiceSource.includes("readMplusHouseholdExpenseCategories(householdId)"),
  "la siembra debe leer lo existente antes de escribir",
);
assert.ok(
  categoriesServiceSource.includes("if (missing.length === 0)"),
  "sin nada que sembrar no puede escribir",
);

// Y el disparador exige `active`.
const householdHookSource = readFileSync(
  path.resolve(__dirname, "../../src/features/household/hooks/use-mplus-household.ts"),
  "utf-8",
);
assert.ok(
  householdHookSource.includes("useMplusHouseholdSeeder"),
  "debe existir el driver de siembra",
);
assert.ok(
  /household.status !== "active"/.test(householdHookSource),
  "el driver solo puede sembrar con el Hogar active",
);

console.log("mplus-household-join-rename-guards.test.ts: OK");

// ─── Esperar pareja reactivo en tiempo real vía listener del Hogar ───────────
//
// El estado de espera (waiting / waiting_return) se sincroniza en vivo mediante
// el listener reactivo de `households/{householdId}`, eliminando la necesidad
// de sondeos periódicos con temporizadores.

const householdStoreSource = readFileSync(
  path.resolve(__dirname, "../../src/stores/mplus-household-store.ts"),
  "utf-8",
);

assert.ok(
  householdStoreSource.includes("subscribeMplusHousehold"),
  "el store de Hogar debe suscribirse en tiempo real al documento del Hogar",
);

assert.ok(
  householdStoreSource.includes('"household-doc"'),
  "la suscripción al documento de Hogar debe registrarse bajo la clave 'household-doc'",
);

console.log("mplus-household-join-rename-guards.test.ts: OK (espera de pareja en tiempo real)");
