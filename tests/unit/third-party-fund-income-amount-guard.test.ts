import assert from "node:assert/strict";

import { assertOriginalAmountCoversConsumedAmount } from "@/lib/finance/third-party-funds";

assert.throws(
  () => assertOriginalAmountCoversConsumedAmount(20_000, 30_000),
  /no puedes reducir este ingreso no real por debajo de lo ya consumido/i,
  "debe bloquear ediciones que dejen originalAmount por debajo del total consumido"
);

assert.doesNotThrow(
  () => assertOriginalAmountCoversConsumedAmount(40_000, 30_000),
  "debe permitir ediciones cuando el nuevo originalAmount sigue cubriendo lo consumido"
);

assert.doesNotThrow(
  () => assertOriginalAmountCoversConsumedAmount(30_000, 30_000),
  "debe permitir dejar originalAmount exactamente igual al total consumido"
);

console.log("OK third-party-fund-income-amount-guard");
