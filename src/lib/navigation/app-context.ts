/**
 * Paso 6 — Frontera técnica del switch Personal/Hogar.
 *
 * Fuente única y explícita del contexto activo de la Web. El switch deja de ser
 * un enlace visual y pasa a ser un límite real de estado y rutas:
 *
 * - Personal: rutas, diálogos y acciones de dinero propio.
 * - Hogar: libro compartido y sus acciones permitidas.
 *
 * Todas las decisiones (a qué ruta ir, qué limpiar, qué acción está permitida,
 * cuándo se perdió el hogar) viven aquí como funciones puras y testeables. Los
 * componentes visuales NO derivan el contexto por su cuenta: leen el store, que
 * determina el contexto real.
 *
 * Paridad Android (`FinanzasMainTabsShell.kt`):
 * - `homeContext` es un único `mutableStateOf(HomeContext.Personal)`;
 * - al perder el hogar activo se fuerza `HomeContext.Personal`, se cierra el
 *   detalle de evento y se sale de cualquier sub-ruta de Hogar;
 * - el aviso de hogar disuelto se muestra UNA sola vez por hogar
 *   (`dissolvedToastShownForHouseholdId`), nunca en bucle.
 *
 * No crea rutas, colecciones, campos ni permisos nuevos: solo ordena las
 * superficies que ya existen.
 */

export type AppContext = "personal" | "household";

export const DEFAULT_APP_CONTEXT: AppContext = "personal";

/**
 * Clase de una ruta respecto al contexto:
 * - `personal` / `household`: exclusiva de ese contexto;
 * - `shared`: existe en AMBOS contextos y por tanto no puede cambiarlo;
 * - `neutral`: fuera de la matriz de contexto (auth, `/design-system`).
 */
export type RouteContextClass = AppContext | "neutral";

/**
 * Exclusivas de Personal: instrumentos de dinero propio (cuentas, bolsillos,
 * categorías personales) más la entrada de Inicio Personal.
 */
export const PERSONAL_EXCLUSIVE_ROUTES = ["/dashboard", "/accounts", "/categories", "/movements", "/settings"] as const;

/** Hogar solo expone las superficies Hogar que ya existen y son válidas. */
export const HOUSEHOLD_EXCLUSIVE_ROUTES = ["/household", "/household/movements", "/household/settings", "/household/categories"] as const;

/**
 * Superficies COMPARTIDAS por ambos contextos (paridad Android confirmada:
 * Personal y Hogar son contextos de UI dentro de la misma navegación, y Android
 * conserva Inicio, Movimientos y Ajustes en los dos).
 *
 * En Hogar, Movimientos muestra eventos/ingresos proyectados compartidos y
 * Ajustes gestiona categorías y bloque Hogar. Estas rutas NUNCA cambian el
 * contexto activo por sí mismas: hacerlo convertiría una navegación normal en
 * un cambio implícito de contexto y rompería la frontera.
 *
 * Inicio queda repartido en dos rutas por la arquitectura Web previa
 * (`/dashboard` y `/household`), que se conservan como entradas de contexto.
 */


export const PERSONAL_ENTRY_ROUTE = "/dashboard";
export const HOUSEHOLD_ENTRY_ROUTE = "/household";

