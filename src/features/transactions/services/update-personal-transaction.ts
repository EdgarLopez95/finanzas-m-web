import { doc, runTransaction, serverTimestamp, Timestamp, type DocumentReference } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { UpdatePersonalTransactionInput } from "@/types/transaction";

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

export const updatePersonalTransaction = async (payload: UpdatePersonalTransactionInput): Promise<void> => {
  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    if (payload.amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }

    if (payload.type === "transfer" && payload.accountId === payload.targetAccountId) {
      throw new Error("La cuenta origen y destino deben ser diferentes.");
    }

    const movementRef = doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }

    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para editar este movimiento.");
    }

    const previousType = movementData.type;
    if (previousType !== payload.type) {
      throw new Error("No se puede cambiar el tipo de movimiento en esta version.");
    }

    const previousAmount = toSafeFiniteNumber(movementData.amount);
    const previousAccountId = String(movementData.accountId ?? "");
    const previousTargetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;

    if (!previousAccountId) {
      throw new Error("El movimiento anterior no tiene cuenta valida.");
    }

    const accountDelta = new Map<string, number>();
    const addDelta = (accountId: string, delta: number) => {
      accountDelta.set(accountId, (accountDelta.get(accountId) ?? 0) + delta);
    };

    if (payload.type === "expense") {
      addDelta(previousAccountId, previousAmount);
      addDelta(payload.accountId, -payload.amount);
    } else if (payload.type === "income") {
      addDelta(previousAccountId, -previousAmount);
      addDelta(payload.accountId, payload.amount);
    } else {
      if (!previousTargetAccountId) {
        throw new Error("La transferencia anterior no tiene cuenta destino valida.");
      }

      addDelta(previousAccountId, previousAmount);
      addDelta(previousTargetAccountId, -previousAmount);
      addDelta(payload.accountId, -payload.amount);
      addDelta(payload.targetAccountId, payload.amount);
    }

    const accountSnapshots = new Map<string, { ref: DocumentReference; balance: number }>();

    for (const [accountId] of accountDelta) {
      const accountRef = doc(db, "accounts", accountId);
      const accountSnap = await transaction.get(accountRef);

      if (!accountSnap.exists()) {
        throw new Error("Una cuenta asociada al movimiento no existe.");
      }

      const accountData = accountSnap.data();
      if (accountData.ownerId !== payload.ownerId) {
        throw new Error("Solo puedes editar movimientos de cuentas propias.");
      }

      accountSnapshots.set(accountId, {
        ref: accountRef,
        balance: toSafeFiniteNumber(accountData.currentBalance ?? accountData.balance),
      });
    }

    if (payload.type === "expense" || payload.type === "income") {
      const categoryRef = doc(db, "categories", payload.categoryId);
      const categorySnap = await transaction.get(categoryRef);

      if (!categorySnap.exists()) {
        throw new Error("La categoria seleccionada no existe.");
      }

      const categoryData = categorySnap.data();
      if (categoryData.ownerId !== payload.ownerId) {
        throw new Error("No tienes permiso para usar esta categoria.");
      }

      const categoryKind = categoryData.kind ?? categoryData.type;
      if (categoryKind !== payload.type) {
        throw new Error(
          payload.type === "expense"
            ? "La categoria debe ser de tipo gasto."
            : "La categoria debe ser de tipo ingreso."
        );
      }
    }

    for (const [accountId, delta] of accountDelta) {
      if (delta === 0) {
        continue;
      }

      const snapshot = accountSnapshots.get(accountId);
      if (!snapshot) {
        throw new Error("No se pudo resolver una cuenta para actualizar saldo.");
      }

      transaction.update(snapshot.ref, {
        currentBalance: snapshot.balance + delta,
        updatedAt: serverTimestamp(),
      });
    }

    const baseUpdate = {
      amount: payload.amount,
      accountId: payload.accountId,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      updatedAt: serverTimestamp(),
    };

    if (payload.type === "transfer") {
      transaction.update(movementRef, {
        ...baseUpdate,
        targetAccountId: payload.targetAccountId,
        categoryId: null,
      });
      return;
    }

    transaction.update(movementRef, {
      ...baseUpdate,
      categoryId: payload.categoryId,
      targetAccountId: null,
    });
  });
};
