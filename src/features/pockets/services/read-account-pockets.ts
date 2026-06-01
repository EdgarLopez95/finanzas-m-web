import { collection, getDocs } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { Pocket } from "@/types/pocket";

export const readAccountPockets = async (accountIds: string[]): Promise<Pocket[]> => {
  if (!accountIds.length) {
    return [];
  }

  const db = getFirebaseDb();

  const snapshots = await Promise.all(
    accountIds.map((accountId) => getDocs(collection(db, "accounts", accountId, "pockets")))
  );

  return snapshots.flatMap((snapshot, index) => {
    const accountId = accountIds[index];

    return snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        accountId,
        name: toSafeString(data.name, "Bolsillo sin nombre"),
        balance: toSafeNumber(data.balance ?? data.amount),
      };
    });
  });
};
