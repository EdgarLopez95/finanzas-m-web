import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function superviseNextDevelopment({
  environment = process.env,
  spawnProcess = spawn,
  processRef = process,
  scheduleRestart = setTimeout,
  cancelRestart = clearTimeout,
} = {}) {
  let child = null;
  let restartTimer = null;
  let isShuttingDown = false;

  const startServer = () => {
    if (isShuttingDown) return;

    const nextCli = path.resolve("node_modules/next/dist/bin/next");
    console.log("[dev-watch] Iniciando servidor Next.js local (Webpack HMR)...");
    child = spawnProcess(processRef.execPath, [nextCli, "dev"], {
      stdio: "inherit",
      shell: false,
      env: { ...environment, NODE_ENV: "development" },
    });

    child.once("close", (code, signal) => {
      child = null;
      if (isShuttingDown) {
        processRef.exitCode = code ?? (signal ? 0 : 1);
        return;
      }

      console.warn(
        `[dev-watch] El servidor se detuvo (codigo: ${code}, senal: ${signal}). Reiniciando...`,
      );
      restartTimer = scheduleRestart(startServer, 1000);
    });

    child.once("error", (error) => {
      console.error("[dev-watch] Error en el servidor:", error.message);
      if (isShuttingDown) processRef.exitCode = 1;
    });
  };

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (restartTimer) {
      cancelRestart(restartTimer);
      restartTimer = null;
    }
    if (child) {
      console.log("[dev-watch] Deteniendo servidor...");
      child.kill(signal);
    } else {
      processRef.exitCode = 0;
    }
  };

  processRef.once("SIGINT", () => shutdown("SIGINT"));
  processRef.once("SIGTERM", () => shutdown("SIGTERM"));
  startServer();

  return { shutdown };
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) superviseNextDevelopment();
