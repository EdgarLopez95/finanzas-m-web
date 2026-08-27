/**
 * Precalienta las rutas del servidor de desarrollo.
 *
 * `next dev` compila cada ruta la PRIMERA vez que alguien la pide. Medido en
 * este proyecto: 1,3-4 s por sección tras reiniciar el servidor, frente a
 * ~0,25 s una vez compilada. Ese coste no desaparece, pero sí se puede pagar en
 * segundo plano en vez de en el primer clic de cada sección durante el QA.
 *
 * No cambia el servidor ni la configuración: solo pide las rutas una vez.
 *
 *   node scripts/warm-dev-routes.mjs [--base http://localhost:3000]
 */

const ROUTES = [
  "/",
  "/dashboard",
  "/movements",
  "/accounts",
  "/categories",
  "/settings",
  "/household",
  "/household/movements",
  "/household/categories",
  "/household/settings",
];

/**
 * Marca de que quien contesta es ESTA app.
 *
 * Hace falta porque el puerto no es fijo: si el 3000 está ocupado, `next dev`
 * se mueve solo al siguiente libre. Sin comprobar el contenido, el precalentado
 * podía terminar calentando otra cosa que estuviera escuchando en el 3000 —
 * exactamente lo que pasó la primera vez que se probó esto.
 */
const APP_MARKER = "Finanzas M";

/** Puertos donde `next dev` puede acabar tras su búsqueda de uno libre. */
const CANDIDATE_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

const explicitBase = () => {
  const index = process.argv.indexOf("--base");
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1].replace(/\/$/, "");
  }
  return null;
};

const respondsAsOurApp = async (base) => {
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return false;
    return (await response.text()).includes(APP_MARKER);
  } catch {
    return false;
  }
};

/** Busca el servidor, reintentando mientras arranca. */
const discoverBase = async (timeoutMs = 120_000) => {
  const forced = explicitBase();
  const ports = process.env.PORT ? [Number(process.env.PORT), ...CANDIDATE_PORTS] : CANDIDATE_PORTS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (forced) {
      if (await respondsAsOurApp(forced)) return forced;
    } else {
      for (const port of ports) {
        const base = `http://localhost:${port}`;
        if (await respondsAsOurApp(base)) return base;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
};

const main = async () => {
  const base = await discoverBase();

  if (!base) {
    console.warn("[warm] No encontré el servidor de desarrollo; no se precalentó nada.");
    return;
  }

  console.log(`[warm] Precalentando ${ROUTES.length} rutas en ${base}...`);
  const started = Date.now();

  // En serie a propósito: en paralelo compiten por el mismo compilador, el
  // total sale peor y el servidor queda sin responder mientras tanto.
  for (const route of ROUTES) {
    const routeStarted = Date.now();
    try {
      const response = await fetch(`${base}${route}`);
      const seconds = ((Date.now() - routeStarted) / 1000).toFixed(1);
      const mark = response.ok ? "ok" : `HTTP ${response.status}`;
      console.log(`[warm]   ${route.padEnd(24)} ${seconds}s  ${mark}`);
    } catch (error) {
      console.warn(`[warm]   ${route.padEnd(24)} falló: ${String(error)}`);
    }
  }

  console.log(`[warm] Listo en ${((Date.now() - started) / 1000).toFixed(1)}s.`);
};

main();
