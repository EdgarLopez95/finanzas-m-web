/**
 * src/lib/accounts/account-visual-catalog.ts
 *
 * Catálogo canónico único de tipos de cuenta, marcas, logos, colores y prefill de nombre.
 * Fuente de verdad para Web, alineada con Android AccountVisualCatalog.kt.
 *
 * Reglas duras (del brief WEB_PARITY_ACCOUNT_TYPES_LOGOS_BRIEF.md):
 * - Solo bank y digital_wallet exigen elegir marca (segundo selector).
 * - Nequi / DaviPlata / Nu / Lulo → WALLET_OPTIONS, no en BANK_OPTIONS.
 * - banco_bogota (key) mapea a ic_bank_bogota.svg (nombre histórico diferente).
 * - Persistencia mínima: type + iconType + iconKey + color + name.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType = "bank" | "digital_wallet" | "cash" | "savings" | "other";
export type AccountIconType = "bank_logo" | "generic";

// ─────────────────────────────────────────────────────────────────────────────
// Logos de marcas (paths relativos a /public/)
// El key canónico puede diferir del nombre histórico del archivo SVG.
// ─────────────────────────────────────────────────────────────────────────────

export const ACCOUNT_LOGOS: Record<string, string> = {
  // Bancos tradicionales
  bancolombia:  "/banks/ic_bank_bancolombia.svg",
  davivienda:   "/banks/ic_bank_davivienda.svg",
  banco_bogota: "/banks/ic_bank_bogota.svg",      // key canónica ≠ nombre de archivo
  bbva:         "/banks/ic_bank_bbva.svg",
  caja_social:  "/banks/ic_bank_caja_social.svg",
  occidente:    "/banks/ic_bank_occidente.svg",
  popular:      "/banks/ic_bank_popular.svg",
  agrario:      "/banks/ic_bank_agrario.svg",
  scotiabank:   "/banks/ic_bank_scotiabank.svg",
  av_villas:    "/banks/ic_bank_av_villas.svg",
  itau:         "/banks/ic_bank_itau.svg",
  // Billeteras digitales
  nequi:        "/banks/ic_bank_nequi.svg",
  daviplata:    "/banks/ic_bank_daviplata.svg",
  nu:           "/banks/ic_bank_nu.svg",
  lulo:         "/banks/ic_bank_lulo.svg",
};

/** Devuelve la ruta al logo de marca, o null si no existe. */
export function resolveAccountLogoSrc(iconKey: string | null | undefined): string | null {
  if (!iconKey) return null;
  return ACCOUNT_LOGOS[iconKey] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Opciones de tipo de cuenta
// ─────────────────────────────────────────────────────────────────────────────

export type AccountTypeOption = {
  value: AccountType;
  label: string;
  description: string;
  iconName: "Landmark" | "Wallet" | "Coins" | "PiggyBank" | "MoreHorizontal";
};

export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  {
    value: "bank",
    label: "Banco",
    description: "Cuenta en banco tradicional.",
    iconName: "Landmark",
  },
  {
    value: "digital_wallet",
    label: "Billetera digital",
    description: "Nequi, DaviPlata, Nu, Lulo u otra.",
    iconName: "Wallet",
  },
  {
    value: "cash",
    label: "Efectivo",
    description: "Dinero físico.",
    iconName: "Coins",
  },
  {
    value: "savings",
    label: "Ahorro / inversión",
    description: "CDT, fondo, meta o inversión.",
    iconName: "PiggyBank",
  },
  {
    value: "other",
    label: "Otro",
    description: "Otro lugar donde guardas dinero.",
    iconName: "MoreHorizontal",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Opciones de marca por familia
// ─────────────────────────────────────────────────────────────────────────────

export type AccountBrandOption = {
  iconKey: string;
  label: string;
  /** Si true, tiene logo de marca en ACCOUNT_LOGOS */
  hasBrandLogo: boolean;
};

/**
 * Bancos tradicionales.
 * Nequi / DaviPlata / Nu / Lulo NO están aquí; están en WALLET_OPTIONS.
 */
export const BANK_OPTIONS: AccountBrandOption[] = [
  { iconKey: "bank_generic", label: "Otro banco",        hasBrandLogo: false },
  { iconKey: "bancolombia",  label: "Bancolombia",       hasBrandLogo: true  },
  { iconKey: "davivienda",   label: "Davivienda",        hasBrandLogo: true  },
  { iconKey: "banco_bogota", label: "Banco de Bogotá",   hasBrandLogo: true  },
  { iconKey: "bbva",         label: "BBVA",              hasBrandLogo: true  },
  { iconKey: "caja_social",  label: "Banco Caja Social", hasBrandLogo: true  },
  { iconKey: "occidente",    label: "Banco de Occidente",hasBrandLogo: true  },
  { iconKey: "popular",      label: "Banco Popular",     hasBrandLogo: true  },
  { iconKey: "agrario",      label: "Banco Agrario",     hasBrandLogo: true  },
  { iconKey: "scotiabank",   label: "Scotiabank",        hasBrandLogo: true  },
  { iconKey: "av_villas",    label: "AV Villas",         hasBrandLogo: true  },
  { iconKey: "itau",         label: "Itaú",              hasBrandLogo: true  },
];

/**
 * Billeteras digitales.
 * Nequi, DaviPlata, Nu y Lulo viven aquí (NO en BANK_OPTIONS).
 */
export const WALLET_OPTIONS: AccountBrandOption[] = [
  { iconKey: "nequi",    label: "Nequi",           hasBrandLogo: true  },
  { iconKey: "daviplata",label: "DaviPlata",        hasBrandLogo: true  },
  { iconKey: "nu",       label: "Nu Bank",          hasBrandLogo: true  },
  { iconKey: "lulo",     label: "Lulo Bank",        hasBrandLogo: true  },
  { iconKey: "wallet",   label: "Otra billetera",   hasBrandLogo: false },
];

/** Subtipos de ahorro (todos son generic; sin logo de marca). */
export const SAVINGS_OPTIONS: AccountBrandOption[] = [
  { iconKey: "savings",       label: "Ahorro",                   hasBrandLogo: false },
  { iconKey: "cdt",           label: "CDT",                      hasBrandLogo: false },
  { iconKey: "investment",    label: "Inversión",                hasBrandLogo: false },
  { iconKey: "fund",          label: "Fondo",                    hasBrandLogo: false },
  { iconKey: "goal",          label: "Meta",                     hasBrandLogo: false },
  { iconKey: "savings_other", label: "Otro ahorro / inversión",  hasBrandLogo: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Colores default por tipo
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<AccountType, string> = {
  bank:           "#60A5FA",
  digital_wallet: "#A78BFA",
  cash:           "#E4B363",
  savings:        "#6C8E7F",
  other:          "#60A5FA",
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolución de iconType desde la selección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado el type y el iconKey seleccionado, devuelve el iconType correcto
 * para persistir en Firestore (igual que Android AccountVisualCatalog).
 *
 * Regla:
 *  - bank + cualquier key (incluido bank_generic) → bank_logo
 *  - digital_wallet + Nequi/DaviPlata/Nu/Lulo → bank_logo
 *  - digital_wallet + wallet → generic
 *  - cash/savings/other → generic
 */
export function resolveIconTypeForSelection(
  type: AccountType,
  iconKey: string | null | undefined
): AccountIconType {
  if (type === "bank") return "bank_logo";
  if (type === "digital_wallet") {
    const walletWithLogo = WALLET_OPTIONS.find((w) => w.iconKey === iconKey && w.hasBrandLogo);
    return walletWithLogo ? "bank_logo" : "generic";
  }
  return "generic";
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de combinación tipo + iconKey
// ─────────────────────────────────────────────────────────────────────────────

const VALID_BANK_ICON_KEYS = new Set(BANK_OPTIONS.map((b) => b.iconKey));
const VALID_WALLET_ICON_KEYS = new Set(WALLET_OPTIONS.map((w) => w.iconKey));
const VALID_SAVINGS_ICON_KEYS = new Set(SAVINGS_OPTIONS.map((s) => s.iconKey));

/**
 * Devuelve true si la combinación (type, iconType, iconKey) es válida.
 * Se usa para validar antes de guardar, sin necesidad de parar el submit para savings (opcional).
 */
export function isValidIconCombination(
  type: AccountType,
  iconType: AccountIconType,
  iconKey: string | null | undefined
): boolean {
  if (!iconKey) {
    // bank y digital_wallet son obligatorios
    return type !== "bank" && type !== "digital_wallet";
  }
  if (type === "bank") {
    return iconType === "bank_logo" && VALID_BANK_ICON_KEYS.has(iconKey);
  }
  if (type === "digital_wallet") {
    return VALID_WALLET_ICON_KEYS.has(iconKey);
  }
  if (type === "savings") {
    return iconType === "generic" && VALID_SAVINGS_ICON_KEYS.has(iconKey);
  }
  if (type === "cash") {
    return iconType === "generic" && iconKey === "cash";
  }
  if (type === "other") {
    return iconType === "generic" && iconKey === "other";
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prefill de nombre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nombre sugerido para la cuenta según el type y el iconKey elegido.
 * Solo se aplica si el usuario no ha editado el nombre a mano.
 * Devuelve null cuando no aplica sugerencia (type "other").
 *
 * Alineado con §6 del brief Android.
 */
export function suggestAccountName(
  type: AccountType,
  iconKey: string | null | undefined
): string | null {
  if (type === "cash") return "Efectivo";
  if (type === "other") return null;

  if (type === "bank") {
    if (!iconKey || iconKey === "bank_generic") return "Banco";
    // Para cualquier banco con marca, usar su label
    const opt = BANK_OPTIONS.find((b) => b.iconKey === iconKey);
    return opt && opt.hasBrandLogo ? opt.label : "Banco";
  }

  if (type === "digital_wallet") {
    if (!iconKey || iconKey === "wallet") return "Billetera digital";
    const opt = WALLET_OPTIONS.find((w) => w.iconKey === iconKey);
    return opt && opt.hasBrandLogo ? opt.label : "Billetera digital";
  }

  if (type === "savings") {
    if (!iconKey || iconKey === "savings") return "Ahorro";
    if (iconKey === "savings_other") return "Ahorro / inversión";
    const opt = SAVINGS_OPTIONS.find((s) => s.iconKey === iconKey);
    return opt ? opt.label : "Ahorro";
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: defaults de icono por tipo (para cuentas creadas sin flujo de marca)
// ─────────────────────────────────────────────────────────────────────────────

export type AccountIconDefaults = {
  iconType: AccountIconType;
  iconKey: string;
};

export const ICON_DEFAULTS_BY_TYPE: Record<AccountType, AccountIconDefaults> = {
  bank:           { iconType: "bank_logo", iconKey: "bank_generic" },
  digital_wallet: { iconType: "generic",   iconKey: "wallet"       },
  cash:           { iconType: "generic",   iconKey: "cash"         },
  savings:        { iconType: "generic",   iconKey: "savings"      },
  other:          { iconType: "generic",   iconKey: "other"        },
};
