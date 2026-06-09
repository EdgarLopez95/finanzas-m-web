import { ChevronDown } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceChip } from "@/components/finance/finance-chip";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";

type AccountPocketCardProps = {
  account: Account;
  pockets: Pocket[];
  expanded?: boolean;
  masked?: boolean;
  compact?: boolean;
};

export function AccountPocketCard({
  account,
  pockets,
  expanded = false,
  masked = false,
  compact = false,
}: AccountPocketCardProps) {
  const visual = getAccountVisual(account);
  const Icon = visual.icon;
  const freeBalance = account.balance - pockets.reduce((sum, pocket) => sum + pocket.balance, 0);

  return (
    <article className="rounded-[24px] border border-white/8 bg-[rgba(22,30,44,0.94)] px-4 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.02)]">
      <div className="flex items-start gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl border"
          style={{
            backgroundColor: visual.accentSoft,
            borderColor: `${visual.accent}33`,
            color: visual.accent,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              {account.name}
            </h3>
            {pockets.length ? (
              <FinanceChip className="normal-case tracking-normal" variant="transfer">
                {pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}
              </FinanceChip>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-[var(--fm-text-soft)]">
            <span>Libre</span>
            <Amount
              className="text-sm font-medium text-[var(--fm-text-soft)]"
              masked={masked}
              showSign={false}
              size="sm"
              value={freeBalance}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <Amount
            className="text-[30px]"
            masked={masked}
            showSign={false}
            size={compact ? "md" : "lg"}
            value={account.balance}
          />
          {pockets.length ? (
            <ChevronDown className={`h-4 w-4 text-[var(--fm-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
          ) : null}
        </div>
      </div>

      {expanded && pockets.length ? (
        <div className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
          {pockets.map((pocket, index) => (
            <div key={pocket.id} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: index % 2 === 0 ? visual.accent : "var(--fm-pending)",
                  }}
                />
                <span className="truncate text-sm text-[var(--fm-text-soft)]">
                  {pocket.name}
                </span>
              </div>
              <Amount masked={masked} showSign={false} size="sm" value={pocket.balance} />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
