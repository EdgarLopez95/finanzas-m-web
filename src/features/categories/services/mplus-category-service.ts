import {
  collection,
  doc,
  getDocs,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { isValidCategoryIcon, normalizedNameKey } from "@/lib/mplus/catalogs";
import {
  personalCategoryFromFirestore,
  personalCategoryToFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
import type { CatalogState, MovementType } from "@/lib/mplus/enums";
import { newMutationId, newUuid } from "@/lib/mplus/ids";
import type { MplusPersonalCategory } from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "@/lib/mplus/mutation-runner";
import { MPLUS_PATHS } from "@/lib/mplus/paths";
import { mplusValidators } from "@/lib/mplus/schemas";

/**
 * Categorias Personales del contrato v1 (§8).
 *
 * Son listas PLANAS: no existen subcategorias ni `parentId`. Ingreso y gasto
 * son catalogos separados que nunca se mezclan, y `type` es inmutable despues
 * de crear.
 *
 * No hay eliminacion fisica fuera de un reinicio (§8.2): lo que la UI ofrece
 * es archivar. Una categoria archivada deja de asignarse a movimientos nuevos,
 * pero el historial la conserva porque el movimiento guarda el ID, no el
 * nombre — por eso renombrar se refleja en todo el historial.
 */

/**
 * `deps` existe solo para pruebas: inyecta el `runTransaction` del SDK.
 */
export type CategoryMutationOptions = Readonly<{
  nowMillis?: number;
  db?: Firestore;
  deps?: MplusRunnerDeps;
}>;

export class CategoryPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryPreconditionError";
  }
}

const categoryRefFor = (db: Firestore, ownerId: string, categoryId: string): DocumentReference =>
  doc(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.categories, categoryId);

/** Todas las categorias del dueño, ordenadas por `sortOrder` y luego nombre. */
export const readMplusCategories = async (
  ownerId: string,
  db: Firestore = getFirebaseDb(),
): Promise<MplusPersonalCategory[]> => {
  const snapshot = await getDocs(
    collection(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.categories),
  );

  return snapshot.docs
    .map((docSnapshot) =>
      personalCategoryFromFirestore(docSnapshot.id, (docSnapshot.data() ?? {}) as FirestoreData),
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "es-CO"),
    );
};

/**
 * Contrato §8.2: la advertencia de nombre duplicado es LOCAL y solo dentro del
 * mismo tipo. No bloquea, no cambia el ID estable y no se persiste.
 */
export const findEquivalentCategoryName = (
  categories: readonly MplusPersonalCategory[],
  type: MovementType,
  name: string,
  excludeId?: string,
): MplusPersonalCategory | null => {
  const key = normalizedNameKey(name);
  return (
    categories.find(
      (category) =>
        category.type === type &&
        category.id !== excludeId &&
        normalizedNameKey(category.name) === key,
    ) ?? null
  );
};

/** Siguiente `sortOrder` libre dentro del catalogo de ese tipo. */
export const nextSortOrderFor = (
  categories: readonly MplusPersonalCategory[],
  type: MovementType,
): number => {
  const sameType = categories.filter((category) => category.type === type);
  if (sameType.length === 0) return 0;
  return Math.max(...sameType.map((category) => category.sortOrder)) + 1;
};

export type CategoryVisual = Readonly<{ iconKey: string; color: string }>;

const assertVisualIsValid = (type: MovementType, visual: CategoryVisual): void => {
  if (!isValidCategoryIcon(type, visual.iconKey)) {
    throw new CategoryPreconditionError(
      `El icono '${visual.iconKey}' no pertenece al catalogo de ${type === "expense" ? "gasto" : "ingreso"}.`,
    );
  }
};

/** Crea una categoria personalizada (sin `seedKey`, contrato §8.1). */
export const createMplusCategory = async (
  ownerId: string,
  type: MovementType,
  name: string,
  visual: CategoryVisual,
  sortOrder: number,
  options?: CategoryMutationOptions & { categoryId?: string },
): Promise<MplusMutationOutcome<MplusPersonalCategory>> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();
  assertVisualIsValid(type, visual);

  const categoryId = options?.categoryId ?? newUuid();
  const mutationId = newMutationId();
  const category = mplusValidators.category({
    id: categoryId,
    schemaVersion: 1,
    ownerId,
    type,
    name: name.trim(),
    iconKey: visual.iconKey,
    color: visual.color,
    state: "active",
    seedKey: null,
    sortOrder,
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
  }) as MplusPersonalCategory;

  const ref = categoryRefFor(db, ownerId, categoryId);

  return runMplusMutation<MplusPersonalCategory>(db, {
    mutationId,
    occ: [{ resource: MPLUS_PATHS.categories, id: categoryId, ref, baseRevision: null }],
    work: (tx) => {
      tx.set(ref, personalCategoryToFirestore(category));
      return category;
    },
  }, options?.deps);
};

type CategoryEdit = Readonly<{
  name?: string;
  visual?: CategoryVisual;
  state?: CatalogState;
}>;

/**
 * Renombrar, cambiar icono/color o archivar/reactivar (contrato §8.2).
 * `type` y `seedKey` no se tocan: el primero es inmutable y el segundo
 * identifica el origen de catalogo aunque el usuario personalice el resto.
 */
export const updateMplusCategory = async (
  current: MplusPersonalCategory,
  edit: CategoryEdit,
  options?: CategoryMutationOptions,
): Promise<MplusMutationOutcome<MplusPersonalCategory>> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  const visual: CategoryVisual = edit.visual ?? {
    iconKey: current.iconKey,
    color: current.color,
  };
  assertVisualIsValid(current.type, visual);

  const mutationId = newMutationId();
  const next = mplusValidators.category({
    ...current,
    name: (edit.name ?? current.name).trim(),
    iconKey: visual.iconKey,
    color: visual.color,
    state: edit.state ?? current.state,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusPersonalCategory;

  const ref = categoryRefFor(db, current.ownerId, current.id);

  return runMplusMutation<MplusPersonalCategory>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.categories,
        id: current.id,
        ref,
        baseRevision: current.revision,
      },
    ],
    work: (tx) => {
      tx.set(ref, personalCategoryToFirestore(next));
      return next;
    },
  }, options?.deps);
};

/** Archiva: deja de ofrecerse en selectores; el historial la conserva. */
export const archiveMplusCategory = (
  current: MplusPersonalCategory,
  options?: CategoryMutationOptions,
) => updateMplusCategory(current, { state: "archived" }, options);

/** Reactiva una categoria archivada. */
export const unarchiveMplusCategory = (
  current: MplusPersonalCategory,
  options?: CategoryMutationOptions,
) => updateMplusCategory(current, { state: "active" }, options);
