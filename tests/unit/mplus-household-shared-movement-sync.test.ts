import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startOfDayMillis } from "../../src/lib/mplus/bogota-date";
import { monthlyDifference, totalExpense, totalIncome } from "../../src/lib/mplus/derived";
import type { MplusMovement } from "../../src/lib/mplus/models";
import { toContractPeriod } from "../../src/lib/mplus/period";
import {
  setMplusHouseholdServicesForTesting,
  useMplusHouseholdStore,
} from "../../src/stores/mplus-household-store";

/**
 * Caso real que ninguna prueba cubria: "movimiento creado en Personal, marcado
 * para compartir, visible en Hogar en el mismo periodo".
 *
 * Cubre las dos fallas encontradas en la auditoria:
 *
 * 1. El periodo llega a la consulta en la convencion del contrato, asi que un
 *    movimiento del mes seleccionado entra al tablero compartido.
 * 2. Un documento confirmado por el servidor desde Personal se refleja en el
 *    store de Hogar sin recargar la pagina, y sale de el cuando deja de
 *    cumplir la consulta canonica §19.3 (deja de compartirse, se va a
 *    Papelera o cambia a otro mes).
 */

console.log("Running unit tests for mplus-household-shared-movement-sync.test.ts...");

const HOUSEHOLD_ID = "hh-sync";
const OWNER_ID = "user-a";
const PARTNER_ID = "user-b";

/** "Agosto 2026" tal como lo elige la UI: mes 0-indexado. */
const SELECTED_PERIOD = { year: 2026, month: 7 };

const day = (d: number) => startOfDayMillis({ year: 2026, month: 8, day: d });

const movement = (overrides: Partial<MplusMovement> & { id: string }): MplusMovement => ({
  schemaVersion: 1,
  ownerId: OWNER_ID,
  type: "expense",
  title: "Movimiento",
  amount: 1000,
  categoryId: "seed_expense_food",
  accountId: null,
  note: "",
  occurredAtMillis: day(20),
  lifecycleState: "active",
  trashedAtMillis: null,
  purgeAfterMillis: null,
  householdId: HOUSEHOLD_ID,
  householdCategoryId: null,
  revision: 1,
  lastMutationId: "mut-1",
  createdAtMillis: day(20),
  updatedAtMillis: day(20),
  ...overrides,
});

const household = {
  id: HOUSEHOLD_ID,
  schemaVersion: 1,
  status: "active" as const,
  memberAId: OWNER_ID,
  memberBId: PARTNER_ID,
  activeInviteId: null,
  catalogVersion: 1,
  cleanupPhase: "none" as const,
  revision: 1,
  lastMutationId: "mut-1",
  createdAtMillis: 1000,
  updatedAtMillis: 1000,
  name: "Casa Sync",
};

