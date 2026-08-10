import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { ICON_DEFAULTS_BY_TYPE, isValidIconCombination, type AccountType, type AccountIconType } from "@/lib/accounts/account-visual-catalog";

export type UpdateAccountInput = {
  ownerId: string;
  accountId: string;
  name: string;
  type: AccountType;
  /**
   * Tipo de ícono seleccionado por el usuario.
   * Si se omite, se usa el default del tipo (no sobreescribe una marca válida
   * con un fallback genérico si el iconKey se pasa explícitamente).
   */
  iconType?: AccountIconType;
  /**
   * Key del ícono/marca seleccionada por el usuario (e.g. "bancolombia", "nequi", "cash").
   * Si se omite, se usa el default del tipo. No se resetea a "bank_generic" si ya tenía marca.
   */
  iconKey?: string;
  color: string;
  includeInTotal: boolean;
};

export const updatePersonalAccount = async (payload: UpdateAccountInput): Promise<void> => {
  const name = payload.name.trim();
  if (!payload.ownerId) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
  if (!name) throw new Error("El nombre de la cuenta es obligatorio.");
  if (!/^#[0-9A-Fa-f]{6}$/.test(payload.color)) throw new Error("Color inválido.");

  // Use explicit iconType/iconKey if provided; fall back to type defaults.
  const defaults = ICON_DEFAULTS_BY_TYPE[payload.type] ?? ICON_DEFAULTS_BY_TYPE.other;
  const iconType = payload.iconType ?? defaults.iconType;
  const iconKey  = payload.iconKey  ?? defaults.iconKey;

  if (!isValidIconCombination(payload.type, iconType, iconKey)) {
    throw new Error(`Combinación inválida de cuenta: tipo=${payload.type}, logo=${iconKey}`);
  }

  const db = getFirebaseDb();

  await updateDoc(doc(db, "accounts", payload.accountId), {
    name,
    type: payload.type,
    iconKey,
    iconType,
    color: payload.color,
    includeInTotal: payload.includeInTotal,
    updatedAt: serverTimestamp(),
  });
};
