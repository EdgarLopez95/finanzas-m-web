import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-theme-token.test.ts...");

/**
 * Paso 8A — Frontera visual Personal/Hogar (corrección P0-3).
 *
 * Contrato visual canónico:
 * - Personal usa exclusivamente kit/tokens Finance.
 * - Hogar usa exclusivamente kit/tokens `Household*` y variables `--hh-*`.
 * - `data-fm-context={activeContext}` en `AppShell` es la única fuente de contexto.
 * - Los puentes personales (completar "Por anotar", declarar pago, acreditar
 *   reembolso) conservan tema Finance porque mueven dinero propio, y deben
 *   declararlo con un comentario `PUENTE PERSONAL: <motivo>`.
 * - El catálogo central `src/lib/categories/household-category-colors.ts` es la
 *   ÚNICA excepción permitida para hex de colores de categoría.
 *
 * Esta prueba ya NO excluye `DashboardShell` ni `Sidebar`: los valida por rama
 * (`#region HOGAR` / `#region PERSONAL`), que era el verde falso detectado por
 * la auditoría Codex.
 */

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

const FINANCE_KIT = [
  "FinanceButton",
  "FinanceCard",
  "FinanceChip",
  "FinanceDialog",
  "FinanceShimmer",
  "FinanceTextField",
];

/** Catálogo central de colores de categoría: única excepción de hex permitida. */
const CATEGORY_COLOR_CATALOG = "@/lib/categories/household-category-colors";

/**
 * Superficies Hogar puras: nada Personal puede vivir aquí. Incluye crear/editar
 * evento, categorías, ajustes Hogar y el resumen compartido — que NO son
 * puentes personales y por tanto no pueden etiquetarse como tales.
 */
const PURE_HOUSEHOLD_SURFACES = [
  "app/(dashboard)/household/page.tsx",
  "features/household/components/household-overview.tsx",
  "features/household/components/welcome-household.tsx",
  "features/household/components/household-waiting-state.tsx",
  "features/household/components/create-household-expense-dialog.tsx",
  "features/household/components/edit-household-expense-dialog.tsx",
  "features/household/components/views/household-categories-view.tsx",
  "features/household/components/views/household-settings-view.tsx",
  "features/household/components/views/household-movements-view.tsx",
  "features/household/components/household-dissolved-state.tsx",
];

/** Superficie mixta: Hogar puro + CTA de dinero personal documentados. */
const MIXED_SURFACES = ["features/household/components/household-event-detail-dialog.tsx"];

/**
 * Puentes personales: mueven dinero propio del usuario aunque el dato venga de
 * Hogar. Toda su superficie visual (contenedor, título, inputs, bordes, foco,
 * botones, copy y estados) debe ser tema Personal/Finance completo, y no puede
 * quedar ningún rol `--hh-*`.
 */
const PERSONAL_BRIDGES = [
  {
    file: "features/household/components/complete-share-dialog.tsx",
    motivo: /registra un gasto desde mi cuenta personal|registra gasto desde mi cuenta personal/i,
  },
  {
    file: "features/household/components/declare-payment-dialog.tsx",
    motivo: /descuenta dinero de mi cuenta personal/i,
  },
  {
    file: "features/household/components/confirm-reception-dialog.tsx",
    motivo: /acredita dinero en mi cuenta personal/i,
  },
  {
    file: "features/household/components/household-debt-reception-fallback.tsx",
    motivo: /acredita dinero en mi cuenta personal/i,
  },
];

/**
 * Blanco y negro directos de Tailwind (con o sin opacidad). En superficies
 * Hogar el color debe venir de un rol semántico `--hh-*`, nunca de
 * `bg-white/[0.02]` o `bg-black/80`.
 */
const RAW_BLACK_WHITE = /\b(?:bg|text|border|from|via|to|ring|divide|outline)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/(?:\[[^\]]*\]|[0-9.]+))?\b/;


