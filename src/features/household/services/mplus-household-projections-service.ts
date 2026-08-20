import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  memberAccountLabelToFirestore,
  memberCategoryLabelToFirestore,
} from "@/lib/mplus/converters";
import {
  memberAccountLabelId,
  memberCategoryLabelId,
  newMutationId,
} from "@/lib/mplus/ids";
import type {
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import {
  memberAccountLabelDocPath,
  memberCategoryLabelDocPath,
} from "@/lib/mplus/paths";

/**
 * Garantiza que exista la proyección mínima de categoría personal en el Hogar (§15.1).
 * Solo el dueño proyecta su etiqueta; ambos miembros activos la leen.
 */
export const ensureMemberCategoryProjection = async (params: {
  householdId: string;
  category: MplusPersonalCategory;
}): Promise<void> => {
  const { householdId, category } = params;
  const db = getFirebaseDb();
  const labelId = memberCategoryLabelId(category.ownerId, category.id);
  const labelRef = doc(db, ...memberCategoryLabelDocPath(householdId, labelId));
  const snap = await getDoc(labelRef);

  const now = Date.now();
  const mutationId = newMutationId();

  if (snap.exists()) {
    const existing = snap.data();
    if (
      existing.name === category.name &&
      existing.iconKey === category.iconKey &&
      existing.color === category.color
    ) {
      return;
    }
    await setDoc(
      labelRef,
      memberCategoryLabelToFirestore({
        id: labelId,
        schemaVersion: 1,
        householdId,
        ownerId: category.ownerId,
        categoryId: category.id,
        type: category.type,
        name: category.name,
        iconKey: category.iconKey,
        color: category.color,
        revision: (existing.revision ?? 1) + 1,
        lastMutationId: mutationId,
        createdAtMillis: existing.createdAt?.toMillis?.() ?? now,
        updatedAtMillis: now,
      }),
      { merge: true },
    );
  } else {
    const labelModel: MplusMemberCategoryLabel = {
      id: labelId,
      schemaVersion: 1,
      householdId,
      ownerId: category.ownerId,
      categoryId: category.id,
      type: category.type,
      name: category.name,
      iconKey: category.iconKey,
      color: category.color,
      revision: 1,
      lastMutationId: mutationId,
      createdAtMillis: now,
      updatedAtMillis: now,
    };
    await setDoc(labelRef, memberCategoryLabelToFirestore(labelModel));
  }
};

/**
 * Garantiza que exista la proyección mínima de cuenta personal en el Hogar (§15.2).
 */
export const ensureMemberAccountProjection = async (params: {
  householdId: string;
  account: MplusPersonalAccount;
}): Promise<void> => {
  const { householdId, account } = params;
  const db = getFirebaseDb();
  const labelId = memberAccountLabelId(account.ownerId, account.id);
  const labelRef = doc(db, ...memberAccountLabelDocPath(householdId, labelId));
  const snap = await getDoc(labelRef);

  const now = Date.now();
  const mutationId = newMutationId();

  if (snap.exists()) {
    const existing = snap.data();
    if (
      existing.name === account.name &&
      existing.type === account.type &&
      existing.iconType === account.iconType &&
      existing.iconKey === account.iconKey &&
      existing.color === account.color
    ) {
      return;
    }
    await setDoc(
      labelRef,
      memberAccountLabelToFirestore({
        id: labelId,
        schemaVersion: 1,
        householdId,
        ownerId: account.ownerId,
        accountId: account.id,
        name: account.name,
        type: account.type,
        iconType: account.iconType,
        iconKey: account.iconKey,
        color: account.color,
        revision: (existing.revision ?? 1) + 1,
        lastMutationId: mutationId,
        createdAtMillis: existing.createdAt?.toMillis?.() ?? now,
        updatedAtMillis: now,
      }),
      { merge: true },
    );
  } else {
    const labelModel: MplusMemberAccountLabel = {
      id: labelId,
      schemaVersion: 1,
      householdId,
      ownerId: account.ownerId,
      accountId: account.id,
      name: account.name,
      type: account.type,
      iconType: account.iconType,
      iconKey: account.iconKey,
      color: account.color,
      revision: 1,
      lastMutationId: mutationId,
      createdAtMillis: now,
      updatedAtMillis: now,
    };
    await setDoc(labelRef, memberAccountLabelToFirestore(labelModel));
  }
};
