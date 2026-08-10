import {
  doc,
  serverTimestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";

type ExpenseSourceRefs = {
  accountRef: DocumentReference;
  pocketRef: DocumentReference | null;
};

export type ExpenseSourceState = {
  accountId: string;
  pocketId: string | null;
  accountData: DocumentData;
  pocketData: DocumentData | null;
  availableBalance: number;
  refs: ExpenseSourceRefs;
};

const toSafeFiniteNumber = (value: unknown, message: string): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error(message);
  }
  return parsed;
};

export const loadExpenseSourceState = async ({
  accountId,
  db,
  ownerId,
  pocketId,
  transaction,
}: {
  accountId: string;
  db: Firestore;
  ownerId: string;
  pocketId?: string | null;
  transaction: FirestoreTransaction;
}): Promise<ExpenseSourceState> => {
  const accountRef = doc(db, "accounts", accountId);
  const accountSnap = await transaction.get(accountRef);

  if (!accountSnap.exists()) {
    throw new Error("La cuenta seleccionada no existe.");
  }

  const accountData = accountSnap.data();
  if (accountData.ownerId !== ownerId) {
    throw new Error("No tienes permiso para usar esta cuenta.");
  }

  if (!pocketId) {
    const currentBalance = toSafeFiniteNumber(
      accountData.currentBalance ?? accountData.balance,
      "La cuenta tiene un saldo invalido.",
    );

    return {
      accountId,
      pocketId: null,
      accountData,
      pocketData: null,
      availableBalance: currentBalance,
      refs: {
        accountRef,
        pocketRef: null,
      },
    };
  }

  const pocketRef = doc(db, "accounts", accountId, "pockets", pocketId);
  const pocketSnap = await transaction.get(pocketRef);

  if (!pocketSnap.exists()) {
    throw new Error("El bolsillo seleccionado no existe.");
  }

  const pocketData = pocketSnap.data();
  const pocketBalance = toSafeFiniteNumber(
    pocketData.balance ?? pocketData.amount,
    "El bolsillo seleccionado tiene un saldo invalido.",
  );

  return {
    accountId,
    pocketId,
    accountData,
    pocketData,
    availableBalance: pocketBalance,
    refs: {
      accountRef,
      pocketRef,
    },
  };
};

export const assertExpenseSourceHasEnoughBalance = (
  source: ExpenseSourceState,
  amount: number,
): void => {
  if (amount > source.availableBalance) {
    throw new Error(
      source.pocketId
        ? "Saldo insuficiente en el bolsillo seleccionado."
        : "Saldo disponible insuficiente en la cuenta seleccionada.",
    );
  }
};

export const applyExpenseSourceDelta = ({
  amountDelta,
  source,
  transaction,
}: {
  amountDelta: number;
  source: ExpenseSourceState;
  transaction: FirestoreTransaction;
}): void => {
  if (source.pocketId && source.refs.pocketRef) {
    transaction.update(source.refs.pocketRef, {
      balance: source.availableBalance + amountDelta,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const currentBalance = toSafeFiniteNumber(
    source.accountData.currentBalance ?? source.accountData.balance,
    "La cuenta tiene un saldo invalido.",
  );
  transaction.update(source.refs.accountRef, {
    currentBalance: currentBalance + amountDelta,
    updatedAt: serverTimestamp(),
  });
};
