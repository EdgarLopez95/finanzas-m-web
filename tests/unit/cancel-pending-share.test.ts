
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { cancelPendingShare } from "../../src/features/household/services/cancel-pending-share";

export const runCancelPendingShareUnitTests = async () => {
  console.log("Running unit tests for cancel-pending-share.test.ts...");

  // Test 1: Validaciones de entrada obligatorias
  await assert.rejects(
    async () => cancelPendingShare({ shareId: "", currentUid: "user1" }),
    (err: Error) => err.message.includes("obligatorio"),
    "Empty shareId must be rejected",
  );

  await assert.rejects(
    async () => cancelPendingShare({ shareId: "share1", currentUid: "" }),
    (err: Error) => err.message.includes("obligatorio"),
    "Empty currentUid must be rejected",
  );

  // Test 2: Contrato estructural — cancel-pending-share.ts no realiza escrituras indebidas
  const servicePath = path.resolve(__dirname, "../../src/features/household/services/cancel-pending-share.ts");
  const serviceCode = fs.readFileSync(servicePath, "utf-8");

  assert.strictEqual(serviceCode.includes("deleteDoc"), false, "cancelPendingShare must never invoke deleteDoc");
  assert.strictEqual(serviceCode.includes("setDoc"), false, "cancelPendingShare must never invoke setDoc");
  assert.strictEqual(serviceCode.includes("writeBatch"), false, "cancelPendingShare must perform a direct updateDoc on shareRef only");
  assert.strictEqual(serviceCode.includes("household_debts"), false, "cancelPendingShare must never touch household_debts");
  assert.strictEqual(serviceCode.includes("transactions"), false, "cancelPendingShare must never touch personal transactions");

  // Test 3: UI Contract en HouseholdEventDetailDialog — presencia de cancelar cuota y condición estricta pending_completion
  const dialogPath = path.resolve(__dirname, "../../src/features/household/components/household-event-detail-dialog.tsx");
  const dialogCode = fs.readFileSync(dialogPath, "utf-8");

  assert.ok(dialogCode.includes("useCancelPendingShare"), "HouseholdEventDetailDialog must integrate useCancelPendingShare hook");
  assert.ok(dialogCode.includes("Cancelar cuota"), "HouseholdEventDetailDialog must expose 'Cancelar cuota' action button");
  assert.ok(dialogCode.includes("isCancellingShare"), "HouseholdEventDetailDialog must bind loading state to the cancel share button");
  assert.ok(
    dialogCode.includes('share.status === "pending_completion"'),
    "HouseholdEventDetailDialog must check share.status === 'pending_completion' strictly",
  );
  assert.strictEqual(
    dialogCode.includes('share.status === "pending"'),
    false,
    "HouseholdEventDetailDialog must NOT check share.status === 'pending'",
  );

  // Test 4: Prueba conductual — share con status 'pending' es rechazada localmente con 0 llamadas a updateDoc
  let updateDocCalls = 0;
  let updateDocPayload: Record<string, unknown> | null = null;

  const mockGetDocPending = async () => ({
    exists: () => true,
    data: () => ({
      memberUserId: "user1",
      status: "pending", // Status legacy no permitido
      eventId: "evt1",
    }),
  });

  const mockUpdateDoc = async (_ref: unknown, data: Record<string, unknown>) => {
    updateDocCalls += 1;
    updateDocPayload = data;
  };

  const mockGetDb = () => ({});
  const mockDoc = (_db: unknown, path: string, docId: string) => `${path}/${docId}`;

  await assert.rejects(
    async () =>
      cancelPendingShare(
        { shareId: "share1", currentUid: "user1" },
        { getFirebaseDbFn: mockGetDb, docFn: mockDoc, getDocFn: mockGetDocPending, updateDocFn: mockUpdateDoc },
      ),
    (err: Error) => {
      assert.strictEqual(
        err.message,
        "Solo se pueden cancelar cuotas con estado 'pending_completion'.",
        "Error message must match controlled pending_completion message",
      );
      return true;
    },
    "Should reject share with status 'pending'",
  );
  assert.strictEqual(updateDocCalls, 0, "updateDoc must be called 0 times when status is 'pending'");

  // Test 5: Prueba conductual — share con status 'pending_completion' ejecuta una única escritura remota con status 'cancelled' y updatedAt
  updateDocCalls = 0;
  updateDocPayload = null;

  const mockGetDocValid = async (ref: unknown) => {
    const refStr = String(ref);
    if (refStr.includes("household_events")) {
      return {
        exists: () => true,
        data: () => ({ status: "active" }),
      };
    }
    return {
      exists: () => true,
      data: () => ({
        memberUserId: "user1",
        status: "pending_completion",
        eventId: "evt1",
      }),
    };
  };

  await cancelPendingShare(
    { shareId: "share1", currentUid: "user1" },
    { getFirebaseDbFn: mockGetDb, docFn: mockDoc, getDocFn: mockGetDocValid, updateDocFn: mockUpdateDoc },
  );

  assert.strictEqual(updateDocCalls, 1, "updateDoc must be called exactly 1 time for valid pending_completion share");
  // El mock asigna dentro de un callback: CFA no lo ve y assert.ok(null) colapsa a `never`.
  const writtenPayload = updateDocPayload as Record<string, unknown> | null;
  assert.notEqual(writtenPayload, null, "updateDocPayload must be populated");
  assert.strictEqual(writtenPayload!["status"], "cancelled", "updateDoc payload status must be 'cancelled'");
  assert.ok("updatedAt" in writtenPayload!, "updateDoc payload must include updatedAt");
  assert.deepStrictEqual(
    Object.keys(writtenPayload!).sort(),
    ["status", "updatedAt"],
    "updateDoc payload keys must be exactly status and updatedAt",
  );

  console.log("All cancel-pending-share unit tests passed successfully!");
};

if (process.argv[1]?.endsWith("cancel-pending-share.test.ts")) {
  runCancelPendingShareUnitTests().catch((err) => {
    console.error("Test failure in cancel-pending-share.test.ts:", err);
    process.exit(1);
  });
}
