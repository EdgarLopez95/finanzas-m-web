import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Guardia de retirada del modo emulador (ORQ-041 / DEC-081).
 *
 * Recorre el codigo de producto y la configuracion de ejecucion del repo Web y
 * falla si reaparece cualquier rastro del entorno retirado: runtime
 * `EMULATOR`, proyectos `demo-*`, hosts de emulador, conexiones
 * `connect*Emulator` o referencias al harness `tests/emulator/`.
 *
 * `tests/` queda fuera del escaneo de patrones a proposito: varias pruebas de
 * ambiente afirman la AUSENCIA de estos terminos y necesitan nombrarlos. La
 * reaparicion del harness se cubre abajo, comprobando que los artefactos
 * fisicos no vuelvan a existir.
 *
 * Existe para que la retirada no se deshaga por accidente en un bloque futuro.
 */

const ROOT = process.cwd();

const SCANNED_DIRECTORIES = ["src", "scripts"];
const SCANNED_FILES = [
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  ".gitignore",
  ".env.local.example",
  "README.md",
];
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".mts", ".js", ".json", ".md"]);

const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bEMULATOR\b/, reason: "runtime EMULATOR retirado" },
  { pattern: /demo-finanzas/, reason: "proyecto demo-* retirado" },
  { pattern: /connectAuthEmulator|connectFirestoreEmulator/, reason: "conexion a emulador" },
  { pattern: /emulators:exec|firebase-tools/, reason: "CLI de emulador" },
  { pattern: /127\.0\.0\.1|10\.0\.2\.2/, reason: "host de emulador" },
  { pattern: /useEmulators/, reason: "bandera de emulador" },
  { pattern: /tests\/emulator/, reason: "harness de emulador retirado" },
];

const collectFiles = (relativeDir: string): string[] => {
  const absolute = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectFiles(relative));
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(relative);
    }
  }
  return found;
};

const targets = [
  ...SCANNED_DIRECTORIES.flatMap(collectFiles),
  ...SCANNED_FILES.filter((file) => fs.existsSync(path.join(ROOT, file))),
];

assert.equal(targets.length > 0, true, "el escaneo no encontro archivos que auditar");

const offences: string[] = [];
for (const file of targets) {
  const contents = fs.readFileSync(path.join(ROOT, file), "utf8");
  contents.split(/\r?\n/).forEach((line, index) => {
    for (const { pattern, reason } of FORBIDDEN) {
      if (pattern.test(line)) {
        offences.push(`${file}:${index + 1} — ${reason}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

assert.deepEqual(
  offences,
  [],
  `Rastros del modo emulador reintroducidos:\n${offences.join("\n")}`,
);

// Los artefactos fisicos tampoco pueden volver.
for (const retired of [
  "tests/emulator",
  "firebase.json",
  "firestore.indexes.json",
  "scripts/canonical-backend.mjs",
  "scripts/check-rules-bom.mjs",
  ".next-emulator",
  ".next-dev",
]) {
  assert.equal(fs.existsSync(path.join(ROOT, retired)), false, `${retired} reapareció`);
}

console.log(`OK no-emulator-residue (${targets.length} archivos auditados)`);
