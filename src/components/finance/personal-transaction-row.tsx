import { Amount } from "@/components/finance/amount";
import { getTransactionVisual } from "@/lib/design/personal-visuals";
import type { PersonalMovementRow } from "@/features/dashboard/lib/personal-view-model";

type PersonalTransactionRowProps = {
  row: PersonalMovementRow;
  masked?: boolean;
  showGroup?: boolean;
  actionSlot?: React.ReactNode;
};

export function PersonalTransactionRow({
  row,
  masked = false,
  showGroup = false,
  actionSlot,
}: PersonalTransactionRowProps) {
  const visual = getTransactionVisual(row.type, row.metadata);
  const Icon = visual.icon;
  const amountVariant = row.type === "income"
    ? "income"
    : row.type === "expense"
      ? "expense"
      : row.type === "transfer"
        ? "transfer"
        : "neutral";

  return (
    <article className="rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-4">
      {showGroup ? (
        <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
          {row.groupLabel}
        </p>
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl border"
          style={{
            backgroundColor: visual.accentSoft,
            borderColor: `${visual.accent}33`,
            color: visual.accent,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="min-w-0">
              <p className="truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                {row.title}
              </p>
              <p className="truncate text-sm text-[var(--fm-text-soft)]">
                {row.subtitle}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 md:items-end">
              <Amount
                className="text-[28px]"
                masked={masked}
                showSign
                size="md"
                value={row.amount}
                variant={amountVariant}
              />
              <span className="text-xs text-[var(--fm-text-muted)]">
                {row.dateLabel}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-[var(--fm-text-muted)]">
              {row.metadata}
            </p>
            {actionSlot ? <div className="flex items-center gap-2">{actionSlot}</div> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
