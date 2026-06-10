import { Amount } from "@/components/finance/amount";
import { getTransactionVisual } from "@/lib/design/personal-visuals";
import type { PersonalMovementRow } from "@/features/dashboard/lib/personal-view-model";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

type PersonalTransactionRowProps = {
  row: PersonalMovementRow;
  masked?: boolean;
  showGroup?: boolean;
  actionSlot?: React.ReactNode;
};

export function PersonalTransactionRow({
  row,
  masked = false,
  actionSlot,
}: PersonalTransactionRowProps) {
  let visual = getTransactionVisual(row.type, row.metadata);
  if (row.type === "expense" && row.categoryIconKey) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "expense");
    visual = {
      accent: row.categoryColor || "#fb7185",
      accentSoft: (row.categoryColor || "#fb7185") + "22",
      icon: Icon,
    };
  } else if (row.type === "income" && row.categoryIconKey) {
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

  const displaySubtitle = row.type === "transfer"
    ? `Transferencia · ${row.accountName} ➔ ${row.targetAccountName || "Cuenta"}`
    : `${row.categoryName || "Sin categoria"} · ${row.accountName || "Cuenta"}`;

  return (
    <article className="flex items-center gap-3 py-0.5">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
        style={{
          backgroundColor: visual.accentSoft,
          borderColor: `${visual.accent}22`,
          color: visual.accent,
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-[var(--font-display)] text-sm font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
          {row.title}
        </p>
        <p className="truncate text-xs text-[var(--fm-text-muted)]">
          {displaySubtitle}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Amount
          className="text-base font-semibold"
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
  row: PersonalMovementRow;
  masked?: boolean;
};

export function PersonalRecentMovementRow({
  row,
  masked = false,
}: PersonalRecentMovementRowProps) {
  let visual = getTransactionVisual(row.type, row.metadata);
  if (row.type === "expense" && row.categoryIconKey) {
    const Icon = resolveCategoryIcon(row.categoryIconKey, "expense");
    visual = {
      accent: row.categoryColor || "#fb7185",
      accentSoft: (row.categoryColor || "#fb7185") + "22",
      icon: Icon,
    };
  } else if (row.type === "income" && row.categoryIconKey) {
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

  const displaySubtitle = row.type === "transfer"
    ? `Transferencia · ${row.accountName} ➔ ${row.targetAccountName || "Cuenta"}`
    : `${row.categoryName || "Sin categoria"} · ${row.accountName || "Cuenta"}`;

  return (
    <article className="flex items-center gap-3 py-0.5">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
        style={{
          backgroundColor: visual.accentSoft,
          borderColor: `${visual.accent}22`,
          color: visual.accent,
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-[var(--font-display)] text-sm font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
          {row.title}
        </p>
        <p className="truncate text-xs text-[var(--fm-text-muted)]">
          {displaySubtitle}
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
