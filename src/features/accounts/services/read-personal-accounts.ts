import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { Account } from "@/types/account";

export const readPersonalAccounts = async (ownerId: string): Promise<Account[]> => {
  const db = getFirebaseDb();
  const q = query(collection(db, "accounts"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      ownerId,
      name: toSafeString(data.name, "Cuenta sin nombre"),
      // WEB-V2 decision: usar currentBalance como saldo fuente para evitar doble conteo
      // de bolsillos cuando estos ya representan una desagregacion interna de la cuenta.
      balance: toSafeNumber(data.currentBalance ?? data.balance),
      currency: toSafeString(data.currency, "COP"),
      institutionName: toSafeString(data.institutionName ?? data.bankName),
      type: toSafeString(data.type, "general"),
      updatedAt: toDateOrNull(data.updatedAt ?? data.createdAt),
    };
  });
};