/** Shells con dos ramas visuales reales, validados por región. */
const BRANCHED_SHELLS = [
  "components/layout/dashboard-shell.tsx",
  "components/layout/sidebar.tsx",
  "components/layout/top-bar.tsx",
];

const householdUiKitFiles = fs
  .readdirSync(path.resolve(repoRoot, "src/features/household/components/ui"))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => `features/household/components/ui/${f}`);

/** Extrae el contenido entre `// #region <name>` y `// #endregion <name>`. */
const extractRegions = (content: string, name: string): string[] => {
  const regions: string[] = [];
  const re = new RegExp(`//\\s*#region\\s+${name}([\\s\\S]*?)//\\s*#endregion\\s+${name}`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    regions.push(match[1]);
  }
  return regions;
};

/**
 * Quita comentarios (de bloque, de línea y JSX) para no penalizar nombres o
 * hex citados en documentación. Lo que se valida es el código real.
 */
const stripLineComments = (content: string): string =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

const assertNoPersonalTokens = (content: string, label: string) => {
  const code = stripLineComments(content);
  assert.doesNotMatch(code, /var\(--fm-/, `${label}: no debe usar variables --fm-*`);
  assert.doesNotMatch(code, /rgba\(/, `${label}: no debe usar rgba()`);
  assert.doesNotMatch(code, /rgb\(/, `${label}: no debe usar rgb()`);
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, `${label}: no debe declarar colores hex`);
};

const assertNoFinanceKit = (content: string, label: string) => {
  const code = stripLineComments(content);
  for (const component of FINANCE_KIT) {
    assert.doesNotMatch(code, new RegExp(`\\b${component}\\b`), `${label}: no debe usar ${component}`);
  }
  assert.doesNotMatch(code, /(?<!Household)\bEmptyState\b/, `${label}: no debe usar EmptyState de Finance`);
};

/**
 * P0-5: una superficie Hogar pura no importa NADA de `@/components/finance/**`.
 * No basta con que el símbolo no se llame `Finance*`: `Amount`,
 * `TransactionTimelineItem`, `FinanceSidePanel` y `PeriodPickerDialog` usan
 * internamente `--fm-*`, `FinanceChip` o `FinanceButton`, así que no son
 * primitivos neutrales.
 */
const assertNoFinanceImports = (content: string, label: string) => {
  const offenders = content
    .split("\n")
    .filter((line) => /from\s+"@\/components\/finance\//.test(line))
    .map((line) => line.trim());

  assert.deepEqual(
    offenders,
    [],
    `${label}: es Hogar puro y no puede importar de @/components/finance/** -> ${offenders.join(" | ")}`
  );
};

/** El color debe venir de roles `--hh-*`, nunca de blanco/negro Tailwind. */
const assertNoRawBlackWhite = (content: string, label: string) => {
  const code = stripLineComments(content);
  const hit = code.match(new RegExp(RAW_BLACK_WHITE, "g"));
  assert.equal(
    hit,
    null,
    `${label}: usa color blanco/negro directo (${hit?.join(", ")}); debe usar un rol semántico --hh-*`
  );
};

export function runHouseholdThemeTokenTests() {
  let checks = 0;

  // ---------------------------------------------------------------
  // 1. Tokens --hh-* centrales y bloque contextual efectivo en CSS
  // ---------------------------------------------------------------
  const cssContent = fs.readFileSync(path.resolve(repoRoot, "src/app/globals.css"), "utf-8");

  for (const token of [
    "--hh-background",
    "--hh-surface",
    "--hh-primary-action",
    "--hh-text",
    "--hh-overlay",
    "--hh-shadow",
    "--hh-focus-ring",
  ]) {
    assert.match(cssContent, new RegExp(`${token}:`), `Debe definir ${token}`);
    checks++;
  }

  const shadowLines = cssContent.split("\n").filter(l => l.includes("--hh-shadow"));
  for (const line of shadowLines) {
    assert.doesNotMatch(line, /2\s*,\s*6\s*,\s*23/, `Sombras HH no deben contener navy 2,6,23: ${line}`);
    assert.doesNotMatch(line, /2\s+6\s+23/, `Sombras HH no deben contener navy 2 6 23: ${line}`);
    checks++;
  }

  assert.match(
    cssContent,
    /\[data-fm-context="household"\]\s*\{/,
    'Debe existir un bloque CSS efectivo para [data-fm-context="household"]'
  );
  assert.doesNotMatch(
    cssContent,
    /body\[data-fm-context/,
    "No debe usarse body[data-fm-context=...]: el contexto vive en el contenedor de AppShell"
  );
  checks += 2;

  assert.match(
    cssContent,
    /body:has\(\[data-fm-context="household"\]\)/,
    "Debe neutralizar el ambient del body bajo contexto Hogar"
  );
  
  const householdBodyMatch = cssContent.match(/body:has\(\[data-fm-context="household"\]\)\s*\{([^}]+)\}/);
  if (householdBodyMatch) {
    assert.doesNotMatch(
        householdBodyMatch[1],
        /59\s*(,|)\s*130\s*(,|)\s*246/,
        "El ambient del body en Hogar no debe incluir el radial azul Personal"
    );
  }
  checks += 2;

  // HH-VIS-1.3: reset universal + alias FM→HH bajo contexto Hogar
  assert.match(
    cssContent,
    /\*\s*\{\s*[^}]*border-color:\s*var\(--border\)/,
    "El reset * debe usar border-color: var(--border) (token de contexto)"
  );
  assert.doesNotMatch(
    cssContent,
    /\*\s*\{\s*[^}]*border-color:\s*var\(--fm-border-dark\)/,
    "El reset * no debe fijar border-color a --fm-border-dark (slate azul en Hogar)"
  );
  const householdCtxMatch = cssContent.match(
    /\[data-fm-context="household"\]\s*\{([\s\S]*?)\n\}/
  );
  assert.ok(householdCtxMatch, "Bloque [data-fm-context=household] parseable");
  assert.match(
    householdCtxMatch![1],
    /--fm-border-dark:\s*var\(--hh-border\)/,
    "En Hogar, --fm-border-dark debe aliasar a --hh-border"
  );
  assert.match(
    householdCtxMatch![1],
    /--fm-shadow-soft:\s*var\(--hh-shadow-soft\)/,
    "En Hogar, --fm-shadow-soft debe aliasar a sombra HH"
  );
  assert.match(
    householdCtxMatch![1],
    /--fm-text-muted:\s*var\(--hh-text-muted\)/,
    "En Hogar, --fm-text-muted debe aliasar a --hh-text-muted"
  );
  assert.match(
    householdCtxMatch![1],
    /--fm-transfer:\s*var\(--hh-focus-ring\)/,
    "En Hogar, --fm-transfer debe aliasar a --hh-focus-ring"
  );
  assert.match(
    householdCtxMatch![1],
    /accent-color:\s*var\(--hh-primary-action\)/,
    "En Hogar, accent-color nativo debe ser --hh-primary-action (no azul del SO)"
  );
  assert.match(
    cssContent,
    /--hh-surface-hover:\s*#/,
    "Debe existir --hh-surface-hover para listboxes/hovers del kit Hogar"
  );
  assert.match(
    cssContent,
    /--hh-shadow-soft:\s*[^;]*6\s+16\s+13/,
    "Sombras HH deben tintarse con bosque (6 16 13), no negro puro ni navy Personal"
  );
  assert.match(
    cssContent,
    /\[data-fm-context="personal"\]\s*\{/,
    'Debe existir un bloque CSS efectivo para restaurar el tema Finance en puentes personales'
  );
  checks += 10;

  // ---------------------------------------------------------------
  // 2. Superficies Hogar puras
  // ---------------------------------------------------------------
  for (const rel of PURE_HOUSEHOLD_SURFACES) {
    const content = readSrc(rel);
    assertNoFinanceKit(content, rel);
    assertNoFinanceImports(content, rel);
    assertNoRawBlackWhite(content, rel);

    // El catálogo central es la única fuente de hex de categoría permitida.
    const importsCatalog = content.includes(CATEGORY_COLOR_CATALOG);
    const withoutCatalogImport = content
      .split("\n")
      .filter((line) => !line.includes(CATEGORY_COLOR_CATALOG))
      .join("\n");
    assertNoPersonalTokens(withoutCatalogImport, rel);

    if (/COLOR_OPTIONS|DEFAULT_COLOR\s*=/.test(stripLineComments(content))) {
      assert.ok(
        importsCatalog,
        `${rel}: no puede declarar su propia paleta de colores; debe importar ${CATEGORY_COLOR_CATALOG}`
      );
    }

    // Una superficie Hogar pura nunca puede etiquetarse como puente personal.
    assert.doesNotMatch(
      content,
      /PUENTE PERSONAL/,
      `${rel}: es Hogar puro y no debe llevar la etiqueta "PUENTE PERSONAL"`
    );
    checks++;
  }

  // ---------------------------------------------------------------
  // 2b. Create gasto HH: sin <select> nativo (el SO pinta acento azul)
  // ---------------------------------------------------------------
  const createExpenseSrc = readSrc("features/household/components/create-household-expense-dialog.tsx");
  assert.doesNotMatch(
    createExpenseSrc,
    /<select\b/,
    "create-household-expense-dialog.tsx: debe usar HouseholdCategorySelect, no <select> nativo"
  );
  assert.match(
    createExpenseSrc,
    /HouseholdCategorySelect/,
    "create-household-expense-dialog.tsx: debe montar HouseholdCategorySelect"
  );
  checks += 2;

  // ---------------------------------------------------------------
  // 2c. Categorías del Hogar: Hogar puro, sin nada del kit Finance
  // ---------------------------------------------------------------
  const categoriesDialog = readSrc("features/household/components/views/household-categories-view.tsx");
  assert.doesNotMatch(
    categoriesDialog,
    /src\/components\/finance\//,
    "views/household-categories-view.tsx: es Hogar puro y no debe importar NADA de src/components/finance/**"
  );
  assert.match(
    categoriesDialog,
    /HouseholdIconSelect/,
    "views/household-categories-view.tsx: debe usar el selector de iconos del kit Hogar"
  );
  checks++;

  // ---------------------------------------------------------------
  // 3. Kit base Household: solo roles --hh-*
  // ---------------------------------------------------------------
  const requiredKit = [
    "household-button.tsx",
    "household-card.tsx",
    "household-chip.tsx",
    "household-dialog.tsx",
    "household-empty-state.tsx",
    "household-shimmer.tsx",
    "household-text-field.tsx",
  ];
  for (const file of requiredKit) {
    assert.ok(
      householdUiKitFiles.some((f) => f.endsWith(file)),
      `El kit Hogar debe incluir ${file}`
    );
    checks++;
  }

  const cardContent = readSrc("features/household/components/ui/household-card.tsx");
  assert.match(cardContent, /ring-0/, "HouseholdCard debe anular explícitamente el ring con ring-0");
  assert.match(cardContent, /ring-transparent/, "HouseholdCard debe anular explícitamente el ring con ring-transparent");
  assert.doesNotMatch(cardContent, /from "@\/components\/ui\/card"/, "HouseholdCard ya no debe usar Card de shadcn para evitar shadow/ring base");
  checks += 3;

  let kitContentAll = "";
  for (const rel of householdUiKitFiles) {
    const content = readSrc(rel);
    kitContentAll += content;
    assertNoFinanceKit(content, rel);
    assertNoFinanceImports(content, rel);
    assertNoPersonalTokens(content, rel);
    assertNoRawBlackWhite(content, rel);
    checks++;
  }

  for (const role of ["--hh-overlay", "--hh-shadow", "--hh-focus-ring"]) {
    assert.ok(kitContentAll.includes(role), `El kit Hogar debe consumir el rol ${role}`);
    checks++;
  }

  // ---------------------------------------------------------------
  // 4. Shells con dos ramas: validación POR RAMA (no se excluyen)
  // ---------------------------------------------------------------
  for (const rel of BRANCHED_SHELLS) {
    const content = readSrc(rel);

    const householdRegions = extractRegions(content, "HOGAR");
    const personalRegions = extractRegions(content, "PERSONAL");

    assert.ok(
      householdRegions.length > 0,
      `${rel}: debe delimitar su rama Hogar con "// #region HOGAR" para poder validarla`
    );
    assert.ok(
      personalRegions.length > 0,
      `${rel}: debe delimitar su rama Personal con "// #region PERSONAL" para poder validarla`
    );

    for (const region of householdRegions) {
      assertNoFinanceKit(region, `${rel} (rama HOGAR)`);
      assertNoPersonalTokens(region, `${rel} (rama HOGAR)`);
      if (rel.includes("dashboard-shell.tsx")) {
        assert.doesNotMatch(stripLineComments(region), /border-white/, `${rel} (rama HOGAR): no debe usar border-white`);
        checks++;
      }
    }

    for (const region of personalRegions) {
      assert.doesNotMatch(
        stripLineComments(region),
        /var\(--hh-/,
        `${rel} (rama PERSONAL): no debe usar tokens --hh-*; Personal usa el kit y tokens Finance`
      );
    }
    checks++;
  }

  // ---------------------------------------------------------------
  // 5. Superficie mixta: Hogar por defecto, Finance solo en CTA de dinero propio
  // ---------------------------------------------------------------
  for (const rel of MIXED_SURFACES) {
    const content = readSrc(rel);
    const lines = content.split("\n");

    // El chrome compartido del evento (contenedor, título, chips, resumen,
    // shares, deudas, historial, acciones del evento) es Hogar puro.
    assert.match(content, /HouseholdChip/, `${rel}: los chips del evento Hogar deben usar HouseholdChip`);
    assert.match(content, /HouseholdButton/, `${rel}: las acciones de evento Hogar deben usar HouseholdButton`);
    for (const chromeComponent of ["FinanceChip", "FinanceCard", "FinanceDialog", "FinanceShimmer", "FinanceTextField"]) {
      assert.doesNotMatch(
        stripLineComments(content),
        new RegExp(`\\b${chromeComponent}\\b`),
        `${rel}: ${chromeComponent} pertenece a Personal; el chrome del evento es Hogar`
      );
    }
    assertNoRawBlackWhite(content, rel);

    // La excepción Finance solo cubre el BLOQUE que sigue a cada marcador
    // `PUENTE PERSONAL: <motivo>`: o bien una línea de import, o bien el
    // elemento JSX que abre justo después, hasta su etiqueta de cierre. Así la
    // excepción no puede estirarse hasta el título, los chips, el resumen, el
    // historial, las shares ni las acciones puras del evento.
    const markedLines = new Set<number>();
    lines.forEach((line, index) => {
      if (!/PUENTE PERSONAL:\s*\S+/.test(line)) return;
      markedLines.add(index);

      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
      if (cursor >= lines.length) return;

      // Import de una sola línea.
      if (/^\s*import\b/.test(lines[cursor])) {
        markedLines.add(cursor);
        return;
      }

      // Elemento JSX: desde su apertura hasta su cierre.
      const open = lines[cursor].match(/<([A-Za-z][A-Za-z0-9]*)/);
      if (!open) return;
      const tag = open[1];
      for (let i = cursor; i < lines.length; i++) {
        markedLines.add(i);
        if (new RegExp(`</${tag}>`).test(lines[i]) || /\/>\s*$/.test(lines[i])) break;
      }
    });

    lines.forEach((line, index) => {
      const code = stripLineComments(line);
      const usesFinance =
        /\bFinance[A-Za-z]+\b/.test(code) ||
        /var\(--fm-/.test(code) ||
        // P0-5: importar de Finance cuenta como uso aunque el símbolo no se
        // llame `Finance*` (Amount, TransactionTimelineItem, …).
        /from\s+"@\/components\/finance\//.test(code);
      if (!usesFinance) return;

      assert.ok(
        markedLines.has(index),
        `${rel}:${index + 1}: uso/import de Finance fuera de un bloque marcado con "PUENTE PERSONAL: <motivo>" -> ${line.trim().slice(0, 90)}`
      );
    });

    assert.ok(markedLines.size > 0, `${rel}: debe existir al menos un CTA marcado como puente personal`);

    // El título del evento es chrome Hogar y nunca puede llevar tokens Personal.
    const titleLine = lines.find((line) => line.includes("<h2"));
    assert.ok(titleLine, `${rel}: debe existir el título del evento`);
    assert.doesNotMatch(titleLine!, /var\(--fm-/, `${rel}: el título del evento es Hogar puro`);

    // La etiqueta genérica sin motivo no es aceptable.
    assert.doesNotMatch(
      content,
      /PUENTE PERSONAL\s*(\*\/|\}|$)/m,
      `${rel}: cada excepción "PUENTE PERSONAL" debe indicar un motivo tras los dos puntos`
    );
    assert.doesNotMatch(
      content,
      /var\(--fm-pending\)/,
      `${rel}: el CTA puente de Anotar no debe usar --fm-pending`
    );
    assert.doesNotMatch(
      content,
      /var\(--fm-household\)/,
      `${rel}: el CTA puente de Pagar no debe usar --fm-household`
    );
    checks += 3;
  }

  // ---------------------------------------------------------------
  // 5b. Puentes personales: tema Personal/Finance completo, cero --hh-*
  // ---------------------------------------------------------------
  for (const bridge of PERSONAL_BRIDGES) {
    const content = readSrc(bridge.file);
    const code = stripLineComments(content);

    assert.doesNotMatch(
      code,
      /var\(--hh-/,
      `${bridge.file}: es un puente personal (mueve dinero propio); no puede conservar roles --hh-*`
    );
    assert.doesNotMatch(
      code,
      /\bHousehold(Button|Card|Chip|Dialog|EmptyState|Shimmer|TextField)\b/,
      `${bridge.file}: un puente personal usa el kit Finance en toda su superficie visual`
    );
    assert.match(
      content,
      /\/\/\s*PUENTE PERSONAL:\s*\S+/,
      `${bridge.file}: debe declarar "// PUENTE PERSONAL: <motivo concreto>"`
    );
    assert.match(
      content,
      bridge.motivo,
      `${bridge.file}: el motivo del puente debe explicar el movimiento de dinero personal`
    );
    assert.match(
      code,
      /data-fm-context="personal"/,
      `${bridge.file}: los puentes personales deben aislarse del contexto Hogar (data-fm-context="personal")`
    );
    checks++;
  }

  // ---------------------------------------------------------------
  // 6. Catálogo central de colores de categoría
  // ---------------------------------------------------------------
  const catalog = readSrc("lib/categories/household-category-colors.ts");
  assert.match(catalog, /HOUSEHOLD_CATEGORY_COLORS/, "El catálogo central debe exportar HOUSEHOLD_CATEGORY_COLORS");
  assert.match(
    catalog,
    /DEFAULT_HOUSEHOLD_CATEGORY_COLOR/,
    "El catálogo central debe exportar DEFAULT_HOUSEHOLD_CATEGORY_COLOR"
  );
  checks++;

  console.log(`  ✓ Frontera visual Personal/Hogar validada (${checks} comprobaciones).`);
}

runHouseholdThemeTokenTests();
