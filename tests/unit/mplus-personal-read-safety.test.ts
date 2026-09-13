import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { mapPersonalMovementDocuments } from "../../src/features/movements/services/read-personal-movements";
import { createMplusPersonalStore } from "../../src/stores/mplus-personal-store";

const run = async () => {
  const store = createMplusPersonalStore({
    subscribeProfile: (_uid, onUpdate) => {
      onUpdate(null);
      return () => {};
    },
    subscribeAccounts: (_ownerId, onUpdate) => {
      onUpdate([]);
      return () => {};
    },
    subscribeCategories: (_ownerId, onUpdate) => {
      onUpdate([]);
      return () => {};
    },
    subscribeMonthMovements: (_ownerId, _range, _onUpdate, onError) => {
      onError?.(new Error("No se pudo leer el movimiento m-bad"));
      return () => {};
    },
    subscribeTrashed: (_ownerId, onUpdate) => {
      onUpdate([]);
      return () => {};
    },
  });

  await store.getState().load("u-1", { year: 2026, month: 9 });

  assert.equal(
    store.getState().status,
    "error",
    "un error del listener de movimientos no puede quedar oculto por otro listener exitoso",
  );
  assert.match(store.getState().error ?? "", /m-bad/);

  assert.throws(
    () => mapPersonalMovementDocuments([{ id: "m-malformed", data: () => ({}) }]),
    /m-malformed/,
    "un documento inválido debe identificar solo el ID afectado",
  );

  const dashboardShell = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/dashboard-shell.tsx"),
    "utf-8",
  );
  assert.match(
    dashboardShell,
    /mplusStatus !== "success"/,
    "el alta Personal debe rechazar una lectura incompleta o fallida",
  );
  assert.match(
    dashboardShell,
    /personalDialogsMounted && mplusStatus === "success"/,
    "el compositor Personal no puede montarse con una lectura fallida",
  );

  console.log("OK mplus-personal-read-safety");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