export const runMplusHouseholdSharedMovementSyncTests = async (): Promise<void> => {
  // El mes ya cargado llega vacio: reproduce el estado del usuario justo antes
  // de registrar el movimiento compartido.
  setMplusHouseholdServicesForTesting({
    readHousehold: async () => household,
    readMembers: async () => [],
    readActiveInvite: async () => null,
    readCategories: async () => [],
    readMappings: async () => [],
    readCategoryLabels: async () => [],
    readAccountLabels: async () => [],
    readMovements: async () => [],
  });

  const store = useMplusHouseholdStore.getState();
  await store.load(HOUSEHOLD_ID, toContractPeriod(SELECTED_PERIOD));

  assert.equal(useMplusHouseholdStore.getState().status, "success");

  // --- 1. El mes cargado es el que la UI muestra ---

  const range = useMplusHouseholdStore.getState().range;
  assert.notEqual(range, null, "el store debe conocer el rango del mes cargado");
  assert.equal(
    day(20) >= range!.startMillis && day(20) < range!.endMillis,
    true,
    "'Agosto 2026' en la UI debe cargar el rango de agosto, no el de julio",
  );

  // --- 2. Un gasto compartido confirmado en Personal entra al tablero ---

  const sharedExpense = movement({ id: "mov-expense", type: "expense", amount: 50_000 });
  useMplusHouseholdStore.getState().applyCommittedMovement(sharedExpense);

  // --- 3. Un ingreso compartido tambien entra: no hay asimetria por tipo ---

  const sharedIncome = movement({
    id: "mov-income",
    type: "income",
    amount: 120_000,
    categoryId: "seed_income_salary",
  });
  useMplusHouseholdStore.getState().applyCommittedMovement(sharedIncome);

  const shown = useMplusHouseholdStore.getState().movements;
  assert.equal(shown.length, 2, "los dos movimientos compartidos deben verse en Hogar");
  assert.equal(totalIncome(shown), 120_000);
  assert.equal(totalExpense(shown), 50_000);
  assert.equal(monthlyDifference(shown), 70_000);

  // --- 4. Un movimiento privado nunca entra ---

  useMplusHouseholdStore
    .getState()
    .applyCommittedMovement(movement({ id: "mov-private", householdId: null, amount: 999 }));
  assert.equal(
    useMplusHouseholdStore.getState().movements.length,
    2,
    "un movimiento sin householdId no puede sumar en el tablero compartido",
  );

  // --- 5. Un movimiento de OTRO hogar nunca entra ---

  useMplusHouseholdStore
    .getState()
    .applyCommittedMovement(movement({ id: "mov-otro-hogar", householdId: "hh-ajeno" }));
  assert.equal(useMplusHouseholdStore.getState().movements.length, 2);

  // --- 6. Un movimiento compartido de OTRO mes nunca entra ---

  useMplusHouseholdStore.getState().applyCommittedMovement(
    movement({
      id: "mov-otro-mes",
      occurredAtMillis: startOfDayMillis({ year: 2026, month: 7, day: 20 }),
    }),
  );
  assert.equal(
    useMplusHouseholdStore.getState().movements.length,
    2,
    "el store de Hogar no puede aceptar un movimiento fuera del mes cargado",
  );

  // --- 7. Dejar de compartir lo retira del tablero ---

  useMplusHouseholdStore
    .getState()
    .applyCommittedMovement({ ...sharedIncome, householdId: null, revision: 2 });

  const afterUnshare = useMplusHouseholdStore.getState().movements;
  assert.equal(afterUnshare.length, 1);
  assert.equal(afterUnshare[0].id, "mov-expense");
  assert.equal(totalIncome(afterUnshare), 0, "el ingreso ya no cuenta en Hogar");

  // --- 8. Enviar a Papelera lo retira del tablero (§9.5) ---

  useMplusHouseholdStore.getState().applyCommittedMovement({
    ...sharedExpense,
    lifecycleState: "trashed",
    trashedAtMillis: day(21),
    purgeAfterMillis: day(21),
    revision: 2,
  });
  assert.equal(useMplusHouseholdStore.getState().movements.length, 0);
  assert.equal(totalExpense(useMplusHouseholdStore.getState().movements), 0);

  // --- 9. Restaurar lo devuelve ---

  useMplusHouseholdStore.getState().applyCommittedMovement({ ...sharedExpense, revision: 3 });
  assert.equal(useMplusHouseholdStore.getState().movements.length, 1);

  // --- 10. La purga fisica lo retira ---

  useMplusHouseholdStore.getState().removeMovement("mov-expense");
  assert.equal(useMplusHouseholdStore.getState().movements.length, 0);

  // --- 11. Sin hogar cargado, nada entra ---

  useMplusHouseholdStore.getState().reset();
  useMplusHouseholdStore.getState().applyCommittedMovement(sharedExpense);
  assert.equal(
    useMplusHouseholdStore.getState().movements.length,
    0,
    "sin un mes cargado el store de Hogar no acumula movimientos",
  );

  setMplusHouseholdServicesForTesting(null);

  // --- 12. Las mutaciones Personales avisan al store de Hogar ---

  const mutationsHook = fs.readFileSync(
    path.resolve(__dirname, "../../src/features/movements/hooks/use-movement-mutations.ts"),
    "utf-8",
  );

  assert.match(
    mutationsHook,
    /useMplusHouseholdStore/,
    "las mutaciones Personales deben notificar al store de Hogar: un movimiento compartido vive en los dos tableros",
  );
  assert.match(
    mutationsHook,
    /applyHouseholdMovement\(movement\)/,
    "cada documento confirmado debe ofrecerse tambien al tablero compartido",
  );

  console.log("mplus-household-shared-movement-sync.test.ts: OK");
};

// La invocacion vive en `run-all.ts`, encadenada despues de
// `mplus-household-contract.test.ts`: ambos usan el mismo store singleton de
// Hogar y sus servicios inyectados.
