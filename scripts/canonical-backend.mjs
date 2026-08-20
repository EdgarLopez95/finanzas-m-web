#!/usr/bin/env node
// Sincroniza y verifica los artefactos canónicos del backend compartido.
//
// Contrato §27.1: `android/firestore.rules` y `android/firestore.indexes.json`
// son la FUENTE CANÓNICA. Web puede copiarlos para correr su emulador, pero no
// mantiene una variante funcional independiente. Antes de este script la Web
// solo copiaba las reglas (y solo justo antes de `test:emulator`), así que:
//
//   - la copia versionada en `tests/emulator/firestore.rules` podía quedar
//     meses desactualizada sin que nada lo dijera;
//   - `firestore.indexes.json` era todavía el manifiesto de `finanzas-m`
//     (colecciones legacy), no el del contrato v1.
//
// Uso:
//   node scripts/canonical-backend.mjs           -> verifica (falla si hay deriva)
//   node scripts/canonical-backend.mjs --write   -> copia la fuente canónica
//
// La verificación ignora diferencias de fin de línea (CRLF/LF): Git puede
// normalizarlas al hacer checkout en Windows y eso no es una deriva real.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const androidRoot = resolve(projectRoot, "../../android");

/** Artefactos compartidos: origen canónico (Android) -> copia local (Web). */
export const CANONICAL_ARTIFACTS = [
  {
    name: "firestore.rules",
    source: resolve(androidRoot, "firestore.rules"),
    target: resolve(projectRoot, "tests/emulator/firestore.rules"),
  },
  {
    name: "firestore.indexes.json",
    source: resolve(androidRoot, "firestore.indexes.json"),
    target: resolve(projectRoot, "tests/emulator/firestore.indexes.json"),
  },
];

const normalize = (text) => text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

/**
 * Compara cada artefacto canónico con su copia Web.
 * Devuelve `{ name, status }` con status `ok` | `missing-source` | `missing-target` | `stale`.
 */
export function inspectCanonicalArtifacts(artifacts = CANONICAL_ARTIFACTS) {
  return artifacts.map((artifact) => {
    if (!existsSync(artifact.source)) {
      return { ...artifact, status: "missing-source" };
    }
    if (!existsSync(artifact.target)) {
      return { ...artifact, status: "missing-target" };
    }
    const source = normalize(readFileSync(artifact.source, "utf8"));
    const target = normalize(readFileSync(artifact.target, "utf8"));
    return { ...artifact, status: source === target ? "ok" : "stale" };
  });
}

const pretty = (p) => {
  const rel = relative(projectRoot, p);
  return rel.startsWith("..") ? p : rel;
};

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const writeMode = process.argv.slice(2).includes("--write");
  const results = inspectCanonicalArtifacts();
  let failed = false;

  for (const result of results) {
    if (result.status === "missing-source") {
      console.error(`✗ Falta la fuente canónica: ${pretty(result.source)}`);
      failed = true;
      continue;
    }

    if (result.status === "ok") {
      console.log(`✓ Al día con la fuente canónica: ${pretty(result.target)}`);
      continue;
    }

    if (writeMode) {
      writeFileSync(result.target, normalize(readFileSync(result.source, "utf8")), "utf8");
      console.log(`✓ Copiado desde Android: ${pretty(result.target)}`);
      continue;
    }

    failed = true;
    const reason =
      result.status === "missing-target" ? "no existe la copia Web" : "la copia Web está desactualizada";
    console.error(`✗ ${result.name}: ${reason}`);
    console.error(`  canónico: ${pretty(result.source)}`);
    console.error(`  copia:    ${pretty(result.target)}`);
  }

  if (failed) {
    console.error(
      "\nLos artefactos del backend compartido no coinciden con la fuente canónica de Android.",
    );
    console.error("→ actualízalos con: npm run sync:backend");
    process.exit(1);
  }

  console.log("\nOK: Rules e índices Web alineados con la fuente canónica (contrato §27.1).");
}
