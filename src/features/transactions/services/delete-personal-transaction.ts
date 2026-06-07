import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

type DeletePersonalTransactionInput = {
  ownerId: string;
  transactionId: string;
};

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

export const deletePersonalTransaction = async (payload: DeletePersonalTransactionInput): Promise<void> => {
  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    const movementRef = doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }

    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para eliminar este movimiento.");
    }

    const type = String(movementData.type ?? "");
    const amount = toSafeFiniteNumber(movementData.amount);
    const accountId = String(movementData.accountId ?? "");
    const targetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;

    if (!accountId) {
      throw new Error("El movimiento no tiene cuenta valida.");
    }

    const accountDelta = new Map<string, number>();
    const addDelta = (id: string, delta: number) => {
      accountDelta.set(id, (accountDelta.get(id) ?? 0) + delta);
    };

    if (type === "expense") {
      addDelta(accountId, amount);
    } else if (type === "income") {
      addDelta(accountId, -amount);
    } else if (type === "transfer") {
      if (!targetAccountId) {
        throw new Error("La transferencia no tiene cuenta destino valida.");
      }
      addDelta(accountId, amount);
      addDelta(targetAccountId, -amount);
    } else {
      throw new Error("Este tipo de movimiento no se puede eliminar en WEB-V4B.");
    }

    for (const [id, delta] of accountDelta) {
      if (delta === 0) {
        continue;
      }

      const accountRef = doc(db, "accounts", id);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("Una cuenta asociada al movimiento no existe.");
      }

      const accountData = accountSnap.data();
      if (accountData.ownerId !== payload.ownerId) {
        throw new Error("Solo puedes eliminar movimientos de cuentas propias.");
      }

      const balance = toSafeFiniteNumber(accountData.currentBalance ?? accountData.balance);
      transaction.update(accountRef, {
        currentBalance: balance + delta,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.delete(movementRef);
  });
};
