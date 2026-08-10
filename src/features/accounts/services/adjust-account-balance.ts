import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";

/**
 * Etiqueta canónica del movimiento de ajuste, compartida con Android
 * (`AccountRepository.BALANCE_ADJUSTMENT_DESCRIPTION`). No cambiar sin coordinar.
 */
export const BALANCE_ADJUSTMENT_DESCRIPTION = "Ajuste manual de saldo";

export type AdjustAccountBalanceInput = {
  ownerId: string;
  accountId: string;
  /** Nuevo saldo disponible (currentBalance) objetivo de la cuenta. */
  newAvailableBalance: number;
  date?: Date;
};

export type AdjustAccountBalanceResult = {
  /** `false` cuando el delta fue 0: no se creó movimiento ni se escribió la cuenta (paridad Android). */
  adjusted: boolean;
  delta: number;
};

/**
 * Seam de inyección interno solo para pruebas (mismo patrón que
 * `declare-debt-payment.ts`/`cancel-pending-share.ts`): permite ejercer
 * `adjustAccountBalance` real con una transacción Firestore simulada, sin
 * tocar Firebase real. Todos los deps son opcionales; por defecto usan las
 * funciones reales de `firebase/firestore`.
 */
export type AdjustAccountBalanceTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type AdjustAccountBalanceDeps = {
  getFirebaseDbFn?: () => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: AdjustAccountBalanceTransactionLike) => Promise<void>,
  ) => Promise<void>;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
};

/**
 * Reajusta el saldo disponible de una cuenta creando un movimiento de ajuste
 * (income si sube, expense si baja) y dejando `currentBalance` en el valor objetivo.
 *
 * Contrato espejo de Android (`AccountRepository.adjustAccountBalance` +
 * `TransactionRepository.createBalanceAdjustment`):
 * - amount = |delta|, type = income/expense según el signo del delta.
 * - description = "Ajuste manual de saldo", categoryId = null, countsAsRealIncome = false.
 * - delta === 0: Android NO crea movimiento (ni siquiera de monto 0) y no falla — es un no-op
 *   silencioso. Este servicio replica exactamente eso: `adjusted: false`, ninguna escritura.
 * - No usa categoría (es un ajuste de sistema) y no crea ledger de dinero no propio: este
 *   servicio escribe la transacción técnica directamente (como Android), sin pasar por
 *   ningún flujo de `third_party_fund_entries` — la exclusión es por construcción, igual
 *   que en Android (no hay chequeo defensivo explícito en ninguno de los dos lados).
 * - Corrección P1-A (Paso 2): rechaza con `assertAccountNotArchived` si la cuenta está
 *   cerrada (`archived === true`), releída dentro de esta misma transacción — nunca a
 *   partir de un valor recibido por props/UI. Cero escrituras cuando rechaza.
 * - Bolsillos: nunca se leen ni se modifican aquí (el reajuste es solo sobre `currentBalance`).
 * - Dinero no propio "por ubicación": el modelo actual solo conoce un agregado GLOBAL
 *   (`totalNoPropioPendiente`), no una localización por cuenta/Disponible verificable — no se
 *   implementa ninguna comprobación aquí (eso pertenece exclusivamente al Paso 4; simularla
 *   ahora sería inventar un contrato que no existe).
 */
export const adjustAccountBalance = async (
  payload: AdjustAccountBalanceInput,
  deps: AdjustAccountBalanceDeps = {},
): Promise<AdjustAccountBalanceResult> => {
  const newBalance = Number(payload.newAvailableBalance);

  if (!Number.isFinite(newBalance) || newBalance < 0) {
    throw new Error("El disponible no puede ser negativo.");
  }

  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: AdjustAccountBalanceTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();

  let result: AdjustAccountBalanceResult = { adjusted: false, delta: 0 };

  await runTransactionImpl(db, async (transaction) => {
    const accountRef = docImpl(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta seleccionada no existe.");
    }
    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para ajustar esta cuenta.");
    }
    // Corrección P1-A (Paso 2): una cuenta cerrada no puede recibir reajustes,
    // ni siquiera vía UI obsoleta/doble pestaña/reintento — chequeo dentro de
    // la transacción, con el snapshot fresco, antes de cualquier escritura.
    assertAccountNotArchived(accountData);

    const currentRaw = accountData.currentBalance ?? accountData.balance;
    const current = typeof currentRaw === "number" ? currentRaw : Number(currentRaw ?? 0);
    if (!Number.isFinite(current)) {
      throw new Error("La cuenta tiene un saldo invalido.");
    }

    const delta = newBalance - current;
    result = { adjusted: delta !== 0, delta };

    if (delta === 0) {
      // Paridad Android exacta: no crear movimiento duplicado/vacío, no tocar la cuenta.
      return;
    }

    const date = payload.date ?? new Date();
    const transactionRef = docImpl(collectionImpl(db, "transactions"));
    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: delta > 0 ? "income" : "expense",
      amount: Math.abs(delta),
      accountId: payload.accountId,
      pocketId: null,
      categoryId: null,
      date: Timestamp.fromDate(date),
      description: BALANCE_ADJUSTMENT_DESCRIPTION,
      createdAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: null,
      countsAsRealIncome: false,
    });

    transaction.update(accountRef, {
      currentBalance: newBalance,
      updatedAt: serverTimestamp(),
    });
  });

  return result;
};
