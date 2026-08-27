import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Contrato de comandos npm tras ORQ-041 / DEC-081: todos apuntan al unico
 * ambiente real; no queda ningun comando de emulador ni de Rules locales.
 */

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const gitignore = fs.readFileSync(".gitignore", "utf8");
const runner = fs.readFileSync("scripts/run-firebase-environment.mjs", "utf8");
const runnerCore = fs.readFileSync("scripts/firebase-environment-core.mjs", "utf8");

// Los comandos de ejecucion pasan por el lanzador validado, sin runtime.
assert.equal(pkg.scripts.dev, "node scripts/run-firebase-environment.mjs watch");
assert.equal(pkg.scripts["dev:watch"], "node scripts/run-firebase-environment.mjs watch");
assert.equal(
  pkg.scripts["dev:turbo"],
  "node scripts/run-firebase-environment.mjs next dev --turbopack",
);
assert.equal(pkg.scripts.build, "node scripts/run-firebase-environment.mjs next build");
assert.equal(pkg.scripts.start, "node scripts/run-firebase-environment.mjs next start");
assert.equal(pkg.scripts.test, "tsx tests/unit/run-all.ts");

// Comandos retirados: ni emulador, ni Rules locales, ni duplicados `:qa`.
const scriptNames = Object.keys(pkg.scripts);
for (const retired of [
  "dev:qa",
  "build:qa",
  "start:qa",
  "check:rules",
  "fix:rules",
  "prepare:emulator-rules",
  "pretest:emulator",
  "pretest:emulator:debt-payment-gate",
  "check:backend",
  "sync:backend",
]) {
  assert.equal(
    scriptNames.includes(retired),
    false,
    `el comando '${retired}' debio retirarse con el modo emulador`,
  );
}
assert.equal(
  scriptNames.some((name) => name.startsWith("test:emulator")),
  false,
  "no puede quedar ningun comando test:emulator*",
);

const allScripts = JSON.stringify(pkg.scripts);
assert.doesNotMatch(allScripts, /EMULATOR|emulators:exec|demo-finanzas|firebase-tools/);
assert.doesNotMatch(allScripts, /QA_REAL/, "el runtime ya no viaja como argumento");

// El lanzador exige el archivo de ambiente real y no acepta runtime alguno.
assert.match(runner, /\.env\.qa-real\.local/);
assert.match(runner, /process\.execPath/);
assert.match(runner, /watch\|next/);
assert.doesNotMatch(runner, /EMULATOR/);

// El nucleo nunca hereda credenciales del shell y limpia el runtime heredado.
assert.match(runnerCore, /delete childEnvironment\[key\]/);
assert.match(runnerCore, /delete childEnvironment\.NEXT_PUBLIC_FIREBASE_RUNTIME/);
assert.doesNotMatch(runnerCore, /EMULATOR|demo-finanzas/);

// Los artefactos del emulador ya no existen en el repo Web.
for (const retiredPath of [
  "tests/emulator",
  "scripts/canonical-backend.mjs",
  "scripts/check-rules-bom.mjs",
  "firebase.json",
]) {
  assert.equal(
    fs.existsSync(retiredPath),
    false,
    `${retiredPath} debio eliminarse con el modo emulador`,
  );
}

assert.match(gitignore, /!\.env\.local\.example/);
assert.doesNotMatch(gitignore, /emulator|\.next-dev|\.next-emulator/);

// ─── El andamiaje de desarrollo no puede quedarse a medias ──────────────────
//
// `AGENTS.md` documenta que `npm run dev` precalienta las rutas solo. Si
// alguien retira el script o el interruptor, la documentacion pasa a mentir y
// el QA vuelve a pagar 1,3-4 s por seccion sin que nadie se entere.

assert.equal(
  pkg.scripts["dev:warm"],
  "node scripts/warm-dev-routes.mjs",
  "el precalentado manual debe seguir disponible",
);
assert.ok(
  fs.existsSync("scripts/warm-dev-routes.mjs"),
  "el script de precalentado debe existir",
);

const agents = fs.readFileSync("AGENTS.md", "utf8");
assert.match(
  agents,
  /Servidor de desarrollo/,
  "AGENTS.md debe conservar la regla del servidor de desarrollo",
);
assert.match(
  agents,
  /no reinicies/i,
  "AGENTS.md debe decir explicitamente que no se reinicie por costumbre",
);
// Lo que de verdad causo los servidores huerfanos: matar por puerto.
assert.match(
  agents,
  /por puerto no funciona/i,
  "AGENTS.md debe explicar por que matar por puerto deja supervisores vivos",
);

console.log("OK firebase-command-contract");
