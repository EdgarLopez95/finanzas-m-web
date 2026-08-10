import { doc, writeBatch, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { buildHouseholdExpenseSeedPlan, type MinimalHouseholdCategory } from "@/features/household/lib/household-category-seed-plan";

/**
 * Helper dedicado de seed Hogar (Bloque 2) — vive fuera del lector puro
 * `read-household-categories.ts` a propósito. Solo se dispara desde el store
 * DESPUÉS de confirmar Hogar activo (`household.status !== "dissolved"`) y
 * membresía del usuario actual (`readHousehold` ya lanza si no es miembro) —
 * nunca antes.
 *
 * Corrección P1: recuperación segura ante fallos de Firestore — mismo diseño
 * que `ensure-personal-category-seed.ts`: `inFlight` comparte un único batch
 * real entre llamadas concurrentes para el mismo `householdId`; `completed`
 * solo se marca tras un `commit()` exitoso, así que un fallo nunca bloquea
 * un reintento posterior. Backfills + gastos deterministas van en un ÚNICO
 * `writeBatch` atómico (máximo 16 operaciones, un backfill O una creación
 * por cada uno de los 16 seeds — nunca ambos — muy por debajo del límite de
 * Firestore).
 *
 * Hogar nunca crea ingresos. Solo lee/escribe categorías del propio
 * `householdId` recibido (nunca de otro hogar); no expone datos de otros
 * miembros — el `createdByUserId` de cada creación es siempre quien dispara
 * el seed (el usuario actual ya confirmado como miembro).
 */

export interface HouseholdCategorySeedBatch {
  set: (id: string, data: Record<string, unknown>) => void;
  update: (id: string, data: Record<string, unknown>) => void;
  commit: () => Promise<void>;
}

export interface HouseholdCategorySeedDeps {
  createBatch: () => HouseholdCategorySeedBatch;
}

const realHouseholdCategorySeedDeps: HouseholdCategorySeedDeps = {
  createBatch: () => {
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    return {
      set: (id, data) => batch.set(doc(db, "household_categories", id), data),
      update: (id, data) => batch.update(doc(db, "household_categories", id), data),
      commit: () => batch.commit(),
    };
  },
};

const inFlight = new Map<string, Promise<boolean>>();
const completed = new Set<string>();

/** Solo para pruebas: limpia el estado de deduplicación (inFlight + completed) de una sesión anterior. */
export function resetHouseholdCategorySeedState(): void {
  inFlight.clear();
  completed.clear();
}

export async function ensureHouseholdCategorySeed(
  householdId: string,
  createdByUserId: string,
  existingCategories: MinimalHouseholdCategory[],
  deps: HouseholdCategorySeedDeps = realHouseholdCategorySeedDeps,
): Promise<boolean> {
  if (typeof window === "undefined" && deps === realHouseholdCategorySeedDeps) return false;
  if (!householdId || !createdByUserId) return false;
  if (completed.has(householdId)) return false;

  const pending = inFlight.get(householdId);
  if (pending) return pending;

  const run = (async (): Promise<boolean> => {
    try {
      const plan = buildHouseholdExpenseSeedPlan(householdId, existingCategories);

      if (plan.backfills.length === 0 && plan.creations.length === 0) {
        completed.add(householdId);
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
          householdId,
          name: seed.householdName,
          parentId: null,
          kind: "expense",
          iconKey: seed.iconKey,
          color: seed.color,
          archived: false,
          createdByUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          seedKey: seed.seedKey,
          sortOrder: seed.sortOrder,
        });
      }

      await batch.commit();
      completed.add(householdId);
      return true;
    } catch (error) {
      // No se marca `completed`: una llamada posterior debe poder reintentar el seed completo.
      console.error("No se pudo completar el seed de categorías del hogar:", error);
      return false;
    } finally {
      inFlight.delete(householdId);
    }
  })();

  inFlight.set(householdId, run);
  return run;
}
