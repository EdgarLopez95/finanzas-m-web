import { doc, collection, writeBatch, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { PERSONAL_INCOME_CATEGORY_SEEDS, shouldSeedPersonalIncomeCategories } from "@/lib/categories/category-seed-catalog";
import { buildPersonalExpenseSeedPlan, type MinimalPersonalCategory } from "@/features/categories/lib/personal-category-seed-plan";

/**
 * Helper dedicado de seed Personal (Bloque 2) — vive fuera del lector puro
 * `read-personal-categories.ts` a propósito. Se dispara desde el store tras
 * una lectura de categorías exitosa (nunca desde el lector).
 *
 * Corrección P1: recuperación segura ante fallos de Firestore.
 * - `inFlight`: evita batches concurrentes duplicados para el mismo owner —
 *   una segunda llamada mientras la primera sigue en vuelo COMPARTE la misma
 *   promesa (un solo batch real), no se descarta en silencio.
 * - `completed`: solo se marca tras un `commit()` exitoso. Si el commit
 *   falla, el owner NUNCA queda marcado como completado, así que una llamada
 *   posterior vuelve a intentar el seed completo desde cero.
 * - Toda la escritura (backfills + gastos deterministas +, si aplica, los 6
 *   ingresos) va en un ÚNICO `writeBatch` atómico: o se aplica todo, o no se
 *   aplica nada — nunca quedan 1–5 ingresos a medio crear.
 *
 * Solo escribe: backfill de `seedKey`/`sortOrder`/`updatedAt` (nunca nombre/
 * ícono/color/archivado) en categorías legacy compatibles, creación con ID
 * determinista de los gastos seed faltantes, y — únicamente si el usuario no
 * tenía NINGUNA categoría antes del seed — los 6 ingresos seed (sin
 * `seedKey` ni ID determinista, paridad Android; IDs no deterministas
 * pre-generados dentro del mismo batch, nunca `addDoc` secuencial).
 */

export interface PersonalCategorySeedBatch {
  set: (id: string, data: Record<string, unknown>) => void;
  update: (id: string, data: Record<string, unknown>) => void;
  commit: () => Promise<void>;
}

export interface PersonalCategorySeedDeps {
  createBatch: () => PersonalCategorySeedBatch;
  /** Genera un ID de documento nuevo (no determinista), sin escribirlo — paridad con Android para ingresos. */
  newIncomeId: () => string;
}

const realPersonalCategorySeedDeps: PersonalCategorySeedDeps = {
  createBatch: () => {
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    return {
      set: (id, data) => batch.set(doc(db, "categories", id), data),
      update: (id, data) => batch.update(doc(db, "categories", id), data),
      commit: () => batch.commit(),
    };
  },
  newIncomeId: () => doc(collection(getFirebaseDb(), "categories")).id,
};

const inFlight = new Map<string, Promise<boolean>>();
const completed = new Set<string>();

/** Solo para pruebas: limpia el estado de deduplicación (inFlight + completed) de una sesión anterior. */
export function resetPersonalCategorySeedState(): void {
  inFlight.clear();
  completed.clear();
}

export async function ensurePersonalCategorySeed(
  ownerId: string,
  existingCategories: MinimalPersonalCategory[],
  deps: PersonalCategorySeedDeps = realPersonalCategorySeedDeps,
): Promise<boolean> {
  if (typeof window === "undefined" && deps === realPersonalCategorySeedDeps) return false;
  if (!ownerId) return false;
  if (completed.has(ownerId)) return false;

  const pending = inFlight.get(ownerId);
  if (pending) return pending;

  const run = (async (): Promise<boolean> => {
    try {
      const plan = buildPersonalExpenseSeedPlan(ownerId, existingCategories);
      const needsIncome = shouldSeedPersonalIncomeCategories(existingCategories.length);

      if (plan.backfills.length === 0 && plan.creations.length === 0 && !needsIncome) {
        completed.add(ownerId);
        return false;
      }

      const batch = deps.createBatch();

      for (const backfill of plan.backfills) {
        batch.update(backfill.categoryId, {
          seedKey: backfill.seedKey,
          sortOrder: backfill.sortOrder,
          updatedAt: serverTimestamp(),
        });
      }

      for (const creation of plan.creations) {
        const seed = creation.definition;
        batch.set(creation.id, {
          ownerId,
          name: seed.personalName,
          parentId: null,
          kind: "expense",
          iconKey: seed.iconKey,
          color: seed.color,
          archived: false,
          createdAt: serverTimestamp(),
          seedKey: seed.seedKey,
          sortOrder: seed.sortOrder,
        });
      }

      if (needsIncome) {
        for (const income of PERSONAL_INCOME_CATEGORY_SEEDS) {
          batch.set(deps.newIncomeId(), {
            ownerId,
            name: income.name,
            parentId: null,
            kind: "income",
            iconKey: income.iconKey,
            color: income.color,
            archived: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      // Invariante: 16 gastos + 6 ingresos como máximo -> 22 operaciones, muy por debajo del límite de Firestore (500).
      await batch.commit();
      completed.add(ownerId);
      return true;
    } catch (error) {
      // No se marca `completed`: una llamada posterior debe poder reintentar el seed completo.
      console.error("No se pudo completar el seed de categorías personales:", error);
      return false;
    } finally {
      inFlight.delete(ownerId);
    }
  })();

  inFlight.set(ownerId, run);
  return run;
}
