import assert from "node:assert";
import { calculateAccountTotalBalance, computeGrossBalance } from "../../src/lib/finance/accounts";
import type { Account } from "../../src/types/account";
import type { Pocket } from "../../src/types/pocket";

console.log("Running unit tests for accounts.ts...");

// ─── calculateAccountTotalBalance ───────────────────────────────────────────

// Caso base: cuenta con bolsillos
const mockPockets: Pocket[] = [
  { id: "p1", accountId: "acc1", name: "Bolsillo 1", balance: 3000 },
  { id: "p2", accountId: "acc1", name: "Bolsillo 2", balance: 4000 },
  { id: "p3", accountId: "acc2", name: "Bolsillo 3", balance: 5000 }, // Otro accountId
];

const currentBalance = 13000;
const accountPockets = mockPockets.filter(p => p.accountId === "acc1");

const total = calculateAccountTotalBalance(currentBalance, accountPockets);
console.log(`account.currentBalance = ${currentBalance}`);
console.log(`pockets sum = ${accountPockets.reduce((s, p) => s + p.balance, 0)}`);
console.log(`totalCuenta calculado = ${total}`);

assert.strictEqual(total, 20000, "El saldo total de la cuenta debería ser 20000");

// Caso sin bolsillos
const totalSinBolsillos = calculateAccountTotalBalance(15000, []);
assert.strictEqual(totalSinBolsillos, 15000, "El saldo total de una cuenta sin bolsillos debería ser igual a currentBalance");

// ─── computeGrossBalance — WPP-017 (Paso 1, cierre final: entradas tipadas explícitas,
// nunca Account[] — ver GrossBalanceEntry en src/lib/finance/accounts.ts) ──────────

// 1. Entrada incluida (includeInTotal=true)
assert.strictEqual(
  computeGrossBalance([{ includeInTotal: true, totalBalance: 100000 }]),
  100000,
  "Entrada incluida debe sumarse al bruto",
);

// 2. Entrada excluida (includeInTotal=false)
assert.strictEqual(
  computeGrossBalance([{ includeInTotal: false, totalBalance: 50000 }]),
  0,
  "Entrada excluida no debe sumarse al bruto",
);

// 3. Lista vacía (todas archivadas ya filtradas antes de construir las entradas) → bruto 0.
assert.strictEqual(
  computeGrossBalance([]),
  0,
  "Array vacío (todas archivadas) debe dar bruto cero",
);

// 4. Entrada con totalBalance ya derivado (Disponible + bolsillos) — se suma tal cual, sin recalcular.
assert.strictEqual(
  computeGrossBalance([{ includeInTotal: true, totalBalance: 200000 }]),
  200000,
  "totalBalance ya derivado (Disponible + bolsillos) debe sumarse correctamente",
);

// 5. Combinación: incluida + excluida
assert.strictEqual(
  computeGrossBalance([
    { includeInTotal: true, totalBalance: 300000 },
    { includeInTotal: false, totalBalance: 100000 },
  ]),
  300000,
  "Combinación: solo la entrada incluida debe sumar",
);

// 6. Múltiples incluidas
assert.strictEqual(
  computeGrossBalance([
    { includeInTotal: true, totalBalance: 100000 },
    { includeInTotal: true, totalBalance: 200000 },
    { includeInTotal: false, totalBalance: 50000 },
  ]),
  300000,
  "Múltiples entradas: solo incluidas deben sumar",
);

// 7. No hay campo `.balance` ambiguo posible: la firma tipada de GrossBalanceEntry
//    solo acepta `totalBalance`, ya derivado por el caller — no hay forma de que
//    computeGrossBalance vuelva a sumar bolsillos por accidente ni de recibir un
//    `Account[]` cuyo `.balance` signifique otra cosa según quién lo haya leído.
assert.strictEqual(
  computeGrossBalance([{ includeInTotal: true, totalBalance: 170000 }]),
  170000,
  "El totalBalance ya derivado se suma tal cual, sin volver a tocar bolsillos",
);

// 8. `includeInTotal` es un boolean explícito y obligatorio en el tipo — el caller
//    (p. ej. el reader, con `data.includeInTotal !== false`) resuelve el legacy
//    ANTES de construir la entrada; computeGrossBalance ya no interpreta undefined.
assert.strictEqual(
  computeGrossBalance([{ includeInTotal: (undefined as unknown as boolean) !== false, totalBalance: 80000 }]),
  80000,
  "Entrada legacy (includeInTotal resuelto por el caller) debe sumarse al bruto",
);

// ─── Saldo Inicial — WPP-015/WPP-016/WPP-020 ───────────────────────────────────

import { buildPersonalMovementRows } from "../../src/features/dashboard/lib/personal-view-model";
import type { Transaction } from "../../src/types/transaction";

