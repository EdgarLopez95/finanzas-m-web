import assert from "assert";
import { resolveContextRedirection } from "../../src/lib/navigation/app-context";

function runTests() {
  let failed = 0;
  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`[PASS] ${name}`);
    } catch (e) {
      console.error(`[FAIL] ${name}`, e);
      failed++;
    }
  };

  runTest("Household context: Redirect /dashboard to /household", () => {
    const res = resolveContextRedirection({ pathname: "/dashboard", context: "household" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/household");
    assert.strictEqual(res.keepsContext, "household");
  });

  runTest("Household context: Redirect /accounts to /household", () => {
    const res = resolveContextRedirection({ pathname: "/accounts", context: "household" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/household");
    assert.strictEqual(res.keepsContext, "household");
  });

  runTest("Household context: Redirect /movements to /household/movements", () => {
    const res = resolveContextRedirection({ pathname: "/movements", context: "household" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/household/movements");
    assert.strictEqual(res.keepsContext, "household");
  });

  runTest("Household context: Redirect /settings to /household/settings", () => {
    const res = resolveContextRedirection({ pathname: "/settings", context: "household" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/household/settings");
    assert.strictEqual(res.keepsContext, "household");
  });

  runTest("Household context: Redirect /categories to /household/categories", () => {
    const res = resolveContextRedirection({ pathname: "/categories", context: "household" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/household/categories");
    assert.strictEqual(res.keepsContext, "household");
  });

  runTest("Household context: No redirect for /household", () => {
    const res = resolveContextRedirection({ pathname: "/household", context: "household" });
    assert.strictEqual(res.shouldRedirect, false);
  });

  runTest("Personal context: Redirect /household to /dashboard", () => {
    const res = resolveContextRedirection({ pathname: "/household", context: "personal" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/dashboard");
    assert.strictEqual(res.keepsContext, "personal");
  });

  runTest("Personal context: Redirect /household/settings to /dashboard", () => {
    const res = resolveContextRedirection({ pathname: "/household/settings", context: "personal" });
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.replaceHref, "/dashboard");
    assert.strictEqual(res.keepsContext, "personal");
  });

  runTest("Personal context: No redirect for /dashboard", () => {
    const res = resolveContextRedirection({ pathname: "/dashboard", context: "personal" });
    assert.strictEqual(res.shouldRedirect, false);
  });

  runTest("Structural check: ContextSync API must not exist in app-context.ts", () => {
    const fs = require("fs");
    const path = require("path");
    const appContextContent = fs.readFileSync(path.join(__dirname, "../../src/lib/navigation/app-context.ts"), "utf-8");
    
    assert.ok(!appContextContent.includes("resolveContextSyncDecision"), "resolveContextSyncDecision shouldn't exist");
    assert.ok(!appContextContent.includes("ContextSyncDecision"), "ContextSyncDecision shouldn't exist");
    assert.ok(!appContextContent.includes("syncContextFromRoute"), "syncContextFromRoute shouldn't exist");
  });

  if (failed > 0) {
    process.exit(1);
  }
}

export const runAppContextRedirectionTests = async () => {
  console.log("Running app-context-redirection.test.ts");
  runTests();
};

if (require.main === module) {
  runTests();
}
