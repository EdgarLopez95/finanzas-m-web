import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type AccountType = "bank" | "digital_wallet" | "cash" | "savings" | "other";

export type CreateAccountInput = {
  ownerId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  includeInTotal: boolean;
};

/**
 * Defaults de ícono por tipo. No existe (todavía) un selector de banco en web,
 * así que todos los tipos usan iconType "generic" con un iconKey representativo.
 * Si más adelante se agrega selector de banco, bank podría usar "bank_logo".
 */
const ICON_DEFAULTS: Record<AccountType, { iconType: "bank_logo" | "generic"; iconKey: string }> = {
  bank: { iconType: "generic", iconKey: "bank" },
  digital_wallet: { iconType: "generic", iconKey: "wallet" },
  cash: { iconType: "generic", iconKey: "cash" },
  savings: { iconType: "generic", iconKey: "savings" },
  other: { iconType: "generic", iconKey: "account" },
};

/**
 * Crea una cuenta personal en la colección top-level `accounts/{accountId}`,
 * usando el esquema compartido con Android. No crea bolsillos: los bolsillos
 * viven después en `accounts/{accountId}/pockets/{pocketId}`.
 *
 * Reglas del modelo:
 * - currentBalance se inicializa igual a initialBalance.
 * - archived siempre false al crear.
 * - createdAt con serverTimestamp().
 * - No se escribe updatedAt ni currency (el modelo no los usa al crear).
 */
export const createPersonalAccount = async (payload: CreateAccountInput): Promise<string> => {
  const db = getFirebaseDb();
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

  const icons = ICON_DEFAULTS[payload.type] ?? ICON_DEFAULTS.other;
  const accountRef = doc(collection(db, "accounts"));

  await setDoc(accountRef, {
    ownerId: payload.ownerId,
    name,
    type: payload.type,
    iconType: icons.iconType,
    iconKey: icons.iconKey,
    color: payload.color,
    initialBalance,
    currentBalance: initialBalance,
    includeInTotal: payload.includeInTotal,
    archived: false,
    createdAt: serverTimestamp(),
  });

  return accountRef.id;
};
