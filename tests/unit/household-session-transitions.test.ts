
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Timestamp } from "firebase/firestore";

import {
  dissolveHousehold,
  WIPE_PAGE_SIZE,
} from "../../src/features/household/services/dissolve-household";
import {
  confirmHouseholdGoneThenResolve,
  handleListenerError,
  HOUSEHOLD_GONE_CONFIRM_MAX_RETRIES,
} from "../../src/features/household/hooks/use-household-session-subscriptions";
import {
  generateCode,
  generateHouseholdInviteCode,
} from "../../src/features/household/services/generate-household-invite-code";
import {
  joinHouseholdByInviteCode,
} from "../../src/features/household/services/join-household-by-invite-code";
import {
  createHouseholdDataStore,
  useHouseholdDataStore,
} from "../../src/stores/household-data-store";
import type { Household } from "../../src/types/household";
import { usePersonalDataStore } from "../../src/stores/personal-data-store";
import { subscriptionRegistry } from "../../src/lib/firestore/subscription-registry";

console.log("Running instrumental unit tests for household-session-transitions.test.ts...");

const createMockHousehold = (
  id: string,
  ownerId: string,
  memberIds: string[],
  status: "active" | "dissolved" = "active"
): Household => ({
  id,
  name: `Hogar ${id}`,
  ownerId,
  memberIds,
  memberCount: memberIds.length,
  inviteCode: "INVITE88",
  inviteCodeExpiresAt: new Date(Date.now() + 86400000),
  status,
});

