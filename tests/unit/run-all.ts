import { runPersonalDerivedReadConsistencyTests } from "./mplus-personal-derived-read-consistency.test";
import "./no-emulator-residue.test";
import "./firebase-environment-policy.test";
import "./firebase-client-safety-contract.test";
import "./firestore-user-profile.test";
import "./firebase-command-contract.test";
import "./firebase-runner-core.test";
import "./firebase-runtime-artifacts.test";
import "./auth-routing.test";
import "./personal-date-input-local.test";
import "./app-context-redirection.test";
import "./dev-server-isolation.test";
import "./category-visual-catalog.test";
import "./profile-avatar.test";
import "./account-visual-catalog.test";
import "./personal-shell-navigation.test";
import "./household-shell-navigation.test";
import "./personal-shell-data-gate.test";
import "./mobile-shell-responsive.test";
import "./personal-dashboard-flow-summary.test";
import "./personal-dashboard-category-chart.test";
import "./household-dashboard-chart.test";
import "./personal-movement-detail.test";
import "./movements-experience-parity.test";
import "./household-settings-view.test";
import "./household-categories-view.test";
import "./household-quick-classify.test";

// --- Finanzas M+ Core & Features ---
import "./mplus-contract-serialization.test";
import "./mplus-android-fixture-parity.test";
import "./mplus-validators.test";
import "./mplus-bogota-date.test";
import "./mplus-period-contract.test";
import "./mplus-seed-catalog.test";
import "./mplus-derived-calc.test";
import "./mplus-user-bootstrap.test";
import "./mplus-session-boundary.test";
import "./mplus-mutation-runner.test";
import "./mplus-movement-mutations.test";
import "./mplus-personal-month-view-model.test";
import "./mplus-catalog-services.test";
import "./mplus-household-contract.test";
import "./mplus-household-join-rename-guards.test";
import "./mplus-household-shared-movement-sync.test";
import "./mplus-account-reset.test";
import "./mplus-realtime-sync.test";
import "./settings-legacy-and-qa-surface.test";
import "./movement-conflict-resolution.test";
import "./mplus-backup-export.test";
import "./personal-movement-exit-confirmation.test";
import "./mplus-category-display-mode.test";
import "./mplus-permanent-delete.test";

import { runAppContextRedirectionTests } from "./app-context-redirection.test";
import { runAccountVisualCatalogTests } from "./account-visual-catalog.test";
import { runMplusHouseholdContractTests } from "./mplus-household-contract.test";
import { runMplusHouseholdSharedMovementSyncTests } from "./mplus-household-shared-movement-sync.test";
import { runRealtimeSyncTests } from "./mplus-realtime-sync.test";

// Los runners de Hogar y sincronización comparten el store singleton y los servicios
// inyectados: en paralelo se pisan el estado, asi que van en serie.
runMplusHouseholdContractTests()
  .then(runMplusHouseholdSharedMovementSyncTests)
  .then(runRealtimeSyncTests)
  .catch((err) => {
    console.error("Test failure in the mplus household / realtime sync suite:", err);
    process.exit(1);
  });

runAppContextRedirectionTests().catch((err) => {
  console.error("Test failure in app-context-redirection.test.ts:", err);
  process.exit(1);
});

runAccountVisualCatalogTests().catch((err) => {
  console.error("Test failure in account-visual-catalog.test.ts:", err);
  process.exit(1);
});

import { runPersonalMovementExitConfirmationTests } from "./personal-movement-exit-confirmation.test";

runPersonalMovementExitConfirmationTests().catch((err) => {
  console.error("Test failure in personal-movement-exit-confirmation.test.ts:", err);
  process.exit(1);
});

import { runMplusAccountResetFlowTests } from "./mplus-account-reset-flow.test";
import { runShareWithHouseholdTests } from "./mplus-share-with-household.test";

runMplusAccountResetFlowTests()
  .then(runShareWithHouseholdTests)
  .then(() => {
    console.log("OK mplus-share-with-household");
  })
  .catch((err) => {
    console.error("Test failure in mplus-account-reset-flow.test.ts / mplus-share-with-household.test.ts:", err);
    process.exit(1);
  });

import { runMplusHouseholdExpenseContractTests } from "./mplus-household-expense-contract.test";
import { runMplusHouseholdExpenseMutationsTests } from "./mplus-household-expense-mutations.test";

runMplusHouseholdExpenseContractTests()
  .then(runMplusHouseholdExpenseMutationsTests)
  .catch((err) => {
    console.error("Test failure in household-expense tests:", err);
    process.exit(1);
  });

runPersonalDerivedReadConsistencyTests().catch((err) => {
  console.error("Test failure in mplus-personal-derived-read-consistency.test.ts:", err);
  process.exit(1);
});

import { runHouseholdComposerMountingTests } from "./household-composer-mounting.test";

runHouseholdComposerMountingTests().catch((err) => {
  console.error("Test failure in household-composer-mounting.test.ts:", err);
  process.exit(1);
});

import { runHouseholdExpenseDefectsFixTests } from "./mplus-household-expense-defects-fix.test";

runHouseholdExpenseDefectsFixTests().catch((err) => {
  console.error("Test failure in mplus-household-expense-defects-fix.test.ts:", err);
  process.exit(1);
});

import { runMplusHouseholdTimelineTests } from "./mplus-household-timeline.test";

runMplusHouseholdTimelineTests().catch((err) => {
  console.error("Test failure in mplus-household-timeline.test.ts:", err);
  process.exit(1);
});

import { runSidebarMovementsBadgeTests } from "./mplus-sidebar-movements-badge.test";

runSidebarMovementsBadgeTests();

import { runHouseholdTrashIndexGuardTests } from "./mplus-household-trash-index-guard.test";

runHouseholdTrashIndexGuardTests();

import { runAmountDomNestingGuardTests } from "./mplus-amount-dom-nesting-guard.test";

runAmountDomNestingGuardTests();

import { runPersonalQuickClassifyTests } from "./personal-quick-classify.test";

runPersonalQuickClassifyTests().catch((err) => {
  console.error("Test failure in personal-quick-classify.test.ts:", err);
  process.exit(1);
});

import { runHouseholdSharePreflightTests } from "./mplus-household-share-preflight.test";

runHouseholdSharePreflightTests().catch((err) => {
  console.error("Test failure in mplus-household-share-preflight.test.ts:", err);
  process.exit(1);
});
