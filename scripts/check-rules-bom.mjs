#!/usr/bin/env node
// Validador anti-BOM para archivos de reglas de Firestore.
//
// Por qué existe: android/firestore.rules es un archivo COMPARTIDO que se
// despliega a producción. Si se guarda con BOM (EF BB BF) o como UTF-16, el
// compilador de reglas de Firebase falla con:
//   "token recognition error at: '\uFEFF'"
// Esto rompe tanto el emulador como `firebase deploy --only firestore:rules`.
// Este script detecta (y opcionalmente corrige con --fix) ese problema.
//
// Uso:
//   node scripts/check-rules-bom.mjs            -> valida los archivos por defecto
//   node scripts/check-rules-bom.mjs --fix      -> corrige BOM UTF-8 in place
//   node scripts/check-rules-bom.mjs ruta1 ...  -> valida rutas específicas
//
// Sale con código 1 si encuentra algún BOM (y no se pasó --fix que lo resolvió).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const argv = process.argv.slice(2);
const fixMode = argv.includes("--fix");
const explicitPaths = argv.filter((a) => !a.startsWith("--"));

// Archivos por defecto (relativos a este script, así funciona sin importar el cwd):
//  - regla canónica que se despliega (android/firestore.rules, fuera del repo web)
//  - copia que consume el emulador (puede no existir todavía)
const defaultTargets = [
  resolve(scriptDir, "../../../android/firestore.rules"),
  resolve(scriptDir, "../tests/emulator/firestore.rules"),
];

const targets = explicitPaths.length > 0
  ? explicitPaths.map((p) => resolve(process.cwd(), p))
  : defaultTargets;

const BOMS = [
  { name: "UTF-8 BOM", bytes: [0xef, 0xbb, 0xbf], fixable: true },
  { name: "UTF-16 LE BOM", bytes: [0xff, 0xfe], fixable: false },
  { name: "UTF-16 BE BOM", bytes: [0xfe, 0xff], fixable: false },
];

function startsWith(buf, bytes) {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function pretty(p) {
  const rel = relative(projectRoot, p);
  return rel.startsWith("..") ? p : rel;
}

let hadProblem = false;
let checked = 0;

for (const file of targets) {
  if (!existsSync(file)) {
    // La copia del emulador puede no existir aún: lo informamos pero no fallamos.
    if (explicitPaths.length > 0) {
      console.error(`✗ No existe: ${pretty(file)}`);
      hadProblem = true;
    } else {
      console.log(`· (saltado, no existe) ${pretty(file)}`);
    }
    continue;
  }

  checked++;
  const buf = readFileSync(file);
  const bom = BOMS.find((b) => startsWith(buf, b.bytes));

  if (!bom) {
    console.log(`✓ Sin BOM: ${pretty(file)}`);
    continue;
  }

  if (bom.fixable && fixMode) {
    writeFileSync(file, buf.subarray(bom.bytes.length));
    console.log(`✓ ${bom.name} eliminado: ${pretty(file)}`);
    continue;
  }

  hadProblem = true;
  console.error(`✗ ${bom.name} detectado: ${pretty(file)}`);
  if (bom.fixable) {
    console.error("  → corrígelo con: npm run fix:rules");
  } else {
    console.error("  → vuelve a guardar el archivo como UTF-8 SIN BOM (UTF-16 no sirve para reglas).");
  }
}

if (checked === 0 && explicitPaths.length === 0) {
  console.error("✗ No se encontró ningún archivo de reglas para validar.");
  process.exit(1);
}

if (hadProblem) {
  console.error("\nReglas con encoding inválido. El deploy de Firestore fallaría. Aborta.");
  process.exit(1);
}

console.log("\nOK: reglas sin BOM, encoding válido para deploy.");
