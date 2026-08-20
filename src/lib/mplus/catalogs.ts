import type { AccountIconType, AccountType, MovementType } from "./enums";

/**
 * Catálogos e invariantes literales del contrato v1 (§4.4, §4.5, §7.2, §24).
 *
 * Estas listas son la copia TS de las que valida `android/firestore.rules`
 * (`validAccountIcon`, `validExpenseIcon`, `validIncomeIcon`). Si divergen, el
 * cliente Web deja pasar payloads que el servidor rechaza — por eso hay una
 * prueba de paridad que las contrasta contra el archivo de reglas canónico.
 */

/** Contrato §4.5: monto entero COP, sin decimales ni símbolo. */
export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 999_999_999_999;

/** Contrato §4.2: UUID v4 en minúsculas = 36 caracteres. */
export const UUID_LENGTH = 36;
export const UID_MAX_LENGTH = 128;
export const DERIVED_ID_MAX_LENGTH = 256;

export const NAME_MAX_LENGTH = 50;
export const TITLE_MAX_LENGTH = 100;
export const NOTE_MAX_LENGTH = 500;
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const PHOTO_URL_MAX_LENGTH = 2048;

/** Contrato §12.1 / DEC-072: código de invitación de 3 dígitos. */
export const INVITE_CODE_PATTERN = /^[0-9]{3}$/;

/** `#RRGGBB` — mismo patrón que `validColor` en las Rules canónicas. */
export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Mismo patrón que `validUuid` en las Rules canónicas (v1–v5, variante 8/9/a/b). */
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/** Contrato §7.2 — combinaciones `type` → `iconType` → `iconKey` admitidas. */
export const ACCOUNT_ICON_CATALOG: Readonly<
  Record<AccountType, ReadonlyArray<{ iconType: AccountIconType; iconKeys: readonly string[] }>>
> = {
  bank: [
    {
      iconType: "bank_logo",
      iconKeys: [
        "bank_generic",
        "bancolombia",
        "davivienda",
        "banco_bogota",
        "bbva",
        "caja_social",
        "occidente",
        "popular",
        "agrario",
        "scotiabank",
        "av_villas",
        "itau",
      ],
    },
  ],
  digital_wallet: [
    { iconType: "bank_logo", iconKeys: ["nequi", "daviplata", "nu", "lulo"] },
    { iconType: "generic", iconKeys: ["wallet"] },
  ],
  cash: [{ iconType: "generic", iconKeys: ["cash"] }],
  savings: [
    {
      iconType: "generic",
      iconKeys: ["savings", "cdt", "investment", "fund", "goal", "savings_other"],
    },
  ],
  other: [{ iconType: "generic", iconKeys: ["other"] }],
};

export const isValidAccountIcon = (
  type: AccountType,
  iconType: AccountIconType,
  iconKey: string,
): boolean =>
  ACCOUNT_ICON_CATALOG[type].some(
    (entry) => entry.iconType === iconType && entry.iconKeys.includes(iconKey),
  );

/** Contrato §24.1. */
export const EXPENSE_ICON_KEYS = [
  "food", "groceries", "restaurant", "coffee", "delivery", "housing",
  "cleaning", "maintenance", "electricity", "water", "gas_service",
  "car", "transport", "gasoline", "parking", "toll", "health",
  "pharmacy", "personal_care", "fitness", "haircut", "shopping",
  "clothes", "gifts", "bills", "credit_card", "subscriptions",
  "internet", "phone", "apps", "cloud", "insurance", "pets",
  "entertainment", "family", "education", "bank", "celebration",
  "travel", "other",
] as const;

/** Contrato §24.2. */
export const INCOME_ICON_KEYS = [
  "salary", "freelance", "design_work", "service_work", "teaching",
  "creative_income", "sales", "business", "client_payment",
  "commission", "bonus", "investment", "interest", "dividends",
  "rental_income", "family_support", "gift_income", "cashback",
  "refund", "reimbursement", "loan_received", "content_income",
  "other_income", "unknown_income",
] as const;

export const isValidCategoryIcon = (type: MovementType, iconKey: string): boolean =>
  type === "expense"
    ? (EXPENSE_ICON_KEYS as readonly string[]).includes(iconKey)
    : (INCOME_ICON_KEYS as readonly string[]).includes(iconKey);

/**
 * Contrato §4.4: nombre normalizado SOLO para advertir duplicados en cliente.
 * Nunca se persiste ni sustituye la identidad por ID.
 */
export const normalizedNameKey = (value: string): string =>
  value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-CO");
