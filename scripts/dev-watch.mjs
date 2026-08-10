import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let child = null;
let isShuttingDown = false;

function freePort3000() {
  try {
    if (process.platform === "win32") {
      const output = execSync('netstat -ano | findstr :3000', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
  } catch {
    // Ignore if port 3000 was not in use
  }
}

function cleanNextCache() {
  try {
    const nextDir = path.join(process.cwd(), ".next-dev");
    if (fs.existsSync(nextDir)) {
      // If routes-manifest.json is missing or corrupted from a previous next build crash
      const routesManifest = path.join(nextDir, "routes-manifest.json");
      const buildManifest = path.join(nextDir, "build-manifest.json");
      if (!fs.existsSync(routesManifest) && fs.existsSync(buildManifest)) {
        console.log("🧹 [dev-watch] Limpiando caché desincronizada de .next...");
        fs.rmSync(nextDir, { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.warn("⚠️ [dev-watch] No se pudo limpiar .next:", err.message);
  }
}

function startServer() {
  if (isShuttingDown) return;

  freePort3000();
  cleanNextCache();

  console.log("\n🚀 [dev-watch] Iniciando servidor de desarrollo Next.js (Webpack HMR)...");
  
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  child = spawn(command, ["next", "dev"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NODE_ENV: "development" },
  });

  child.on("exit", (code, signal) => {
    if (isShuttingDown) return;
    console.warn(`\n⚠️ [dev-watch] El servidor de desarrollo se detuvo (código: ${code}, señal: ${signal}). Reiniciando en 1 segundo...`);
    setTimeout(startServer, 1000);
  });

  child.on("error", (err) => {
    console.error("❌ [dev-watch] Error en el proceso del servidor:", err);
  });
}

function cleanup() {
  isShuttingDown = true;
  if (child) {
    console.log("\n🛑 [dev-watch] Deteniendo servidor de desarrollo...");
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

startServer();