const initialBalanceTx: Transaction = {
  id: "tx-init-bal",
  ownerId: "user1",
  title: "Saldo inicial",
  notes: "Saldo inicial",
  amount: 100000,
  type: "income",
  accountId: "acc-main",
  targetAccountId: null,
  categoryId: "", // sin categoría
  countsAsRealIncome: false,
  createdAt: new Date("2026-06-08T10:00:00"),
  date: new Date("2026-06-08T10:00:00"),
};

// 1. Verificar que no se incluye en el cálculo de ingresos del mes
const periodTransactions = [initialBalanceTx];
const ingresosRealesMes = periodTransactions
  .filter((tx) => tx.type === "income" && tx.countsAsRealIncome !== false)
  .reduce((sum, tx) => sum + tx.amount, 0);

assert.strictEqual(ingresosRealesMes, 0, "El saldo inicial con countsAsRealIncome: false no debe sumarse como ingresos del mes");

// 2. Verificar que buildPersonalMovementRows mapea correctamente el título y subtítulo con "Sin categoría"
const accountList: Account[] = [
  { id: "acc-main", ownerId: "user1", name: "Bancolombia Test", balance: 100000, currency: "COP", institutionName: "", type: "bank", updatedAt: null, includeInTotal: true, archived: false, iconKey: "bank", iconType: "generic", color: "" }
];

const movementRows = buildPersonalMovementRows(
  [initialBalanceTx],
  [], // sin categorías
  accountList,
  []
);

assert.strictEqual(movementRows.length, 1);
assert.strictEqual(movementRows[0].title, "Saldo inicial", "El título de la transacción debe ser 'Saldo inicial'");
assert.strictEqual(movementRows[0].metadata, "Sin categoría", "La metadata debe ser 'Sin categoría' (con tilde) si no tiene categoría");
assert.strictEqual(
  movementRows[0].subtitle,
  "Saldo inicial",
  "El subtítulo de la transacción debe priorizar la nota ('Saldo inicial')"
);

// Simular el buildDisplaySubtitle de la fila del movimiento
const displaySubtitle = movementRows[0].title === "Saldo inicial"
  ? `Cuenta · ${movementRows[0].accountName || "Cuenta"}`
  : `${movementRows[0].categoryName || "Sin categoría"} · ${movementRows[0].accountName || "Cuenta"}`;
assert.strictEqual(displaySubtitle, "Cuenta · Bancolombia Test", "El subtítulo mostrado en la fila debe ser 'Cuenta · Bancolombia Test'");

// ─── Regla Crítica de Saldos y Validación de Sobregiros (WPP-095/WPP-096/WPP-113) ───

const getAvailableBalance = (
  account: { currentBalance: number },
  pocket: { balance: number } | null
): number => {
  // Regla crítica: account.currentBalance representa el Disponible.
  // No hay que hacer ninguna resta de los bolsillos.
  if (pocket) {
    return pocket.balance;
  }
  return account.currentBalance;
};

const checkOverdraft = (amount: number, availableBalance: number): boolean => {
  return amount <= availableBalance;
};

// 1. No-doble resta: el disponible de la cuenta libre es exactamente currentBalance
const testAccount = { currentBalance: 120000 }; // Disponible
const testPockets = [
  { id: "p1", balance: 50000 },
  { id: "p2", balance: 30000 },
];
const totalCuentaCalculado = calculateAccountTotalBalance(testAccount.currentBalance, testPockets as Pocket[]);
assert.strictEqual(totalCuentaCalculado, 200000, "Total cuenta = Disponible (120k) + Bolsillos (80k) = 200k");

const availableFree = getAvailableBalance(testAccount, null);
assert.strictEqual(availableFree, 120000, "El disponible de la cuenta libre debe ser exactamente currentBalance (no-doble resta)");

// 2. Validación de sobregiros en la cuenta libre
assert.strictEqual(checkOverdraft(120000, availableFree), true, "Gasto igual a disponible debe ser permitido");
assert.strictEqual(checkOverdraft(120001, availableFree), false, "Gasto mayor a disponible debe causar sobregiro (bloqueado)");

// 3. Validación de sobregiros en bolsillos
const pocketP1 = testPockets[0];
const availablePocketP1 = getAvailableBalance(testAccount, pocketP1);
assert.strictEqual(availablePocketP1, 50000, "El disponible del bolsillo debe ser su propio saldo");
assert.strictEqual(checkOverdraft(50000, availablePocketP1), true, "Gasto del bolsillo por su saldo exacto es permitido");
assert.strictEqual(checkOverdraft(50001, availablePocketP1), false, "Gasto del bolsillo por más de su saldo debe ser bloqueado");

console.log("All unit tests passed successfully!");

