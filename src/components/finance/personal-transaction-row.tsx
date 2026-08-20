import { Amount } from "@/components/finance/amount";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { getTransactionVisual } from "@/lib/design/personal-visuals";
import { AccountIcon } from "@/components/finance/account-icon";
const TECHNICAL_TITLES = new Set(["Saldo inicial", "Ajuste manual de saldo", "Cierre de bolsillo"]);
const isTechnicalTransaction = (title?: string | null): boolean =>
  title ? TECHNICAL_TITLES.has(title.trim()) : false;

/**
 * Forma mínima que necesita la fila para pintarse.
 *
 * Se declara estructural (y no atada a `PersonalMovementRow`) para que la
 * MISMA fila visual sirva a los dos modelos durante la adaptación: el legacy y
 * el del contrato v1 (`MplusMovementRow`), que ya no tiene bolsillo, cuenta
 * destino ni titularidad. Los campos retirados quedan opcionales: un modelo
 * que no los trae simplemente no dispara sus ramas.
 */
export type DisplayMovementRow = {
  id: string;
  title: string;
  subtitle?: string;
  amount: number;
  type: "income" | "expense" | "transfer" | "reimbursement" | "pending";
  dateLabel: string;
  groupLabel: string;
  metadata?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIconKey?: string;
  accountName?: string | null;
  accountColor?: string | null;
  accountIconKey?: string | null;
  accountIconType?: string | null;
  pocketName?: string | null;
  targetAccountName?: string | null;
  targetPocketName?: string | null;
};

type PersonalTransactionRowProps = {
  row: DisplayMovementRow;
  masked?: boolean;
  showGroup?: boolean;
  actionSlot?: React.ReactNode;
};

const buildDisplaySubtitle = (row: DisplayMovementRow): string => {
  if (row.type === "transfer") {
    const isSameAccount = row.accountName === row.targetAccountName;
    const fromLabel = row.pocketName
      ? isSameAccount ? row.pocketName : `${row.pocketName} · ${row.accountName}`
      : `disponible de ${row.accountName}`;
    const toLabel = row.targetPocketName
      ? isSameAccount ? row.targetPocketName : `${row.targetPocketName} · ${row.targetAccountName || "Cuenta"}`
      : `disponible de ${row.targetAccountName || "Cuenta"}`;
    return `Transferencia · ${fromLabel} → ${toLabel}`;
  }
  if (isTechnicalTransaction(row.title)) {
    return `Cuenta · ${row.accountName || "Cuenta"}`;
  }

  const categoryLabel = row.categoryName || "Sin categoría";
  // En M+ la cuenta es opcional: sin cuenta, el subtítulo es solo la
  // categoría — nunca un "Cuenta" de relleno que sugiera que hay una.
  if (!row.accountName) {
    return categoryLabel;
  }

  return `${categoryLabel} · ${row.accountName}${row.pocketName ? ` / ${row.pocketName}` : ""}`;
};

export function PersonalTransactionRow({
  row,
  masked = false,
  actionSlot,
}: PersonalTransactionRowProps) {
  let visual = getTransactionVisual(row.type, row.metadata ?? "");
  const isTechnical = isTechnicalTransaction(row.title);

  if (row.type === "expense" && row.categoryIconKey && !isTechnical) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "expense");
    visual = {
      accent: row.categoryColor || "#fb7185",
      accentSoft: (row.categoryColor || "#fb7185") + "22",
      icon: Icon,
    };
  } else if (row.type === "income" && row.categoryIconKey && !isTechnical) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "income");
    visual = {
      accent: row.categoryColor || "#34d399",
      accentSoft: (row.categoryColor || "#34d399") + "22",
      icon: Icon,
    };
  }
  const Icon = visual.icon;
  const amountVariant = row.type === "income"
    ? "income"
    : row.type === "expense"
      ? "expense"
      : row.type === "transfer"
        ? "transfer"
        : "neutral";

  return (
    <article className="flex items-center gap-3 py-1.5">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
        style={
          isTechnical
            ? {
                backgroundColor: `${row.accountColor || "#60a5fa"}22`,
                borderColor: `${row.accountColor || "#60a5fa"}22`,
                color: row.accountColor || "#60a5fa",
              }
            : {
                backgroundColor: visual.accentSoft,
                borderColor: `${visual.accent}22`,
                color: visual.accent,
              }
        }
      >
        {isTechnical ? (
          <AccountIcon
            iconType={(row.accountIconType as "generic" | "bank_logo") || "generic"}
            iconKey={row.accountIconKey || "bank"}
            color={row.accountColor || "#60a5fa"}
            size="xs"
          />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
          {row.title}
        </p>
        <p className="truncate text-[12px] text-[var(--fm-text-muted)]">
          {buildDisplaySubtitle(row)}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Amount
          className="text-[15px] font-semibold"
          masked={masked}
          showSign
          size="sm"
          value={row.amount}
          variant={amountVariant}
        />
        {actionSlot}
      </div>
    </article>
  );
}

type PersonalRecentMovementRowProps = {
  row: DisplayMovementRow;
  masked?: boolean;
};

export function PersonalRecentMovementRow({
  row,
  masked = false,
}: PersonalRecentMovementRowProps) {
  let visual = getTransactionVisual(row.type, row.metadata ?? "");
  const isTechnical = isTechnicalTransaction(row.title);

  if (row.type === "expense" && row.categoryIconKey && !isTechnical) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "expense");
    visual = {
      accent: row.categoryColor || "#fb7185",
      accentSoft: (row.categoryColor || "#fb7185") + "22",
      icon: Icon,
    };
  } else if (row.type === "income" && row.categoryIconKey && !isTechnical) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "income");
    visual = {
      accent: row.categoryColor || "#34d399",
      accentSoft: (row.categoryColor || "#34d399") + "22",
      icon: Icon,
    };
  }
  const Icon = visual.icon;
  const amountVariant = row.type === "income"
    ? "income"
    : row.type === "expense"
      ? "expense"
      : row.type === "transfer"
        ? "transfer"
        : "neutral";

  return (
    <article className="flex items-center gap-3 py-0.5">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
        style={
          isTechnical
            ? {
                backgroundColor: `${row.accountColor || "#60a5fa"}22`,
                borderColor: `${row.accountColor || "#60a5fa"}22`,
                color: row.accountColor || "#60a5fa",
              }
            : {
                backgroundColor: visual.accentSoft,
                borderColor: `${visual.accent}22`,
                color: visual.accent,
              }
        }
      >
        {isTechnical ? (
          <AccountIcon
            iconType={(row.accountIconType as "generic" | "bank_logo") || "generic"}
            iconKey={row.accountIconKey || "bank"}
            color={row.accountColor || "#60a5fa"}
            size="xs"
            className="scale-90"
          />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-[var(--font-display)] text-sm font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
          {row.title}
        </p>
        <p className="truncate text-xs text-[var(--fm-text-muted)]">
          {buildDisplaySubtitle(row)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <Amount
          className="text-base font-semibold"
          masked={masked}
          showSign
          size="sm"
          value={row.amount}
          variant={amountVariant}
        />
      </div>
    </article>
  );
}
