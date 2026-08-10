import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

import { ICON_DEFAULTS_BY_TYPE, isValidIconCombination, type AccountType, type AccountIconType } from "@/lib/accounts/account-visual-catalog";

export type { AccountType };

/**
 * Etiqueta canónica del movimiento técnico de saldo inicial, compartida con
 * Android (`AccountRepository.INITIAL_BALANCE_DESCRIPTION`). Junto con
 * `BALANCE_ADJUSTMENT_DESCRIPTION` (`adjust-account-balance.ts`), es el único
 * discriminador de "movimiento técnico" que existe hoy (una comparación de
 * texto exacta, igual que Android — frágil pero deliberadamente replicada,
 * no se inventa un campo/tipo remoto nuevo). No cambiar sin coordinar.
 */
export const INITIAL_BALANCE_DESCRIPTION = "Saldo inicial";

export type CreateAccountInput = {
  ownerId: string;
  name: string;
  type: AccountType;
  /**
   * Tipo de ícono seleccionado por el usuario en el flujo de creación.
   * Si se omite, se usa el default del tipo (ICON_DEFAULTS_BY_TYPE).
   */
  iconType?: AccountIconType;
  /**
   * Key del ícono/marca seleccionada por el usuario (e.g. "bancolombia", "nequi", "cash").
   * Si se omite, se usa el default del tipo.
   */
  iconKey?: string;
  initialBalance: number;
  color: string;
  includeInTotal: boolean;
};

/**
 * Seam de inyección interno solo para pruebas (mismo patrón que
 * `declare-debt-payment.ts`): permite ejercer `createPersonalAccount` real
 * con una transacción Firestore simulada, sin tocar Firebase real.
 */
export type CreatePersonalAccountTransactionLike = {
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type CreatePersonalAccountDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: CreatePersonalAccountTransactionLike) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Crea una cuenta personal en la colección top-level `accounts/{accountId}`,
 * usando el esquema compartido con Android. No crea bolsillos: los bolsillos
 * viven después en `accounts/{accountId}/pockets/{pocketId}`.
 *
 * Reglas del modelo (paridad Android `AccountRepository.createPersonalAccount`,
 * con una mejora deliberada — ver nota de atomicidad más abajo):
 *
 * Reconciliación P1 (Paso 2) — contrato de escritura Android verificado
 * literalmente en `AccountRepository.kt:106-141`:
 *   `Account(..., currentBalance = 0.0, ...)` → `accountDao.insertAccount(...)`
 *   `if (balance > 0.0) { transactionRepository.createIncomeAndUpdateAccountBalance(...) }`
 * Es decir: Android NO persiste `initialBalance` directamente como
 * `currentBalance` en el insert — la cuenta nace SIEMPRE en 0.0, y es la
 * transacción técnica (vía `createIncomeAndUpdateAccountBalance`, que crea el
 * movimiento Y aplica su delta al saldo) la que efectivamente lleva
 * `currentBalance` a `initialBalance`. El documento de cuenta representa el
 * contenedor; el movimiento técnico es la ÚNICA causa del cambio de saldo.
 * Este servicio alinea esa misma secuencia exactamente: `transaction.set`
 * inserta con `currentBalance: 0`, y solo si `initialBalance > 0` se crea el
 * movimiento técnico y se aplica su delta con un `transaction.update`
 * separado — nunca se escribe el valor final directamente en el `set` inicial.
 * - Si `initialBalance > 0`: se crea EXACTAMENTE una transacción técnica de
 *   "Saldo inicial" (income, countsAsRealIncome=false, categoryId=null) —
 *   nunca cuenta como ingreso real ni afecta dinero no propio ni bolsillos.
 * - Si `initialBalance === 0`: Android NO crea la transacción técnica
 *   (`if (balance > 0.0)`); este servicio replica exactamente eso — la cuenta
 *   queda en `currentBalance: 0` sin ningún `update` posterior.
 * - Atomicidad: Android hace el insert de cuenta y la transacción técnica en
 *   DOS operaciones Room separadas (no atómico entre sí — ver hallazgo de
 *   investigación: si la segunda falla, queda una cuenta persistida en 0 sin
 *   su movimiento técnico, un estado parcial real en Android). Este servicio
 *   Web es deliberadamente MÁS estricto: el `set` inicial, la creación del
 *   movimiento técnico y el `update` que aplica su delta van los tres dentro
 *   de una única `runTransaction` — por lo que, a diferencia de Android,
 *   nunca puede quedar visible una cuenta con `currentBalance` distinto de 0
 *   sin su movimiento técnico correspondiente (todo o nada). Mejora consciente
 *   sobre Android, no un apartamiento accidental del contrato verificado.
 * - archived siempre false al crear.
 * - createdAt con serverTimestamp().
 * - No se escribe updatedAt ni currency (el modelo no los usa al crear).
 */
