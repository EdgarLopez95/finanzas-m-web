import "./accounts.test";
import "./firebase-environment-policy.test";
import "./personal-view-model.test";
import "./delete-personal-entity-cascade.test";
import "./update-personal-transaction-logic.test";
import "./create-account-pocket.test";
import "./delete-account-pocket.test";
import "./update-pocket-logic.test";
import "./create-personal-transfer.test";
import "./amount-negative-display.test";
import "./auth-routing.test";
import "./personal-date-input-local.test";
import "./third-party-fund-delete-context.test";
import "./third-party-fund-income-amount-guard.test";
import "./household-view-model.test";
import "./subscription-registry.test";
import "./personal-derived-recompute.test";
import "./household-session-transitions.test";
import "./household-settlement-v2.test";
import "./loader-read-only.test";
import "./transaction-amount-validation.test";
import "./expense-occ-parity.test";
import "./personal-data-status.test";
import "./household-categories.test";
import "./household-events.test";
import "./household-debt-lifecycle.test";
import "./delete-entity-cascade-household-revert.test";
import "./household-double-submit-guard.test";
import "./household-income-projection.test";
import "./household-forms-accessibility.test";
import "./household-forms-ios-zoom.test";
import "./household-touch-targets.test";
import "./household-focus-trap.test";
import "./household-nested-escape.test";
import "./create-household-expense-two-step.test";
import "./household-dialog-focus-stability.test";
import "./household-category-select-search.test";
import "./household-date-field.test";
import "./household-theme-token.test";
import "./dev-server-isolation.test";
import "./household-view-mode.test";
import "./composer-required-labels-and-cta-gate.test";
import "./discard-confirm-on-create.test";
import "./household-share-confirm-on-expense.test";
import "./household-category-breakdown-parity.test";
import "./auto-settle-debt.test";
import "./auto-settle-debt-store.test";
import "./auto-settle-debt-source-resolution.test";
import "./household-personal-debt-parity.test";
import "./personal-net-expense-parity.test";
import "./reimbursement-direction-mapping.test";
import "./technical-balance-movement-exclusion.test";
import "./household-personal-annotation-parity.test";
import "./complete-share-dialog-copy.test";
import "./household-personal-debt-position-parity.test";
import "./qa-reset-role.test";
import "./qa-reset-availability.test";
import "./qa-reset-local-state-cleanup.test";
import "./qa-reset-ux-lifecycle.test";
import "./app-context-boundary.test";
import "./household-8d-views.test";
import "./household-paso9-visual.test";
import "./personal-shell-navigation.test";
import "./household-shell-navigation.test";
import "./household-settings-permissions.test";
import "./household-inicio-overview.test";
import "./category-visual-catalog.test";
import "./category-picker-p1-fixes.test";
import "./category-seed.test";
import "./category-seed-batch-recovery.test";
import "./resolve-suggested-personal-category.test";
import "./complete-share-suggestion-effect.test";
import "./profile-avatar.test";
import "./account-balance-model.test";
import "./account-lifecycle.test";
import "./account-lifecycle-guard.test";
import "./step6-account-detail-experience.test";
import "./step6-p1-fixes.test";
import "./step6-transfer-ownership-gate.test";
import "./own-funds-gate.test";
import "./household-event-relational.test";
import "./household-debit-ownership-gate.test";
import "./account-pocket-count-race.test";
import "./create-account-pocket.test";
import "./delete-account-pocket.test";
import "./create-personal-transfer.test";
import { runCancelPendingShareUnitTests } from "./cancel-pending-share.test";
import { runHouseholdDebtPaymentGateUnitTests } from "./household-debt-payment-gate.test";
import { runResetPersonalDataForCurrentUserUnitTests } from "./reset-personal-data-for-current-user.test";
import { runResetQaDataForCurrentUserUnitTests } from "./reset-qa-data-for-current-user.test";
import { runResetHouseholdLinkedDocsForCurrentUserUnitTests } from "./reset-household-linked-docs-for-current-user.test";
import { runDiscoverHouseholdsForCurrentUserUnitTests } from "./discover-households-for-current-user.test";
import { runAppContextRedirectionTests } from "./app-context-redirection.test";
import { runHouseholdP1ContextBootstrapTests } from "./household-p1-context-bootstrap.test";
import { runHouseholdP1_1SessionBoundaryResetTests } from "./household-p1-1-session-boundary-reset.test";
import { runAccountVisualCatalogTests } from "./account-visual-catalog.test";
import { runTechnicalTransactionsUnitTests } from "./technical-transactions.test";

runCancelPendingShareUnitTests().catch((err) => {
  console.error("Test failure in cancel-pending-share.test.ts:", err);
  process.exit(1);
});

runHouseholdDebtPaymentGateUnitTests().catch((err) => {
  console.error("Test failure in household-debt-payment-gate.test.ts:", err);
  process.exit(1);
});

runResetPersonalDataForCurrentUserUnitTests().catch((err) => {
  console.error("Test failure in reset-personal-data-for-current-user.test.ts:", err);
  process.exit(1);
});

runResetQaDataForCurrentUserUnitTests().catch((err) => {
  console.error("Test failure in reset-qa-data-for-current-user.test.ts:", err);
  process.exit(1);
});

runResetHouseholdLinkedDocsForCurrentUserUnitTests().catch((err) => {
  console.error("Test failure in reset-household-linked-docs-for-current-user.test.ts:", err);
  process.exit(1);
});

runDiscoverHouseholdsForCurrentUserUnitTests().catch((err) => {
  console.error("Test failure in discover-households-for-current-user.test.ts:", err);
  process.exit(1);
});

runAppContextRedirectionTests().catch((err) => {
  console.error("Test failure in app-context-redirection.test.ts:", err);
  process.exit(1);
});

runHouseholdP1ContextBootstrapTests().catch((err) => {
  console.error("Test failure in household-p1-context-bootstrap.test.ts:", err);
  process.exit(1);
});

runHouseholdP1_1SessionBoundaryResetTests().catch((err) => {
  console.error("Test failure in household-p1-1-session-boundary-reset.test.ts:", err);
  process.exit(1);
});

runAccountVisualCatalogTests().catch((err) => {
  console.error("Test failure in account-visual-catalog.test.ts:", err);
  process.exit(1);
});

runTechnicalTransactionsUnitTests().catch((err) => {
  console.error("Test failure in technical-transactions.test.ts:", err);
  process.exit(1);
});
import "./third-party-location-core.test";
import "./third-party-location-ledger.test";
import "./third-party-location-ledger-bootstrap.test";
import "./third-party-location-snapshot.test";
import "./third-party-location-retry.test";
import "./third-party-location-occ.test";
import "./third-party-location-availability-ui.test";
import "./ownership-distribution-view-model.test";
import "./personal-movement-mutability.test";
import "./pocket-detail-dialog.test";
import "./account-detail-route.test";