const normalizePath = (pathname: string | null | undefined): string => {
  if (!pathname) return "/";
  const [pathOnly] = pathname.split(/[?#]/);
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.replace(/\/+$/, "");
  }
  return pathOnly || "/";
};

const matchesRoute = (path: string, route: string): boolean =>
  path === route || path.startsWith(`${route}/`);

export const resolveRouteContextClass = (pathname: string | null | undefined): RouteContextClass => {
  const path = normalizePath(pathname);

  if (HOUSEHOLD_EXCLUSIVE_ROUTES.some((route) => matchesRoute(path, route))) {
    return "household";
  }

  if (PERSONAL_EXCLUSIVE_ROUTES.some((route) => matchesRoute(path, route))) {
    return "personal";
  }

  

  return "neutral";
};

/**
 * Contexto que una ruta IMPONE. Solo las rutas exclusivas imponen contexto.
 * `null` para compartidas (`/movements`, `/settings`) y neutrales (`/login`,
 * `/design-system`): ninguna de ellas puede cambiar el contexto activo por sí
 * misma, así que navegar a Movimientos o Ajustes desde Hogar nunca degrada la
 * sesión a Personal.
 */
export const resolveContextForPath = (pathname: string | null | undefined): AppContext | null => {
  const routeClass = resolveRouteContextClass(pathname);
  return routeClass === "personal" || routeClass === "household" ? routeClass : null;
};

/** Pertenencia a la matriz: exclusiva del contexto, o compartida por ambos. */
export const isRouteAllowedInContext = (
  pathname: string | null | undefined,
  context: AppContext
): boolean => {
  const routeClass = resolveRouteContextClass(pathname);
  return routeClass === context;
};

/** Una ruta compartida solo tiene superficie Hogar si ya fue implementada. */
export type ContextRouteRedirection = {
  shouldRedirect: boolean;
  replaceHref: string | null;
  keepsContext: AppContext;
};

export const resolveContextRedirection = (params: {
  pathname: string | null | undefined;
  context: AppContext;
}): ContextRouteRedirection => {
  const { pathname, context } = params;
  const path = normalizePath(pathname);
  const none: ContextRouteRedirection = { shouldRedirect: false, replaceHref: null, keepsContext: context };

  if (context === "household") {
    // `/accounts` se compara por PREFIJO: desde que el detalle de cuenta es su
    // propia pantalla (`/accounts/{accountId}`), un match exacto dejaba esa
    // sub-ruta sin redirección y permitía renderizar una superficie Personal
    // con el contexto en Hogar.
    if (path === "/dashboard" || matchesRoute(path, "/accounts")) return { shouldRedirect: true, replaceHref: "/household", keepsContext: "household" };
    if (path === "/movements") return { shouldRedirect: true, replaceHref: "/household/movements", keepsContext: "household" };
    if (path === "/settings") return { shouldRedirect: true, replaceHref: "/household/settings", keepsContext: "household" };
    if (path === "/categories") return { shouldRedirect: true, replaceHref: "/household/categories", keepsContext: "household" };
  }

  if (context === "personal") {
    if (path === "/household" || path.startsWith("/household/")) return { shouldRedirect: true, replaceHref: "/dashboard", keepsContext: "personal" };
  }

  return none;
};

export const isRouteRenderableInContext = (
  pathname: string | null | undefined,
  context: AppContext
): boolean => {
  if (!isRouteAllowedInContext(pathname, context)) return false;
  return !resolveContextRedirection({ pathname, context }).shouldRedirect;
};

/** Entrada segura de cada contexto. */
export const resolveContextEntryRoute = (context: AppContext): string =>
  context === "household" ? HOUSEHOLD_ENTRY_ROUTE : PERSONAL_ENTRY_ROUTE;

export type ContextSwitchDecision = {
  context: AppContext;
  href: string;
  changed: boolean;
};

/**
 * Decisión de cruzar la frontera. `changed` es `false` solo cuando ya se está
 * en ese contexto Y en una ruta que le corresponde: si la ruta actual no
 * pertenece al contexto destino (p. ej. quedó una URL Hogar con contexto
 * Personal), siempre se navega a su entrada segura.
 */
export const resolveContextSwitch = (params: {
  current: AppContext;
  target: AppContext;
  pathname: string | null | undefined;
}): ContextSwitchDecision => {
  const { current, target, pathname } = params;
  const href = resolveContextEntryRoute(target);
  // `renderable` y no solo `allowed`: si la ruta actual está en fallback (una
  // compartida sin superficie Hogar), quedarse debe llevar a la entrada del
  // contexto, no dejar al usuario en una pantalla ajena.
  const alreadySettled = current === target && isRouteRenderableInContext(pathname, target);

  return { context: target, href, changed: !alreadySettled };
};



export type ContextBoundaryCleanup = {
  /** Panel de crear/editar/eliminar movimiento Personal. */
  closePersonalTransactionPanel: boolean;
  /** Selector de período (diálogo global Personal). */
  closePeriodPicker: boolean;
  /** Modo "Editar tablero" de Inicio Personal. */
  exitBoardEditing: boolean;
  /** Diálogos/detalles locales de Hogar al volver a Personal. */
  closeHouseholdSurfaces: boolean;
};

/**
 * Qué limpiar al cruzar la frontera. Cruzar en cualquier dirección cierra todo
 * lo Personal (no puede quedar un panel de dinero propio abierto dentro de
 * Hogar); volver a Personal además cierra las superficies Hogar.
 *
 * No limpia los DATOS cargados: los listeners y los puentes ya aprobados
 * (auto-settle, fallback manual, "Por anotar", deudas) siguen vivos. Lo que
 * cambia es qué se renderiza e interpreta como parte del contexto activo.
 */
export const resolveContextBoundaryCleanup = (params: {
  previous: AppContext;
  next: AppContext;
}): ContextBoundaryCleanup => {
  const crossed = params.previous !== params.next;

  return {
    closePersonalTransactionPanel: crossed,
    closePeriodPicker: crossed,
    exitBoardEditing: crossed,
    closeHouseholdSurfaces: crossed && params.next === "personal",
  };
};

/**
 * Los diálogos de movimientos personales se MONTAN solo en Personal: no basta
 * con ocultarlos visualmente, porque un diálogo montado conserva su estado y
 * puede reabrirse con datos del contexto equivocado.
 */
export const shouldMountPersonalMoneyDialogs = (context: AppContext): boolean =>
  context === "personal";

/** Gasto, ingreso, transferencia, cuenta y bolsillo personales: solo en Personal. */
export const canOpenPersonalMoneyAction = (params: { context: AppContext }): boolean =>
  params.context === "personal";

/**
 * Acciones Hogar (nuevo gasto Hogar, categorías Hogar, ajustes Hogar, detalle
 * de evento): exigen contexto Hogar Y membresía activa operativa. Un hogar
 * vacío/disuelto/no encontrado o en espera de segundo miembro nunca las
 * habilita (paridad con la matriz §4 del contrato de contexto).
 */
export const canOpenHouseholdAction = (params: {
  context: AppContext;
  hasActiveHousehold: boolean;
  householdViewMode: string;
}): boolean =>
  params.context === "household" &&
  params.hasActiveHousehold &&
  params.householdViewMode === "dashboard";

export type HouseholdSessionSnapshot = {
  activeHouseholdId: string | null;
  /** Estado del `household-data-store` (`idle|loading|empty|success|error|dissolved`). */
  status: string;
};

export const isHouseholdSessionUsable = (snapshot: HouseholdSessionSnapshot): boolean =>
  Boolean(snapshot.activeHouseholdId) && snapshot.status === "success";

/**
 * Corrección P1 del Paso 10 — bootstrap seguro de contexto en la carga
 * inicial de una ruta Hogar.
 *
 * Hallazgo: el store de contexto siempre inicia en `"personal"` y nada lo
 * pone en `"household"` salvo el clic explícito del switch. Al recargar o
 * abrir directamente `/household*`, `resolveContextRedirection` interpretaba
 * "ruta Hogar + contexto Personal" como una navegación a corregir y
 * expulsaba a `/dashboard`, aunque el usuario tuviera un Hogar activo
 * confirmado — las 4 rutas Hogar eran inalcanzables por navegación directa.
 *
 * Esta función decide, de forma pura, qué hacer con la URL inicial de una
 * sesión recién montada, SOLO en función de si la suscripción de Hogar ya
 * confirmó (o descartó) una membresía activa:
 * - `"not-applicable"`: la ruta inicial no es una ruta exclusiva de Hogar —
 *   el bootstrap de Hogar no tiene nada que decidir.
 * - `"pending"`: la ruta es Hogar, pero la suscripción de Hogar todavía está
 *   en `idle`/`loading` — no se debe decidir ni redirigir todavía.
 * - `"use-household"`: la ruta es Hogar y la membresía ya se confirmó
 *   (`isHouseholdSessionUsable`) — se acepta la intención inicial de la URL.
 * - `"use-personal"`: la ruta es Hogar pero se confirmó que NO hay Hogar
 *   activo utilizable (vacío, disuelto, o error) — el contexto se mantiene
 *   Personal (ya es el valor por defecto) y el llamador debe aplicar la
 *   redirección segura existente (`resolveContextRedirection`).
 *
 * Esto se evalúa UNA SOLA VEZ por sesión (ver `initialContextBootstrapResolved`
 * en `app-context-store.ts`): no reintroduce sincronización continua
 * URL → contexto. Tras resolverse, el store vuelve a ser la única autoridad
 * y ninguna navegación posterior puede cambiarlo automáticamente.
 */
export type InitialContextBootstrapDecision =
  | { kind: "not-applicable" }
  | { kind: "pending" }
  | { kind: "use-household" }
  | { kind: "use-personal" };

const HOUSEHOLD_BOOTSTRAP_PENDING_STATUSES = ["idle", "loading"] as const;

export const resolveInitialContextBootstrap = (params: {
  pathname: string | null | undefined;
  household: HouseholdSessionSnapshot;
}): InitialContextBootstrapDecision => {
  const routeContext = resolveContextForPath(params.pathname);
  if (routeContext !== "household") {
    return { kind: "not-applicable" };
  }

  if ((HOUSEHOLD_BOOTSTRAP_PENDING_STATUSES as readonly string[]).includes(params.household.status)) {
    return { kind: "pending" };
  }

  if (isHouseholdSessionUsable(params.household)) {
    return { kind: "use-household" };
  }

  return { kind: "use-personal" };
};

/**
 * Estados que confirman una pérdida real del hogar. `loading`, `idle` y
 * `error` quedan explícitamente fuera: son transitorios y expulsar al usuario
 * por un error de red contradiría el manejo ya auditado de
 * `handleListenerError` (NonFatalError conserva la sesión).
 */
export const HOUSEHOLD_TERMINAL_LOSS_STATUSES = ["empty", "dissolved"] as const;

export type HouseholdLossDecision = {
  lost: boolean;
  lostHouseholdId: string | null;
  shouldNotify: boolean;
};

/**
 * Detecta la transición desde un Hogar válido a salido/disuelto/no encontrado.
 * `shouldNotify` es verdadero una única vez por hogar perdido (paridad con
 * `dissolvedToastShownForHouseholdId` de Android): evita avisos repetidos y,
 * como una vez perdido el `previous` ya no es usable, tampoco hay bucle.
 */
export const resolveHouseholdLoss = (params: {
  previous: HouseholdSessionSnapshot | null;
  next: HouseholdSessionSnapshot;
  notifiedForHouseholdId: string | null;
}): HouseholdLossDecision => {
  const { previous, next, notifiedForHouseholdId } = params;
  const none: HouseholdLossDecision = { lost: false, lostHouseholdId: null, shouldNotify: false };

  if (!previous || !isHouseholdSessionUsable(previous)) return none;
  if (isHouseholdSessionUsable(next)) return none;

  const terminal = (HOUSEHOLD_TERMINAL_LOSS_STATUSES as readonly string[]).includes(next.status);
  if (!terminal) return none;

  const lostHouseholdId = previous.activeHouseholdId;

  return {
    lost: true,
    lostHouseholdId,
    shouldNotify: notifiedForHouseholdId !== lostHouseholdId,
  };
};

/** Copy del aviso de pérdida, reutilizando el banner `role="alert"` ya existente. */
export const HOUSEHOLD_LOST_NOTICE =
  "El hogar ya no está disponible. Volviste a tu vista personal.";

export type HouseholdLossRecovery = {
  shouldReturnToPersonal: boolean;
  /** `replace` seguro; `null` si ya se está en una ruta Personal (evita saltos). */
  replaceHref: string | null;
};

export const resolveHouseholdLossRecovery = (params: {
  lost: boolean;
  pathname: string | null | undefined;
}): HouseholdLossRecovery => {
  if (!params.lost) {
    return { shouldReturnToPersonal: false, replaceHref: null };
  }

  const onHouseholdRoute = resolveContextForPath(params.pathname) === "household";

  return {
    shouldReturnToPersonal: true,
    replaceHref: onHouseholdRoute ? PERSONAL_ENTRY_ROUTE : null,
  };
};

/**
 * Un resultado asíncrono disparado desde Hogar (listener, lectura, diálogo)
 * solo puede aplicarse si el contexto y el hogar siguen siendo los mismos.
 * Evita que un callback tardío reabra una superficie Hogar después de que el
 * usuario ya volvió a Personal o entró a otro hogar.
 */
export const isHouseholdSurfaceUpdateStillApplicable = (params: {
  dispatchedContext: AppContext;
  currentContext: AppContext;
  dispatchedHouseholdId: string | null;
  currentHouseholdId: string | null;
}): boolean =>
  params.dispatchedContext === params.currentContext &&
  params.dispatchedHouseholdId === params.currentHouseholdId;
