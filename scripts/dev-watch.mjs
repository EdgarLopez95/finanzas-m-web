import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let child = null;
let isShuttingDown = false;

const developmentDistDir =
  process.env.NEXT_PUBLIC_FIREBASE_RUNTIME === "QA_REAL"
    ? ".next-qa"
    : ".next-dev";

function cleanNextCache() {
  try {
    const nextDir = path.join(process.cwd(), developmentDistDir);
    if (!fs.existsSync(nextDir)) return;

    const routesManifest = path.join(nextDir, "routes-manifest.json");
    const buildManifest = path.join(nextDir, "build-manifest.json");
    if (!fs.existsSync(routesManifest) && fs.existsSync(buildManifest)) {
      console.log(`[dev-watch] Limpiando cache desincronizada de ${developmentDistDir}...`);
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(
      `[dev-watch] No se pudo limpiar ${developmentDistDir}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function startServer() {
  if (isShuttingDown) return;
  cleanNextCache();

  const nextCli = path.resolve("node_modules/next/dist/bin/next");
  console.log("[dev-watch] Iniciando servidor Next.js local (Webpack HMR)...");
  child = spawn(process.execPath, [nextCli, "dev"], {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, NODE_ENV: "development" },
  });

  child.once("exit", (code, signal) => {
    child = null;
    if (isShuttingDown) {
      process.exitCode = code ?? (signal ? 0 : 1);
      return;
    }
    console.warn(
      `[dev-watch] El servidor se detuvo (codigo: ${code}, senal: ${signal}). Reiniciando...`,
    );
    setTimeout(startServer, 1000);
  });

  child.once("error", (error) => {
    console.error("[dev-watch] Error en el servidor:", error.message);
    if (isShuttingDown) process.exitCode = 1;
  });
}

function cleanup(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (child) {
    console.log("[dev-watch] Deteniendo servidor...");
    child.kill(signal);
  }
}

process.once("SIGINT", () => cleanup("SIGINT"));
process.once("SIGTERM", () => cleanup("SIGTERM"));

startServer();
