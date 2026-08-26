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
import "./household-ui-preferences-store.test";
import "./personal-shell-data-gate.test";
import "./mobile-shell-responsive.test";
import "./personal-dashboard-flow-summary.test";
import "./personal-dashboard-category-chart.test";
import "./household-dashboard-chart.test";
import "./personal-movement-detail.test";

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
import "./mplus-household-shared-movement-sync.test";
import "./mplus-account-reset.test";

import { runAppContextRedirectionTests } from "./app-context-redirection.test";
import { runAccountVisualCatalogTests } from "./account-visual-catalog.test";
import { runMplusHouseholdContractTests } from "./mplus-household-contract.test";
import { runMplusHouseholdSharedMovementSyncTests } from "./mplus-household-shared-movement-sync.test";

// Los dos runners de Hogar comparten el store singleton y los servicios
// inyectados: en paralelo se pisan el estado, asi que van en serie.
runMplusHouseholdContractTests()
  .then(runMplusHouseholdSharedMovementSyncTests)
  .catch((err) => {
    console.error("Test failure in the mplus household store suite:", err);
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
