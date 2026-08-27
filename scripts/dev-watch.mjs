import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Supervisor del servidor de desarrollo.
 *
 * `warmOnStart` precalienta las rutas en cuanto el servidor arranca (y en cada
 * reinicio). Existe porque `next dev` compila cada ruta la PRIMERA vez que se
 * pide: medido en este proyecto, 1,3-4 s por seccion frente a ~0,25 s una vez
 * compilada. Ese coste no desaparece, pero se paga en segundo plano en vez de
 * en el primer clic de cada seccion durante el QA.
 *
 * Viene apagado por defecto para que las pruebas del supervisor no lancen un
 * proceso real; se enciende en la invocacion de verdad, mas abajo.
 */
export function superviseNextDevelopment({
  environment = process.env,
  spawnProcess = spawn,
  processRef = process,
  scheduleRestart = setTimeout,
  cancelRestart = clearTimeout,
  warmOnStart = false,
} = {}) {
  let child = null;
  let warmChild = null;
  let restartTimer = null;
  let isShuttingDown = false;

  const startWarmup = () => {
    if (!warmOnStart || isShuttingDown) return;
    // El script espera por su cuenta a que el servidor conteste, asi que no
    // hace falta coordinar nada aqui.
    warmChild = spawnProcess(
      processRef.execPath,
      [path.resolve("scripts/warm-dev-routes.mjs")],
      { stdio: "inherit", shell: false, env: { ...environment } },
    );
    warmChild.once("close", () => {
      warmChild = null;
    });
    warmChild.once("error", (error) => {
      console.warn("[dev-watch] No se pudo precalentar las rutas:", error.message);
      warmChild = null;
    });
  };

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

    startWarmup();
  };

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (restartTimer) {
      cancelRestart(restartTimer);
      restartTimer = null;
    }
    if (warmChild) {
      warmChild.kill(signal);
      warmChild = null;
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
// En uso real si se precalienta; en las pruebas del supervisor no, para no
// lanzar un proceso de verdad.
if (isMain) superviseNextDevelopment({ warmOnStart: true });