async function runHouseholdTests() {
  // Test 1: dissolveHousehold paginado real (801 docs en 3 batches <= 400 con orden exacto de Android)
  {
    const operationOrder: string[] = [];
    const committedBatches: number[] = [];

    const mockDb: Record<string, number> = {
      household_income_entries: 801,
      household_event_shares: 0,
      household_debts: 0,
      household_review_items: 0,
      household_categories: 0,
      household_events: 0,
    };

    await dissolveHousehold("hh-paginated", "owner1", {
      getHouseholdDoc: async () => ({
        exists: true,
        data: () => ({ ownerId: "owner1", inviteCode: "INVITE88" }),
      }),
      wipeCollectionPage: async (colName, hhId, pageSize) => {
        operationOrder.push(`query:${colName}`);
        const currentCount = mockDb[colName] || 0;
        const countToFetch = Math.min(currentCount, pageSize);
        mockDb[colName] = currentCount - countToFetch;
        const fakeRefs = Array.from({ length: countToFetch }, (_, i) => ({ col: colName, i }));
        return {
          docRefs: fakeRefs,
          hasMore: mockDb[colName] > 0,
        };
      },
      commitBatchDelete: async (refs) => {
        assert.ok(refs.length <= WIPE_PAGE_SIZE, `Batch size ${refs.length} must not exceed WIPE_PAGE_SIZE (400)`);
        committedBatches.push(refs.length);
        const first = refs[0] as { col: string };
        operationOrder.push(`commitBatch:${first.col}:${refs.length}`);
      },
      deleteInviteDoc: async (code) => {
        operationOrder.push(`deleteInvite:${code}`);
      },
      deleteHouseholdDoc: async (id) => {
        operationOrder.push(`deleteHousehold:${id}`);
      },
      clearOwnerActiveHousehold: async (uid) => {
        operationOrder.push(`clearOwner:${uid}`);
      },
    });

    assert.deepStrictEqual(committedBatches, [400, 400, 1], "801 docs must be committed in exactly 3 paginated batches [400, 400, 1]");

    const firstSubcolIdx = operationOrder.findIndex((op) => op.startsWith("query:household_income_entries"));
    const inviteIdx = operationOrder.findIndex((op) => op === "deleteInvite:INVITE88");
    const parentIdx = operationOrder.findIndex((op) => op === "deleteHousehold:hh-paginated");
    const ownerIdx = operationOrder.findIndex((op) => op === "clearOwner:owner1");

    assert.ok(firstSubcolIdx < inviteIdx, "Subcollections must be wiped before invite doc");
    assert.ok(inviteIdx < parentIdx, "Invite doc must be wiped before household parent doc");
    assert.ok(parentIdx < ownerIdx, "Household parent doc must be wiped before owner activeHouseholdId clear");

    console.log("  ✓ Test 1: dissolveHousehold pagina colecciones de 801 docs en 3 batches <= 400 con el orden exacto de Android");
  }

  // Test 2: Resiliencia de dissolveHousehold ante fallo puntual en una subcolección
  {
    const steps: string[] = [];

    await dissolveHousehold("hh-resilient", "owner1", {
      getHouseholdDoc: async () => ({
        exists: true,
        data: () => ({ ownerId: "owner1", inviteCode: null }),
      }),
      wipeCollectionPage: async (colName) => {
        if (colName === "household_debts") {
          throw new Error("Fallo simulación red en household_debts");
        }
        return { docRefs: [{ col: colName }], hasMore: false };
      },
      commitBatchDelete: async () => {},
      deleteHouseholdDoc: async (id) => {
        steps.push(`deletedParent:${id}`);
      },
      clearOwnerActiveHousehold: async (uid) => {
        steps.push(`clearedOwner:${uid}`);
      },
    });

    assert.ok(steps.includes("deletedParent:hh-resilient"), "Failure in 1 subcollection must NOT stop parent hard-delete");
    assert.ok(steps.includes("clearedOwner:owner1"), "Failure in 1 subcollection must NOT stop owner deleteField()");
    console.log("  ✓ Test 2: Error puntual en subcolección no detiene la disolución final del documento del hogar");
  }

  // Test 3: Función compartida confirmHouseholdGoneThenResolve (las 5 resoluciones de Android)
  {
    const resA = await confirmHouseholdGoneThenResolve("hh-1", "u1", async () => ({
      exists: true,
      data: () => ({ memberIds: ["u1", "u2"] }),
    }));
    assert.strictEqual(resA, "KeepTransient");

    const resB = await confirmHouseholdGoneThenResolve("hh-1", "u1", async () => ({
      exists: true,
      data: () => ({ memberIds: ["u2"] }),
    }));
    assert.strictEqual(resB, "RemovedFromMembers");

    const resC = await confirmHouseholdGoneThenResolve("hh-1", "u1", async () => ({
      exists: false,
      data: () => ({}),
    }));
    assert.strictEqual(resC, "ConfirmedDeleted");

    let retries = 0;
    const resD = await confirmHouseholdGoneThenResolve("hh-1", "u1", async () => {
      retries++;
      throw { code: "permission-denied", message: "permission-denied" };
    });
    assert.strictEqual(retries, HOUSEHOLD_GONE_CONFIRM_MAX_RETRIES);
    assert.strictEqual(resD, "ConfirmedDeleted");

    const resE = await confirmHouseholdGoneThenResolve("hh-1", "u1", async () => {
      throw { code: "unavailable", message: "Network unavailable" };
    });
    assert.strictEqual(resE, "NonFatalError");

    console.log("  ✓ Test 3: confirmHouseholdGoneThenResolve evalúa correctamente las 5 resoluciones de la política Android");
  }

  // Test 4: H1.2 - Normalización, alfabeto de 8 caracteres y expiración de 7 días exactos en generateHouseholdInviteCode
  {
    const code = generateCode();
    assert.strictEqual(code.length, 8, "Code must have exactly 8 characters");
    const canonicalAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (const char of code) {
      assert.ok(canonicalAlphabet.includes(char), `Character '${char}' must belong to canonical Android alphabet`);
    }

    let generatedExpiresAt: Timestamp | null = null;
    let deletedOldCode: string | null = null;

    const newGeneratedCode = await generateHouseholdInviteCode(
      { householdId: "hh-invite-1", uid: "member1" },
      {
        getHouseholdDoc: async () => ({
          exists: true,
          data: () => ({
            ownerId: "owner1",
            memberIds: ["owner1", "member1"], // Permite regenerar teniendo 2 miembros (Semántica Android)
            status: "active",
            inviteCode: "OLDCODE1",
          }),
        }),
        commitTransaction: async ({ newCode, expiresAt, oldCode }) => {
          generatedExpiresAt = expiresAt;
          deletedOldCode = oldCode;
        },
      }
    );

    assert.strictEqual(newGeneratedCode.length, 8);
    assert.strictEqual(deletedOldCode, "OLDCODE1", "Old invite code must be deleted in atomic transaction");
    // commitTransaction asigna en callback: CFA deja el let en null y assert.ok colapsa a never.
    const expiresAtValue = generatedExpiresAt as Timestamp | null;
    assert.notEqual(expiresAtValue, null, "expiresAt must be generated");
    const expiresMs = expiresAtValue!.toMillis();
    const diffDays = (expiresMs - Date.now()) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays > 6.99 && diffDays <= 7.01, `Expiration must be 7 days exact (got ${diffDays} days)`);

    console.log("  ✓ Test 4: H1.2 — Normalización, alfabeto Android de 8 caracteres, 7 días de expiración y regeneración con 2 miembros");
  }

  // Test 5: H1.2 - Join por invitación compatible con Security Rules (0 pre-lecturas de household o user, solo GET directo a invite)
  {
    let householdDocPreReads = 0;
    let userDocPreReads = 0;
    let commitCallCount = 0;

    const joinedHhId = await joinHouseholdByInviteCode(
      { inviteCode: "  valid888 ", uid: "newGuestUser" },
      {
        getInviteDoc: async (code) => {
          assert.strictEqual(code, "VALID888", "Code must be normalized to uppercase trimmed without spaces");
          return {
            exists: true,
            data: () => ({
              householdId: "hh-target-rules",
              expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
            }),
          };
        },
        getHouseholdDoc: async () => {
          householdDocPreReads++;
          return { exists: true, data: () => ({ status: "active", memberIds: ["owner1"] }) };
        },
        commitJoin: async () => {
          commitCallCount++;
        },
      }
    );

    assert.strictEqual(joinedHhId, "hh-target-rules");
    assert.strictEqual(householdDocPreReads, 0, "MUST NOT pre-read household doc before batch commit (Rule compliance)");
    assert.strictEqual(userDocPreReads, 0, "MUST NOT pre-read user doc before batch commit (Rule compliance)");
    assert.strictEqual(commitCallCount, 1, "commitJoin must be called exactly once");

    console.log("  ✓ Test 5: H1.2 — Join por invitación compatible con Rules (0 pre-lecturas de household o user antes del batch)");
  }

  // Test 6: H1.2 - Rechazo de invites ausentes, corruptos, expirados y rechazo de Rules ante permiso denegado
  {
    // 6a. Invite ausente
    await assert.rejects(
      async () =>
        joinHouseholdByInviteCode(
          { inviteCode: "MISSING8", uid: "u1" },
          {
            getInviteDoc: async () => ({ exists: false, data: () => ({}) }),
            commitJoin: async () => {},
          }
        ),
      /No encontramos un hogar con ese código/
    );

    // 6b. Invite corrupto (falta householdId)
    await assert.rejects(
      async () =>
        joinHouseholdByInviteCode(
          { inviteCode: "CORRUPT8", uid: "u1" },
          {
            getInviteDoc: async () => ({ exists: true, data: () => ({ expiresAt: new Date() }) }),
            commitJoin: async () => {},
          }
        ),
      /Código corrupto/
    );

    // 6c. Invite expirado
    await assert.rejects(
      async () =>
        joinHouseholdByInviteCode(
          { inviteCode: "EXPIRED8", uid: "u1" },
          {
            getInviteDoc: async () => ({
              exists: true,
              data: () => ({
                householdId: "hh-1",
                expiresAt: Timestamp.fromDate(new Date(Date.now() - 1000)),
              }),
            }),
            commitJoin: async () => {},
          }
        ),
      /Este código expiró/
    );

    // 6d. Denegación de Rules en commitJoin (e.g. hogar lleno o disuelto) -> Mensaje amigable Android
    await assert.rejects(
      async () =>
        joinHouseholdByInviteCode(
          { inviteCode: "DENIED88", uid: "uDenied" },
          {
            getInviteDoc: async () => ({
              exists: true,
              data: () => ({
                householdId: "hh-full",
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
              }),
            }),
            getHouseholdDoc: async () => ({
              exists: true,
              data: () => ({ status: "active", memberIds: ["u1", "u2"] }), // Recheck confirma que uDenied NO es miembro
            }),
            commitJoin: async () => {
              throw { code: "permission-denied", message: "permission-denied" };
            },
          }
        ),
      /Este hogar ya no acepta nuevos miembros/
    );

    console.log("  ✓ Test 6: H1.2 — Rechazo de invites ausentes, corruptos, expirados y denegados por Security Rules");
  }

  // Test 7: H1.2 - Reconciliación idempotente post-permission-denied y preservación de errores de red
  {
    // 7a. Permission-denied donde el usuario YA es miembro -> Éxito idempotente
    const resIdempotent = await joinHouseholdByInviteCode(
      { inviteCode: "IDEMPO88", uid: "memberJoiner" },
      {
        getInviteDoc: async () => ({
          exists: true,
          data: () => ({
            householdId: "hh-idempotent",
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
          }),
        }),
        getHouseholdDoc: async () => ({
          exists: true,
          data: () => ({ status: "active", memberIds: ["owner1", "memberJoiner"] }),
        }),
        commitJoin: async () => {
          throw { code: "permission-denied", message: "permission-denied" };
        },
      }
    );
    assert.strictEqual(resIdempotent, "hh-idempotent", "permission-denied where user is already member must resolve as idempotent success");

    // 7b. Error de red -> error preservado (NO se traduce a disuelto)
    await assert.rejects(
      async () =>
        joinHouseholdByInviteCode(
          { inviteCode: "NETWORK8", uid: "uNet" },
          {
            getInviteDoc: async () => ({
              exists: true,
              data: () => ({
                householdId: "hh-net",
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
              }),
            }),
            commitJoin: async () => {
              throw { code: "unavailable", message: "Firestore unavailable" };
            },
          }
        ),
      /Firestore unavailable/
    );

    console.log("  ✓ Test 7: H1.2 — Reconciliación idempotente post-permission-denied y preservación de errores de red");
  }

  // Test 8: Callback tardío de usuario/sesión anterior no altera la sesión vigente
  {
    const store = createHouseholdDataStore({
      readActiveHouseholdId: async (uid) => `hh-${uid}`,
      readHousehold: async (id, uid) => createMockHousehold(id, uid, [uid]),
      readHouseholdEvents: async () => [],
      readHouseholdEventShares: async () => [],
      readHouseholdCategories: async () => [],
      readHouseholdDebts: async () => [],
      readHouseholdIncomeEntries: async () => [],
      readHouseholdMemberProfiles: async () => ({}),
    });

    await store.getState().load("userA");
    assert.strictEqual(store.getState().data.activeHouseholdId, "hh-userA");

    await store.getState().load("userB");
    assert.strictEqual(store.getState().data.activeHouseholdId, "hh-userB");

    store.getState().applyHouseholdSnapshot(
      { household: createMockHousehold("hh-userA", "userA", ["userA"]) },
      "userA"
    );

    const state = store.getState();
    assert.strictEqual(state.uid, "userB");
    assert.strictEqual(state.data.activeHouseholdId, "hh-userB");
    assert.strictEqual(state.data.household?.id, "hh-userB");
    console.log("  ✓ Test 8: Callback tardío de sesión anterior no altera la sesión vigente");
  }

  // Test 10: Discriminación estricta de estados (loading/empty/dissolved/success) en applyHouseholdSnapshot
  {
    const store = createHouseholdDataStore();
    store.setState({ status: "loading", uid: "userA", data: { ...store.getState().data, activeHouseholdId: "hh-1" } });

    // 10a. Snapshot de colección secundaria mientras household es null NO transiciona a success
    store.getState().applyHouseholdSnapshot({ events: [{ id: "ev-1", householdId: "hh-1", title: "Gasto", amount: 100, notes: '', categoryId: 'cat1', isActive: true, createdByUserId: "u1", paidByUserId: "u1", status: "active", settlementMode: "invitation", eventDate: new Date(), createdAt: new Date() }] }, "userA");
    assert.strictEqual(store.getState().status, "loading", "Status must remain loading while household metadata is null");
    assert.strictEqual(store.getState().data.events.length, 1, "Events partial updated in state");

    // 10b. Con household metadata válida, pasa a success
    const mockHh = createMockHousehold("hh-1", "userA", ["userA"]);
    store.getState().applyHouseholdSnapshot({ household: mockHh }, "userA");
    assert.strictEqual(store.getState().status, "success", "Status transitions to success when household metadata arrives");

    // 10c. Con household disuelto, pasa a dissolved
    const mockDissolved = createMockHousehold("hh-1", "userA", ["userA"], "dissolved");
    store.getState().applyHouseholdSnapshot({ household: mockDissolved }, "userA");
    assert.strictEqual(store.getState().status, "dissolved", "Status transitions to dissolved for dissolved household");

    // 10d. Con activeHouseholdId null, pasa a empty
    store.getState().applyHouseholdSnapshot({ activeHouseholdId: null }, "userA");
    assert.strictEqual(store.getState().status, "empty", "Status transitions to empty when activeHouseholdId is null");

    console.log("  ✓ Test 10: H1.8 — Discriminación estricta de estados (loading/empty/dissolved/success) verificada");
  }

  // Test 11: Pruebas instrumentadas del manejador real handleListenerError con contadores de escritura
  {
    // 11a. Transitorio (KeepTransient): 0 writes, sesión preservada
    {
      let remoteWrites = 0;
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", "userA", ["userA"]) },
      });

      await handleListenerError("hh-1", "userA", new Error("transient"), {
        confirmHouseholdGoneThenResolve: async () => "KeepTransient",
        clearRemoteActiveHousehold: async () => { remoteWrites++; },
        getDocFn: async () => ({ exists: true, data: () => ({ name: "Hogar hh-1", ownerId: "userA", memberIds: ["userA"], memberCount: 1, inviteCode: "INV88", status: "active" }) }),
      });

      assert.strictEqual(remoteWrites, 0, "KeepTransient must perform 0 remote writes");
      assert.strictEqual(useHouseholdDataStore.getState().data.activeHouseholdId, "hh-1", "Local session preserved on KeepTransient");
    }

    // 11b. Removido / Borrado confirmado: 1 intento best-effort de clear remoto + limpieza local
    {
      let remoteWrites = 0;
      let clearedUid = "";
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", "userA", ["userA"]) },
      });

      await handleListenerError("hh-1", "userA", new Error("removed"), {
        confirmHouseholdGoneThenResolve: async () => "RemovedFromMembers",
        clearRemoteActiveHousehold: async (uid) => { remoteWrites++; clearedUid = uid; },
      });

      assert.strictEqual(remoteWrites, 1, "RemovedFromMembers must trigger exactly 1 remote write clear attempt");
      assert.strictEqual(clearedUid, "userA", "Remote write clear must target userA");
      assert.strictEqual(useHouseholdDataStore.getState().status, "empty", "Local store cleared to empty on RemovedFromMembers");
      assert.strictEqual(useHouseholdDataStore.getState().data.activeHouseholdId, null, "Local activeHouseholdId set to null");
    }

    // 11c. Fallo de la escritura best-effort: limpieza local ocurre igual
    {
      let remoteWrites = 0;
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", "userA", ["userA"]) },
      });

      await handleListenerError("hh-1", "userA", new Error("deleted"), {
        confirmHouseholdGoneThenResolve: async () => "ConfirmedDeleted",
        clearRemoteActiveHousehold: async () => {
          remoteWrites++;
          throw new Error("Simulated network failure on deleteField()");
        },
      });

      assert.strictEqual(remoteWrites, 1, "ConfirmedDeleted must attempt 1 remote write");
      assert.strictEqual(useHouseholdDataStore.getState().status, "empty", "Local store STILL cleared to empty even if remote write fails");
      assert.strictEqual(useHouseholdDataStore.getState().data.activeHouseholdId, null, "Local activeHouseholdId STILL set to null even if remote write fails");
    }

    // 11f. H1.8c: Cambio de Hogar HH1 -> HH2 durante confirmación descarta callback de HH1 (0 writes, HH2 intacto)
    {
      let remoteWrites = 0;
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", "userA", ["userA"]) },
      });

      const handlePromise = handleListenerError("hh-1", "userA", new Error("deleted"), {
        confirmHouseholdGoneThenResolve: async () => {
          // Durante el reintento/confirmación, el usuario cambia a HH2
          useHouseholdDataStore.setState({
            status: "success",
            uid: "userA",
            data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-2", household: createMockHousehold("hh-2", "userA", ["userA"]) },
          });
          return "ConfirmedDeleted";
        },
        clearRemoteActiveHousehold: async () => { remoteWrites++; },
      });

      await handlePromise;

      assert.strictEqual(remoteWrites, 0, "Stale callback for HH1 after switch to HH2 must perform 0 remote writes");
      assert.strictEqual(useHouseholdDataStore.getState().data.activeHouseholdId, "hh-2", "Active household must remain hh-2");
      assert.strictEqual(useHouseholdDataStore.getState().data.household?.id, "hh-2", "Household metadata must remain hh-2");
    }

    // 11g. H1.8c: KeepTransient tras cambio HH1 -> HH2 no rehidrata metadata de HH1 sobre HH2
    {
      let remoteWrites = 0;
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", "userA", ["userA"]) },
      });

      await handleListenerError("hh-1", "userA", new Error("transient"), {
        confirmHouseholdGoneThenResolve: async () => "KeepTransient",
        clearRemoteActiveHousehold: async () => { remoteWrites++; },
        getDocFn: async () => {
          // Durante la re-lectura de HH1, el usuario cambia a HH2
          useHouseholdDataStore.setState({
            status: "success",
            uid: "userA",
            data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-2", household: createMockHousehold("hh-2", "userA", ["userA"]) },
          });
          return { exists: true, data: () => ({ name: "Hogar hh-1 viejo", ownerId: "userA", memberIds: ["userA"], memberCount: 1, inviteCode: "INV88", status: "active" }) };
        },
      });

      assert.strictEqual(remoteWrites, 0, "KeepTransient for old HH1 must perform 0 remote writes");
      assert.strictEqual(useHouseholdDataStore.getState().data.activeHouseholdId, "hh-2", "Active household must remain hh-2");
      assert.strictEqual(useHouseholdDataStore.getState().data.household?.id, "hh-2", "HH1 metadata must NOT rehydrate over hh-2");
    }

    // 11h. H1.8c: NonFatalError con estado success conserva status success y datos, pero expone error consumible
    {
      let remoteWrites = 0;
      const hh1 = createMockHousehold("hh-1", "userA", ["userA"]);
      useHouseholdDataStore.setState({
        status: "success",
        uid: "userA",
        error: null,
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: hh1 },
      });

      await handleListenerError("hh-1", "userA", new Error("unavailable"), {
        confirmHouseholdGoneThenResolve: async () => "NonFatalError",
        clearRemoteActiveHousehold: async () => { remoteWrites++; },
      });

      assert.strictEqual(remoteWrites, 0, "NonFatalError in success state must perform 0 remote writes");
      assert.strictEqual(useHouseholdDataStore.getState().status, "success", "Status must remain success when valid household is already loaded");
      assert.strictEqual(useHouseholdDataStore.getState().data.household?.id, "hh-1", "Household object preserved");
      assert.ok(useHouseholdDataStore.getState().error?.includes("sincronizar"), "Consumable error message published to store for UI toasts/banners");
    }

    // 11i. H1.8c: NonFatalError durante loading transiciona status a error sin escrituras remotas
    {
      let remoteWrites = 0;
      useHouseholdDataStore.setState({
        status: "loading",
        uid: "userA",
        error: null,
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1" },
      });

      await handleListenerError("hh-1", "userA", new Error("unavailable"), {
        confirmHouseholdGoneThenResolve: async () => "NonFatalError",
        clearRemoteActiveHousehold: async () => { remoteWrites++; },
      });

      assert.strictEqual(remoteWrites, 0, "NonFatalError in loading state must perform 0 remote writes");
      assert.strictEqual(useHouseholdDataStore.getState().status, "error", "Status must transition to error when loading failed");
      assert.ok(useHouseholdDataStore.getState().error?.includes("sincronizar"), "Consumable error message published to store");
    }

    console.log("  ✓ Test 11: H1.8 — Manejador real handleListenerError verificado con 9 escenarios y contadores de escritura");
  }

  // Test 12: H1.8d — Verificación de aviso no bloqueante en UI y listeners secundarios de datos
  {
    // 12a. Cableado de aviso en UI (role="alert" y household.error en HouseholdPage)
    const pagePath = path.resolve(__dirname, "../../src/app/(dashboard)/household/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    assert.ok(pageContent.includes('role="alert"'), "HouseholdPage must render an element with role='alert'");
    assert.ok(pageContent.includes("household.error"), "HouseholdPage must bind household.error to the alert element");

    // 12b. Error de listener secundario publica error sin cambiar status: success ni borrar datos
    useHouseholdDataStore.setState({
      status: "success",
      uid: "userA",
      error: null,
      data: {
        ...useHouseholdDataStore.getState().data,
        activeHouseholdId: "hh-1",
        events: [{ id: "ev-1", householdId: "hh-1", title: "Gasto", amount: 100, notes: '', categoryId: 'cat1', isActive: true, createdByUserId: "u1", paidByUserId: "u1", status: "active", settlementMode: "invitation", eventDate: new Date(), createdAt: new Date() }],
      },
    });

    const isCallbackValid = (hhId: string, uid: string): boolean => {
      const st = useHouseholdDataStore.getState();
      return st.uid === uid && st.data.activeHouseholdId === hhId;
    };

    const reportSecondaryError = (hhId: string, uid: string) => {
      if (!isCallbackValid(hhId, uid)) return;
      const st = useHouseholdDataStore.getState();
      if (st.status !== "success") {
        useHouseholdDataStore.setState({ status: "error", error: "Error de conexión al sincronizar el hogar." });
      } else {
        useHouseholdDataStore.setState({ error: "Error de conexión al sincronizar el hogar." });
      }
    };

    reportSecondaryError("hh-1", "userA");
    assert.strictEqual(useHouseholdDataStore.getState().status, "success", "Status must remain success for secondary listener error");
    assert.strictEqual(useHouseholdDataStore.getState().data.events.length, 1, "Loaded data must be preserved");
    assert.ok(useHouseholdDataStore.getState().error?.includes("sincronizar"), "Error message published to store");

    // 12c. Error de callback viejo ignorado
    useHouseholdDataStore.setState({
      status: "success",
      uid: "userA",
      error: null,
      data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-2" },
    });
    reportSecondaryError("hh-1", "userA");
    assert.strictEqual(useHouseholdDataStore.getState().error, null, "Stale callback for hh-1 must not set error on hh-2");

    // 12d. 0 APIs de escritura en use-household-data-subscriptions.ts
    const subPath = path.resolve(__dirname, "../../src/features/household/hooks/use-household-data-subscriptions.ts");
    const subContent = fs.readFileSync(subPath, "utf-8");
    assert.strictEqual(subContent.includes("updateDoc"), false, "use-household-data-subscriptions.ts must contain 0 updateDoc calls");
    assert.strictEqual(subContent.includes("setDoc"), false, "use-household-data-subscriptions.ts must contain 0 setDoc calls");
    assert.strictEqual(subContent.includes("deleteDoc"), false, "use-household-data-subscriptions.ts must contain 0 deleteDoc calls");
    assert.strictEqual(subContent.includes("writeBatch"), false, "use-household-data-subscriptions.ts must contain 0 writeBatch calls");

    console.log("  ✓ Test 12: H1.8d — Aviso UI, listeners secundarios y 0 escrituras verificados");
  }

  // Test 13: H4.2 — Al pasar activeHouseholdId a null (leave/dissolve), la sesión de Hogar
  // (user-doc + household-session-watcher) debe seguir viva; solo el listener del hogar
  // (household-doc) y los 5 listeners de datos deben detenerse. Al entrar luego a un hogar
  // nuevo (join/create), la sesión que quedó viva debe re-suscribir household-doc y los 5
  // listeners de datos por sí sola, SIN llamar startHouseholdSessionSubscriptions de nuevo.
  {
    subscriptionRegistry.unregister("household");

    const HOUSEHOLD_DATA_KEYS = ["events", "event-shares", "debts", "income-entries", "categories"];
    const uid = "userH42";

    let hh1DocUnsubscribed = false;
    let hh1DataUnsubscribedCount = 0;
    let userDocUnsubscribed = false;
    let sessionWatcherUnsubscribed = false;

    // Simula lo que startHouseholdSessionSubscriptions(uid) deja armado para una sesión viva
    // con HH1 activo: user-doc + household-session-watcher (control de sesión, deben sobrevivir
    // a "sin hogar activo") + household-doc y los 5 listeners de datos de HH1 (deben detenerse).
    subscriptionRegistry.register("household", "user-doc", () => {
      userDocUnsubscribed = true;
    });
    subscriptionRegistry.register("household", "household-session-watcher", () => {
      sessionWatcherUnsubscribed = true;
    });
    subscriptionRegistry.register("household", "household-doc", () => {
      hh1DocUnsubscribed = true;
    });
    for (const key of HOUSEHOLD_DATA_KEYS) {
      subscriptionRegistry.register("household", key, () => {
        hh1DataUnsubscribedCount += 1;
      });
    }

    // Watcher reactivo mínimo, con la MISMA forma/guardas que los watchers reales de
    // use-household-session-subscriptions.ts (items 2 y 3): reacciona a cambios de
    // activeHouseholdId para el uid de esta sesión y re-suscribe household-doc + datos.
    // No se modifica producción para este test: household-data-store.ts es el único archivo
    // que cambia con el fix; este watcher sustituye a los onSnapshot reales (que exigen
    // Firestore real) preservando exactamente la misma lógica de guardas.
    let lastSubscribedHouseholdId: string | null = "hh-1";
    const reSubscribedHouseholdIds: string[] = [];
    const unsubscribeReactiveWatcher = useHouseholdDataStore.subscribe((state) => {
      if (state.uid !== uid) return;
      const nextHouseholdId = state.data.activeHouseholdId;
      if (nextHouseholdId === lastSubscribedHouseholdId) return;
      lastSubscribedHouseholdId = nextHouseholdId;

      if (!nextHouseholdId) {
        subscriptionRegistry.unregister("household", "household-doc");
        for (const key of HOUSEHOLD_DATA_KEYS) {
          subscriptionRegistry.unregister("household", key);
        }
        return;
      }

      reSubscribedHouseholdIds.push(nextHouseholdId);
      subscriptionRegistry.register("household", "household-doc", () => {});
      for (const key of HOUSEHOLD_DATA_KEYS) {
        subscriptionRegistry.register("household", key, () => {});
      }
    });

    try {
      useHouseholdDataStore.setState({
        status: "success",
        uid,
        data: { ...useHouseholdDataStore.getState().data, activeHouseholdId: "hh-1", household: createMockHousehold("hh-1", uid, [uid]) },
      });

      // 13a. Usuario abandona/disuelve HH1 -> activeHouseholdId pasa a null.
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ activeHouseholdId: null }, uid);

      assert.strictEqual(userDocUnsubscribed, false, "user-doc NO debe desuscribirse al pasar activeHouseholdId a null");
      assert.strictEqual(sessionWatcherUnsubscribed, false, "household-session-watcher NO debe desuscribirse al pasar activeHouseholdId a null");
      assert.strictEqual(subscriptionRegistry.getActiveCount("household"), 2, "user-doc y household-session-watcher deben seguir registrados (y ser los únicos) tras perder el hogar activo");
      assert.strictEqual(hh1DocUnsubscribed, true, "household-doc de HH1 SÍ debe detenerse al perder el hogar activo");
      assert.strictEqual(hh1DataUnsubscribedCount, HOUSEHOLD_DATA_KEYS.length, "los 5 listeners de datos de HH1 SÍ deben detenerse al perder el hogar activo");

      // 13b. Usuario se une/crea HH2, sin volver a llamar startHouseholdSessionSubscriptions.
      useHouseholdDataStore.getState().applyHouseholdSnapshot({ activeHouseholdId: "hh-2" }, uid);
      useHouseholdDataStore.getState().applyHouseholdSnapshot(
        { household: createMockHousehold("hh-2", uid, [uid]) },
        uid
      );

      assert.deepStrictEqual(reSubscribedHouseholdIds, ["hh-2"], "el watcher reactivo (ya vivo) debe re-suscribir household-doc/datos para HH2 automáticamente");
      assert.strictEqual(subscriptionRegistry.getActiveCount("household"), 2 + 1 + HOUSEHOLD_DATA_KEYS.length, "user-doc + household-session-watcher + household-doc + 5 listeners de datos de HH2 deben estar registrados");

      // 13c. reset() (logout) SÍ debe seguir limpiando el scope COMPLETO, incluidos user-doc y
      // household-session-watcher — a diferencia de la rama activeHouseholdId===null, reset()
      // no se tocó y conserva subscriptionRegistry.unregister("household") sin key.
      useHouseholdDataStore.getState().reset();
      assert.strictEqual(subscriptionRegistry.getActiveCount("household"), 0, "reset() (logout) debe seguir limpiando TODO el scope household, incluidos user-doc/household-session-watcher");
    } finally {
      unsubscribeReactiveWatcher();
      subscriptionRegistry.unregister("household");
    }

    console.log("  ✓ Test 13: H4.2 — user-doc/household-session-watcher sobreviven a activeHouseholdId=null; HH2 se re-suscribe sin llamar startHouseholdSessionSubscriptions");
  }

  console.log("All household-session-transitions unit tests passed successfully!");
}

runHouseholdTests().catch((err) => {
  console.error("Test failure in household-session-transitions.test.ts:", err);
  process.exit(1);
});
