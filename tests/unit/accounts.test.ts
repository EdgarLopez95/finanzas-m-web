import assert from "node:assert";
import { calculateAccountTotalBalance } from "../../src/lib/finance/accounts";
import type { Pocket } from "../../src/types/pocket";

console.log("Running unit tests for accounts.ts...");

// Caso de validación esperada:
// account.currentBalance = 13000
// pockets sum = 7000
// totalCuenta esperado = 20000
const mockPockets: Pocket[] = [
  { id: "p1", accountId: "acc1", name: "Bolsillo 1", balance: 3000 },
  { id: "p2", accountId: "acc1", name: "Bolsillo 2", balance: 4000 },
  { id: "p3", accountId: "acc2", name: "Bolsillo 3", balance: 5000 }, // Otro accountId
];

const currentBalance = 13000;
// Filtramos los bolsillos de la cuenta "acc1"
const accountPockets = mockPockets.filter(p => p.accountId === "acc1");

const total = calculateAccountTotalBalance(currentBalance, accountPockets);
console.log(`account.currentBalance = ${currentBalance}`);
console.log(`pockets sum = ${accountPockets.reduce((s, p) => s + p.balance, 0)}`);
console.log(`totalCuenta calculado = ${total}`);

assert.strictEqual(total, 20000, "El saldo total de la cuenta debería ser 20000");

// Caso sin bolsillos
const totalSinBolsillos = calculateAccountTotalBalance(15000, []);
assert.strictEqual(totalSinBolsillos, 15000, "El saldo total de una cuenta sin bolsillos debería ser igual a currentBalance");

console.log("All unit tests passed successfully!");
