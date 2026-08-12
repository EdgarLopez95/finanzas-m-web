import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gitignore = fs.readFileSync(".gitignore", "utf8");
const runnerPath = "scripts/run-firebase-environment.mjs";
const runner = fs.existsSync(runnerPath) ? fs.readFileSync(runnerPath, "utf8") : "";
const emulatorHarnesses = fs
  .readdirSync("tests/emulator")
  .filter((name) => name.endsWith(".ts"))
  .map((name) => fs.readFileSync(`tests/emulator/${name}`, "utf8"))
  .join("\n");

assert.match(pkg.scripts.dev, /EMULATOR/);
assert.match(pkg.scripts["dev:qa"], /QA_REAL/);
assert.match(pkg.scripts["dev:watch"], /EMULATOR/);
assert.match(pkg.scripts["dev:turbo"], /EMULATOR/);
assert.match(pkg.scripts.build, /EMULATOR/);
assert.match(pkg.scripts["build:qa"], /QA_REAL/);
assert.match(gitignore, /!\.env\.local\.example/);
assert.match(runner, /\.env\.qa-real\.local/);
assert.match(runner, /delete childEnv\[key\]/);
assert.match(runner, /process\.execPath/);
assert.doesNotMatch(JSON.stringify(pkg.scripts), /demo-finanzas-m(?!-plus)/);
assert.doesNotMatch(emulatorHarnesses, /demo-finanzas-m(?!-plus)/);

console.log("OK firebase-command-contract");
