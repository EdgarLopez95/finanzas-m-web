import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import {
  AccountPreconditionError,
  archiveMplusAccount,
  createMplusAccount,
  unarchiveMplusAccount,
  updateMplusAccount,
} from "../../src/features/accounts/services/mplus-account-service";
import {
  CategoryPreconditionError,
  archiveMplusCategory,
  createMplusCategory,
  findEquivalentCategoryName,
  nextSortOrderFor,
  updateMplusCategory,
} from "../../src/features/categories/services/mplus-category-service";
import { millisToTimestamp } from "../../src/lib/mplus/converters";
import type { MplusPersonalAccount, MplusPersonalCategory } from "../../src/lib/mplus/models";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";

/**
 * Cuentas y categorias Personales (contrato §7 y §8).
 *
 * Lo que se protege aqui:
 *
 *  - una cuenta nace SIN referencias y renombrar/archivar NUNCA toca sus
 *    contadores (§7.3): moverlos fuera de la transaccion del movimiento es lo
 *    que las Rules rechazan con `affectedKeys`;
 *  - el catalogo visual se valida antes de escribir, en cliente;
 *  - `type` y `seedKey` de una categoria sobreviven a cualquier edicion (§8.2);
 *  - la advertencia de nombre repetido es local, por tipo, y no bloquea.
 */

