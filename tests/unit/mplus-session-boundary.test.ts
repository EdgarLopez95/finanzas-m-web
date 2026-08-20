import assert from "node:assert/strict";

import { shouldResetSessionForUidChange } from "../../src/features/auth/use-auth-bootstrap";
import { useAppContextStore } from "../../src/stores/app-context-store";
import { useAuthStore } from "../../src/stores/auth-store";
import { useAutoSettleDebtStore } from "../../src/stores/auto-settle-debt-store";
import { useHouseholdDataStore } from "../../src/stores/household-data-store";
import { useHouseholdUiPreferencesStore } from "../../src/stores/household-ui-preferences-store";
import { useHouseholdUiStore } from "../../src/stores/household-ui-store";
import { usePersonalDataStore } from "../../src/stores/personal-data-store";
import { resetAllStoresForSessionBoundary } from "../../src/stores/session-boundary";
import { useTransactionPanelStore } from "../../src/stores/transaction-panel-store";
import { useUiPreferencesStore } from "../../src/stores/ui-preferences-store";

/**
 * W1 — limpieza TOTAL de stores al cambiar de usuario.
 *
 * Antes solo se reiniciaba `app-context-store`: los datos Personales y de
 * Hogar del usuario anterior seguian en memoria hasta que la carga de la
 * siguiente sesion los desalojaba de forma perezosa. Esta prueba fija el
 * contrato de la frontera de sesion para que no vuelva a estrecharse.
 */

// La deteccion de cambio de sesion no cambia: primera resolucion no limpia,
// mismo uid repetido tampoco, logout y cambio de cuenta si.
assert.equal(shouldResetSessionForUidChange(undefined, "uid-a"), false);
assert.equal(shouldResetSessionForUidChange("uid-a", "uid-a"), false);
assert.equal(shouldResetSessionForUidChange("uid-a", null), true);
assert.equal(shouldResetSessionForUidChange("uid-a", "uid-b"), true);
assert.equal(shouldResetSessionForUidChange(null, "uid-a"), true);

// --- se ensucia todo lo que una sesion viva puede ensuciar ---
usePersonalDataStore.setState({ ownerId: "uid-a", status: "success" });
useHouseholdDataStore.setState({ uid: "uid-a", status: "success" });
useHouseholdDataStore
  .getState()
  .applyHouseholdSnapshot({ activeHouseholdId: "hogar-de-uid-a" }, "uid-a");
useTransactionPanelStore.getState().openCreate("expense", "acc-1");
useHouseholdUiStore.setState({ isCreateExpenseOpen: true });
useAutoSettleDebtStore.setState({ entries: { "debt-1": "pending" } as never, dismissed: { "debt-1": true } });
useAppContextStore.setState({
  activeContext: "household",
  initialContextBootstrapResolved: true,
  contextNotice: "aviso de la sesion anterior" as never,
  householdLossNotifiedFor: "hogar-de-uid-a",
});
useUiPreferencesStore.setState({
  hydrated: true,
  balancesHidden: true,
  isEditingBoard: true,
  hiddenCards: ["accounts"],
  boardOrder: ["movements", "accounts", "categories", "household"],
});
useHouseholdUiPreferencesStore.setState({
  hydrated: true,
  isEditingHouseholdBoard: true,
  householdHiddenCards: ["categories"],
  householdBoardOrder: ["movements", "categories", "contributions"],
});
useAuthStore.getState().setBootstrapError("bootstrap fallido de la sesion anterior");

resetAllStoresForSessionBoundary();

// --- datos remotos: nada del usuario anterior sobrevive ---
assert.equal(usePersonalDataStore.getState().ownerId, null);
assert.equal(usePersonalDataStore.getState().status, "idle");
assert.equal(useHouseholdDataStore.getState().uid, null);
assert.equal(useHouseholdDataStore.getState().status, "idle");
assert.equal(useHouseholdDataStore.getState().data.activeHouseholdId, null);

// --- superficies efimeras ---
assert.equal(useTransactionPanelStore.getState().kind, null);
assert.equal(useTransactionPanelStore.getState().defaultAccountId, null);
assert.equal(useHouseholdUiStore.getState().isCreateExpenseOpen, false);
assert.deepEqual(useAutoSettleDebtStore.getState().entries, {});
assert.deepEqual(useAutoSettleDebtStore.getState().dismissed, {});

// --- contexto Personal/Hogar ---
assert.equal(useAppContextStore.getState().activeContext, "personal");
assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, false);
assert.equal(useAppContextStore.getState().contextNotice, null);
assert.equal(useAppContextStore.getState().householdLossNotifiedFor, null);

// --- preferencias de tablero: estado en memoria a valores por defecto ---
assert.equal(useUiPreferencesStore.getState().hydrated, false);
assert.equal(useUiPreferencesStore.getState().balancesHidden, false);
assert.equal(useUiPreferencesStore.getState().isEditingBoard, false);
assert.deepEqual(useUiPreferencesStore.getState().hiddenCards, []);
assert.deepEqual(useUiPreferencesStore.getState().boardOrder, [
  "accounts",
  "categories",
  "movements",
  "household",
]);
assert.equal(useHouseholdUiPreferencesStore.getState().hydrated, false);
assert.equal(useHouseholdUiPreferencesStore.getState().isEditingHouseholdBoard, false);
assert.deepEqual(useHouseholdUiPreferencesStore.getState().householdHiddenCards, []);
assert.deepEqual(useHouseholdUiPreferencesStore.getState().householdBoardOrder, [
  "categories",
  "movements",
  "contributions",
]);

// El error de bootstrap de la sesion anterior no se arrastra al cerrar sesion.
useAuthStore.getState().clearSession();
assert.equal(useAuthStore.getState().bootstrapError, null);
assert.equal(useAuthStore.getState().user, null);
assert.equal(useAuthStore.getState().isAuthenticated, false);

console.log("OK mplus-session-boundary");