export const createPersonalAccount = async (
  payload: CreateAccountInput,
  deps: CreatePersonalAccountDeps = {},
): Promise<string> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: CreatePersonalAccountTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();
  const name = payload.name.trim();
  const initialBalance = Number(payload.initialBalance);

  if (!payload.ownerId) {
    throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
  }
  if (!name) {
    throw new Error("El nombre de la cuenta es obligatorio.");
  }
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    throw new Error("El saldo inicial debe ser mayor o igual a cero.");
  }

  // Use explicit iconType/iconKey from UI if provided; fall back to type defaults.
  const defaults = ICON_DEFAULTS_BY_TYPE[payload.type] ?? ICON_DEFAULTS_BY_TYPE.other;
  const icons = {
    iconType: payload.iconType ?? defaults.iconType,
    iconKey:  payload.iconKey  ?? defaults.iconKey,
  };

  if (!isValidIconCombination(payload.type, icons.iconType, icons.iconKey)) {
    throw new Error(`Combinación inválida de cuenta: tipo=${payload.type}, logo=${icons.iconKey}`);
  }

  const accountRef = docImpl(collectionImpl(db, "accounts")) as { id: string };

  await runTransactionImpl(db, async (transaction) => {
    // Paso 2 (reconciliación P1): nace SIEMPRE en 0, igual que Android
    // (`Account(currentBalance = 0.0, ...)`). El valor final, si aplica, lo
    // aplica exclusivamente el movimiento técnico más abajo.
    transaction.set(accountRef, {
      ownerId: payload.ownerId,
      name,
      type: payload.type,
      iconType: icons.iconType,
      iconKey: icons.iconKey,
      color: payload.color,
      initialBalance,
      currentBalance: 0,
      pocketCount: 0,
      includeInTotal: payload.includeInTotal,
      archived: false,
      createdAt: serverTimestamp(),
    });

    if (initialBalance > 0) {
      const transactionRef = docImpl(collectionImpl(db, "transactions"));
      transaction.set(transactionRef, {
        ownerId: payload.ownerId,
        type: "income",
        amount: initialBalance,
        accountId: accountRef.id,
        categoryId: null,
        title: INITIAL_BALANCE_DESCRIPTION,
        notes: INITIAL_BALANCE_DESCRIPTION,
        description: INITIAL_BALANCE_DESCRIPTION,
        date: Timestamp.now(),
        createdAt: serverTimestamp(),
        source: "manual",
        status: "confirmed",
        isHousehold: false,
        householdId: null,
        countsAsRealIncome: false,
      });

      // El movimiento técnico es la ÚNICA causa del cambio de saldo (paridad
      // Android `createIncomeAndUpdateAccountBalance`) — se aplica con un
      // `update` separado del `set` inicial, nunca fusionado en él.
      transaction.update(accountRef, {
        currentBalance: initialBalance,
      });
    }
  });

  return accountRef.id;
};