export const runMplusCatalogServiceTests = async (): Promise<void> => {
  const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);
  const OWNER = "uid-1";

  type Recorded = { path: string; data: Record<string, unknown> };

  const makeDeps = (recorded: Recorded[]): MplusRunnerDeps => ({
    runTransaction: (async (_db: Firestore, fn: (tx: Transaction) => Promise<unknown>) => {
      const tx = {
        get: async (ref: DocumentReference) =>
          ({ exists: () => false, data: () => undefined, id: ref.id }) as unknown as DocumentSnapshot,
        set: (ref: DocumentReference, data: Record<string, unknown>) => {
          recorded.push({ path: ref.path, data });
          return tx;
        },
        update: (ref: DocumentReference, data: Record<string, unknown>) => {
          recorded.push({ path: ref.path, data });
          return tx;
        },
        delete: () => tx,
      } as unknown as Transaction;
      return await fn(tx);
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  /** Igual que el anterior pero con el documento ya presente y su revision. */
  const makeExistingDeps = (
    recorded: Recorded[],
    remote: Record<string, unknown>,
  ): MplusRunnerDeps => ({
    runTransaction: (async (_db: Firestore, fn: (tx: Transaction) => Promise<unknown>) => {
      const tx = {
        get: async (ref: DocumentReference) =>
          ({ exists: () => true, data: () => remote, id: ref.id }) as unknown as DocumentSnapshot,
        set: (ref: DocumentReference, data: Record<string, unknown>) => {
          recorded.push({ path: ref.path, data });
          return tx;
        },
        update: (ref: DocumentReference, data: Record<string, unknown>) => {
          recorded.push({ path: ref.path, data });
          return tx;
        },
        delete: () => tx,
      } as unknown as Transaction;
      return await fn(tx);
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  const db: Firestore = getFirestore(
    initializeApp({ apiKey: "dummy", projectId: "dummy" }, "mplus-catalog-services-test"),
  );

  const account: MplusPersonalAccount = {
    id: "acc-1",
    schemaVersion: 1,
    ownerId: OWNER,
    name: "Bancolombia",
    type: "bank",
    iconType: "bank_logo",
    iconKey: "bancolombia",
    color: "#2563EB",
    state: "active",
    referenceCount: 7,
    lastReferenceMovementId: "mov-9",
    revision: 4,
    lastMutationId: "11111111-1111-4111-8111-111111111111",
    createdAtMillis: NOW - 10_000,
    updatedAtMillis: NOW - 10_000,
  };

  const category: MplusPersonalCategory = {
    id: "seed_expense_groceries",
    schemaVersion: 1,
    ownerId: OWNER,
    type: "expense",
    name: "Mercado",
    iconKey: "groceries",
    color: "#22C55E",
    state: "active",
    seedKey: "groceries",
    sortOrder: 0,
    revision: 2,
    lastMutationId: "22222222-2222-4222-8222-222222222222",
    createdAtMillis: NOW - 10_000,
    updatedAtMillis: NOW - 10_000,
  };

  // --- crear cuenta: nace sin referencias ---
  {
    const recorded: Recorded[] = [];
    const outcome = await createMplusAccount(
      OWNER,
      "  Nequi  ",
      { type: "digital_wallet", iconType: "bank_logo", iconKey: "nequi", color: "#A855F7" },
      { nowMillis: NOW, db, deps: makeDeps(recorded), accountId: "acc-new" },
    );

    assert.equal(outcome.kind, "success");
    const written = recorded[0].data;
    assert.equal(written.referenceCount, 0, "una cuenta nueva no referencia nada todavia");
    assert.equal(written.lastReferenceMovementId, null);
    assert.equal(written.revision, 1);
    assert.equal(written.state, "active");
    assert.equal(written.name, "Nequi", "el nombre viaja recortado");
    // En M+ una cuenta no guarda dinero: ningun campo de saldo puede aparecer.
    for (const retired of ["balance", "currency", "includeInTotal", "institutionName"]) {
      assert.equal(retired in written, false, `${retired} no pertenece al contrato v1`);
    }
  }

  // --- catalogo visual invalido: se rechaza antes de escribir ---
  {
    const recorded: Recorded[] = [];
    await assert.rejects(
      () =>
        createMplusAccount(
          OWNER,
          "Rara",
          // `cash` solo admite iconType generic + iconKey cash.
          { type: "cash", iconType: "bank_logo", iconKey: "bancolombia", color: "#2563EB" },
          { nowMillis: NOW, db, deps: makeDeps(recorded) },
        ),
      AccountPreconditionError,
    );
    assert.equal(recorded.length, 0);
  }

  // --- renombrar / archivar: los contadores viajan intactos (§7.3) ---
  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 4, lastMutationId: "otro" });
    const outcome = await updateMplusAccount(
      account,
      { name: "Banco principal" },
      { nowMillis: NOW, db, deps },
    );

    assert.equal(outcome.kind, "success");
    const written = recorded[0].data;
    assert.equal(written.name, "Banco principal");
    assert.equal(written.referenceCount, 7, "renombrar no puede mover el contador");
    assert.equal(written.lastReferenceMovementId, "mov-9");
    assert.equal(written.revision, 5, "revision sube exactamente en uno");
    assert.deepEqual(
      written.createdAt,
      millisToTimestamp(account.createdAtMillis),
      "createdAt es inmutable",
    );
  }

  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 4, lastMutationId: "otro" });
    await archiveMplusAccount(account, { nowMillis: NOW, db, deps });
    assert.equal(recorded[0].data.state, "archived");
    assert.equal(recorded[0].data.referenceCount, 7, "archivar tampoco mueve el contador");
  }

  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 4, lastMutationId: "otro" });
    await unarchiveMplusAccount({ ...account, state: "archived" }, { nowMillis: NOW, db, deps });
    assert.equal(recorded[0].data.state, "active");
  }

  // --- conflicto de revision en una cuenta: no se escribe nada ---
  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 99, lastMutationId: "de-otro" });
    const outcome = await updateMplusAccount(account, { name: "X" }, { nowMillis: NOW, db, deps });
    assert.equal(outcome.kind, "conflict");
    assert.equal(recorded.length, 0);
  }

  // --- crear categoria personalizada: sin seedKey ---
  {
    const recorded: Recorded[] = [];
    const outcome = await createMplusCategory(
      OWNER,
      "income",
      "Arriendos",
      { iconKey: "rental_income", color: "#0EA5E9" },
      6,
      { nowMillis: NOW, db, deps: makeDeps(recorded), categoryId: "cat-new" },
    );

    assert.equal(outcome.kind, "success");
    const written = recorded[0].data;
    assert.equal(written.seedKey, null, "una categoria propia no tiene clave de catalogo");
    assert.equal(written.type, "income");
    assert.equal(written.sortOrder, 6);
    assert.equal(written.state, "active");
    assert.equal("parentId" in written, false, "el contrato v1 no tiene subcategorias");
  }

  // --- icono fuera del catalogo del tipo: se rechaza ---
  {
    const recorded: Recorded[] = [];
    await assert.rejects(
      () =>
        createMplusCategory(
          OWNER,
          "income",
          "Rara",
          // `groceries` es un icono de gasto.
          { iconKey: "groceries", color: "#0EA5E9" },
          0,
          { nowMillis: NOW, db, deps: makeDeps(recorded) },
        ),
      CategoryPreconditionError,
    );
    assert.equal(recorded.length, 0);
  }

  // --- editar categoria: type y seedKey son inmutables (§8.2) ---
  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 2, lastMutationId: "otro" });
    await updateMplusCategory(
      category,
      { name: "Mercado y despensa", visual: { iconKey: "food", color: "#EF4444" } },
      { nowMillis: NOW, db, deps },
    );

    const written = recorded[0].data;
    assert.equal(written.name, "Mercado y despensa");
    assert.equal(written.iconKey, "food");
    assert.equal(written.type, "expense", "el tipo no cambia nunca");
    assert.equal(written.seedKey, "groceries", "la clave de catalogo sobrevive a la personalizacion");
    assert.equal(written.revision, 3);
  }

  // --- archivar categoria ---
  {
    const recorded: Recorded[] = [];
    const deps = makeExistingDeps(recorded, { revision: 2, lastMutationId: "otro" });
    await archiveMplusCategory(category, { nowMillis: NOW, db, deps });
    assert.equal(recorded[0].data.state, "archived");
  }

  // --- advertencia de nombre repetido: local, por tipo y sin bloquear ---
  {
    const catalog: MplusPersonalCategory[] = [
      category,
      { ...category, id: "cat-income", type: "income", name: "Mercado", seedKey: null },
    ];

    assert.equal(
      findEquivalentCategoryName(catalog, "expense", "  MERCADO  ")?.id,
      "seed_expense_groceries",
      "ignora mayusculas y espacios",
    );
    assert.equal(
      findEquivalentCategoryName(catalog, "expense", "Mercado", "seed_expense_groceries"),
      null,
      "la propia categoria no se reporta como duplicado al editarla",
    );
    assert.equal(
      findEquivalentCategoryName(catalog, "income", "Salario"),
      null,
      "un nombre nuevo no dispara advertencia",
    );
  }

  // --- sortOrder siguiente por tipo ---
  {
    const catalog: MplusPersonalCategory[] = [
      { ...category, id: "a", sortOrder: 0 },
      { ...category, id: "b", sortOrder: 5 },
      { ...category, id: "c", type: "income", sortOrder: 12 },
    ];
    assert.equal(nextSortOrderFor(catalog, "expense"), 6);
    assert.equal(nextSortOrderFor(catalog, "income"), 13);
    assert.equal(nextSortOrderFor([], "expense"), 0);
  }

  console.log("OK mplus-catalog-services");
};

void runMplusCatalogServiceTests().catch((error) => {
  console.error("Test failure in mplus-catalog-services.test.ts:", error);
  process.exit(1);
});
