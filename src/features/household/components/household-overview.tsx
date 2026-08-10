"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdTimelineItem } from "@/features/household/components/ui/household-timeline-item";
import { HouseholdEventDetailDialog } from "@/features/household/components/household-event-detail-dialog";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { useRouter } from "next/navigation";
import { useGenerateInviteCode } from "@/features/household/hooks/use-generate-invite-code";
import { getInviteCodeExpiryLabel, isInviteCodeExpired } from "@/features/household/lib/invite-code-expiry";
import { formatDateEs } from "@/lib/format/date";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { DEFAULT_HOUSEHOLD_CATEGORY_COLOR } from "@/lib/categories/household-category-colors";
import type { CategoryBreakdownItem } from "@/features/household/hooks/use-household-data";
import type { HouseholdCategory, HouseholdDebt, HouseholdEvent, HouseholdEventShare, HouseholdIncomeEntry, HouseholdMemberProfile } from "@/types/household";

type HouseholdOverviewProps = {
  periodLabel: string;
  currentUid: string | null;
  memberProfiles: Record<string, HouseholdMemberProfile>;
  monthlyExpenseTotal: number;
  monthlyIncomeTotal: number;
  categories: HouseholdCategory[];
  categoryBreakdown: CategoryBreakdownItem[];
  allDebts: HouseholdDebt[];
  allEventShares: HouseholdEventShare[];
  allEvents: HouseholdEvent[];
  recentIncomeEntries: HouseholdIncomeEntry[];
  householdId: string;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: Date | null;
  memberIds: string[];
};

const buildEventTitle = (event: HouseholdEvent, categoryName?: string): string => {
  if (event.title.trim().length > 0) return event.title;
  return categoryName ? `Gasto · ${categoryName}` : "Gasto del hogar";
};

const HouseholdMonthCompareSide = ({
  amount,
  barPercent,
  icon: Icon,
  label,
  tone,
}: {
  amount: number;
  barPercent: number;
  icon: React.ElementType;
  label: string;
  tone: "expense" | "income";
}) => {
  const isIncome = tone === "income";
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border",
            isIncome
              ? "border-[var(--hh-primary-action)]/20 bg-[var(--hh-primary-action)]/12 text-[var(--hh-primary-action)]"
              : "border-[var(--hh-destructive-border)]/25 bg-[var(--hh-destructive-border)]/12 text-[var(--hh-destructive-content)]"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="text-[13px] font-medium tracking-tight text-[var(--hh-text-secondary)]">{label}</p>
      </div>

      <HouseholdAmount
        className="font-[var(--font-display)] font-semibold tracking-[-0.03em] text-[2rem] leading-none sm:text-[2.25rem]"
        size="lg"
        value={amount}
        variant={tone}
      />

      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--hh-border-soft)]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            isIncome ? "bg-[var(--hh-primary-action)]" : "bg-[var(--hh-destructive-border)]"
          )}
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  );
};


export function HouseholdOverview({
  periodLabel,
  currentUid,
  memberProfiles,
  allDebts,
  allEventShares,
  monthlyExpenseTotal,
  monthlyIncomeTotal,
  categories,
  categoryBreakdown,
  allEvents,
  recentIncomeEntries,
  householdId,
  inviteCode = null,
  inviteCodeExpiresAt = null,
  memberIds = [],
}: HouseholdOverviewProps) {
  const categoryNames = new Map(categories.map((cat) => [cat.id, cat.name]));
  const [selectedEvent, setSelectedEvent] = useState<HouseholdEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBreakdownItem | null>(null);
  const router = useRouter();

  const recentMovements = [...allEvents.map(e => ({ type: 'event' as const, data: e, date: (e.eventDate ?? e.createdAt)! })), ...recentIncomeEntries.map(i => ({ type: 'income' as const, data: i, date: (i.entryDate ?? i.createdAt)! }))]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const { submit: generateCodeSubmit, isSubmitting: isGenerating, error: generateError, resetError: resetGenerateError } = useGenerateInviteCode();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Fallo al copiar código", err);
    }
  };

  const handleGenerateCode = async () => {
    if (!householdId || !currentUid) return;
    resetGenerateError();
    await generateCodeSubmit({ householdId, uid: currentUid });
  };

  const isCodeExpired = isInviteCodeExpired(inviteCodeExpiresAt);
  const getExpiryLabel = getInviteCodeExpiryLabel;

  return (
    <div className="space-y-6">

      {/* ── Hero del mes: comparación Entró vs Se gastó (no es card del tablero) ── */}
      <section aria-label={`Entradas y gastos del hogar en ${periodLabel}`}>
        {(() => {
          const ingresos = monthlyIncomeTotal;
          const gastos = monthlyExpenseTotal;
          const scale = Math.max(ingresos, gastos, 0);
          const incomeBar = scale === 0 ? 0 : Math.round((ingresos / scale) * 100);
          const expenseBar = scale === 0 ? 0 : Math.round((gastos / scale) * 100);
          const spentOfIncomePct =
            ingresos > 0 ? Math.min(100, Math.round((gastos / ingresos) * 100)) : gastos > 0 ? 100 : 0;
          const compareHint =
            ingresos === 0 && gastos === 0
              ? "Todavía no hay entradas ni gastos compartidos este mes."
              : ingresos === 0
                ? "Hay gastos del hogar sin entradas registradas este mes."
                : gastos === 0
                  ? "Entró dinero al hogar y aún no hay gastos activos este mes."
                  : `Se gastó el ${Math.round((gastos / ingresos) * 100)}% de lo que entró.`;

          return (
            <HouseholdCard
              className="rounded-[24px] border-[var(--hh-primary-action)]/18 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--hh-primary-action)_10%,var(--hh-surface-elevated)),var(--hh-surface)_55%,color-mix(in_srgb,var(--hh-destructive-border)_8%,var(--hh-surface)))] shadow-[var(--hh-shadow-hero)] [&>div]:p-4 sm:[&>div]:px-5 sm:[&>div]:py-4"
              variant="hero"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--hh-primary-action)]">
                    {periodLabel}
                  </p>
                  <p className="text-[13px] leading-snug text-[var(--hh-text-secondary)]">
                    Lo que entró de ambos frente a lo que se gastó del hogar.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-0">
                  <HouseholdMonthCompareSide
                    amount={ingresos}
                    barPercent={incomeBar}
                    icon={ArrowUpRight}
                    label="Entró al Hogar"
                    tone="income"
                  />
                  <div className="border-t border-[var(--hh-border-soft)] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 lg:pl-8">
                    <HouseholdMonthCompareSide
                      amount={gastos}
                      barPercent={expenseBar}
                      icon={ArrowDownLeft}
                      label="Se gastó del Hogar"
                      tone="expense"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-[var(--hh-border-soft)] pt-3 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    aria-hidden
                    className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--hh-primary-action)_22%,var(--hh-border-soft))] sm:max-w-xs sm:flex-none"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--hh-destructive-border)] transition-[width] duration-500 ease-out"
                      style={{ width: `${spentOfIncomePct}%` }}
                    />
                  </div>
                  <p className="min-w-0 text-[12px] leading-snug text-[var(--hh-text-muted)]">{compareHint}</p>
                </div>
              </div>
            </HouseholdCard>
          );
        })()}
      </section>

      {/* ── Invitación al Hogar (solo cuando hay menos de 2 miembros) ── */}
      {memberIds.length < 2 && (
        <section>
          <HouseholdCard
            title="Invitación al Hogar"
            subtitle="Comparte este código con tu familiar para que se una"
            variant="elevated"
          >
            <div className="flex flex-col space-y-4">
              {inviteCode && !isCodeExpired ? (
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between rounded-[20px] border border-[var(--hh-border)] bg-[var(--hh-surface)] p-3">
                    <div className="min-w-0">
                      <span className="text-xs text-[var(--hh-text-secondary)] uppercase tracking-wider block font-semibold">
                        Código activo
                      </span>
                      <span className="font-mono text-2xl font-bold text-[var(--hh-primary-action)] tracking-wider select-all">
                        {inviteCode}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[var(--hh-primary-action)] bg-[color-mix(in_oklch,var(--hh-primary-action),transparent_90%)] px-2.5 py-1 rounded-full">
                      {getExpiryLabel(inviteCodeExpiresAt)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <HouseholdButton
                      type="button"
                      tone="filled"
                      onClick={handleCopy}
                      className="flex-1 bg-[var(--hh-primary-action)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] min-h-10 cursor-pointer rounded-[14px]"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar código
                        </>
                      )}
                    </HouseholdButton>

                    <HouseholdButton
                      type="button"
                      tone="outlined"
                      variant="outline"
                      onClick={handleGenerateCode}
                      disabled={isGenerating}
                      className="min-h-10 px-3 cursor-pointer rounded-[14px] border-[var(--hh-border)]"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerar
                        </>
                      )}
                    </HouseholdButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-3 py-2">
                  <p className="text-sm text-[var(--hh-text-muted)] text-center">
                    No hay un código de invitación activo o el anterior ya expiró.
                  </p>
                  <HouseholdButton
                    type="button"
                    tone="filled"
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="w-full bg-[var(--hh-border-strong)] hover:bg-[color-mix(in_oklch,var(--hh-border-strong),white_8%)] min-h-11 cursor-pointer rounded-[14px]"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      "Generar código de invitación"
                    )}
                  </HouseholdButton>
                </div>
              )}

              {generateError && (
                <p className="text-xs text-[var(--hh-destructive-content)] text-center font-medium mt-1">
                  {generateError}
                </p>
              )}
            </div>
          </HouseholdCard>
        </section>
      )}

      {/* ── Tablero fijo: categorías | movimientos ── */}
      <section className="grid items-stretch gap-4 lg:grid-cols-2">
        <HouseholdCard
          title="Gastos por categoría"
          subtitle={`Desglose de eventos del Hogar · ${periodLabel}`}
          variant="default"
          className="h-full min-w-0"
          headerRight={
            <HouseholdButton
              type="button"
              tone="outlined"
              variant="outline"
              size="sm"
              onClick={() => router.push("/household/categories")}
              className="flex items-center gap-1 text-xs font-semibold py-0 cursor-pointer h-8 px-3 border-[var(--hh-primary-action)]/20 text-[var(--hh-primary-action)] hover:bg-[var(--hh-primary-action)]/10"
            >
              Ver todas
              <ChevronRight className="h-3 w-3" />
            </HouseholdButton>
          }
        >
          {categoryBreakdown.length ? (
            <div className="flex flex-col divide-y divide-[var(--hh-border)]/[0.08] -mx-2">
              {(() => {
                const categoryBreakdownTotal = categoryBreakdown.reduce((sum, i) => sum + i.total, 0);
                return categoryBreakdown.map((item) => {
                  const Icon = resolveCategoryIcon(item.iconKey, "expense");
                  const color = item.color || DEFAULT_HOUSEHOLD_CATEGORY_COLOR;
                  const share =
                    categoryBreakdownTotal > 0 ? Math.round((item.total / categoryBreakdownTotal) * 100) : 0;
                  return (
                    <article
                      key={item.categoryId}
                      className="flex flex-col gap-2.5 rounded-xl px-2 py-4 first:pt-0 last:pb-0 cursor-pointer transition-colors hover:bg-[var(--hh-surface-elevated)]"
                      onClick={() => setSelectedCategory(item)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface)] text-[var(--hh-text)]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-sm font-medium text-[var(--hh-text)]">{item.name}</p>
                            <span className="shrink-0 text-xs font-medium text-[var(--hh-text-muted)]">
                              {share}%
                            </span>
                          </div>
                          <p className="text-xs text-[var(--hh-text-secondary)]">
                            {item.count} evento{item.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <HouseholdAmount value={item.total} variant="expense" size="sm" className="shrink-0" />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--hh-border)]/[0.08]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${share}%`, backgroundColor: color }}
                        />
                      </div>
                    </article>
                  );
                });
              })()}
            </div>
          ) : (
            <HouseholdEmptyState
              title="Sin gastos este período"
              description={`No hay eventos activos del Hogar en ${periodLabel}.`}
            />
          )}
        </HouseholdCard>

        <HouseholdCard
          title="Movimientos del hogar"
          subtitle="Últimos movimientos del Hogar · toca para ver detalle"
          variant="elevated"
          className="h-full min-w-0"
          headerRight={
            <HouseholdButton
              type="button"
              tone="outlined"
              variant="outline"
              size="sm"
              onClick={() => router.push("/household/movements")}
              className="flex items-center gap-1 text-xs font-semibold py-0 cursor-pointer h-8 px-3 border-[var(--hh-primary-action)]/20 text-[var(--hh-primary-action)] hover:bg-[var(--hh-primary-action)]/10"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </HouseholdButton>
          }
        >
          {recentMovements.length ? (
            <div className="space-y-2">
              {recentMovements.map((movement) => {
                if (movement.type === "event") {
                  const event = movement.data;
                  const categoryName = categoryNames.get(event.categoryId);
                  const isEventCancelled = event.status === "cancelled" || event.status === "cancelado";
                  const extraIndicator: React.ReactNode = isEventCancelled ? (
                    <HouseholdChip variant="neutral" className="h-5 min-h-5 py-0 px-2 text-[10px]">
                      Cancelado
                    </HouseholdChip>
                  ) : null;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="w-full text-left cursor-pointer rounded-[20px] transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-primary-action)]"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <HouseholdTimelineItem
                        title={buildEventTitle(event, categoryName)}
                        subtitle={event.notes || categoryName || "Evento del hogar"}
                        amount={event.amount}
                        type="expense"
                        dateLabel={
                          (event.eventDate ?? event.createdAt)
                            ? formatDateEs((event.eventDate ?? event.createdAt)!)
                            : "Sin fecha"
                        }
                        metadata={categoryName || "Sin categoría"}
                        extraIndicator={extraIndicator}
                      />
                    </button>
                  );
                }

                const entry = movement.data;
                return (
                  <div key={entry.id} className="w-full text-left rounded-[20px] px-0 py-0">
                    <HouseholdTimelineItem
                      title={entry.visibleDescription || "Ingreso compartido"}
                      subtitle="Ingreso del hogar"
                      amount={entry.amount}
                      type="income"
                      dateLabel={
                        (entry.entryDate ?? entry.createdAt)
                          ? formatDateEs((entry.entryDate ?? entry.createdAt)!)
                          : "Sin fecha"
                      }
                      metadata="Ingreso"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <HouseholdEmptyState title="Sin movimientos recientes" description="Todavía no hay movimientos visibles para este Hogar." />
          )}
        </HouseholdCard>
      </section>

      <HouseholdEventDetailDialog
        open={selectedEvent !== null}
        event={selectedEvent}
        categories={categories}
        eventShares={allEventShares}
        debts={allDebts}
        currentUid={currentUid}
        memberProfiles={memberProfiles}
        onClose={() => setSelectedEvent(null)}
      />

      <HouseholdDialog
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory?.name ?? ""}
        subtitle="Detalle del período"
      >
        <div className="space-y-4">
          <div className="rounded-[16px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface)] p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-[var(--hh-text-secondary)]">Total gastos</span>
              <HouseholdAmount value={selectedCategory?.total ?? 0} variant="expense" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-[var(--hh-text-secondary)]">Eventos activos</span>
              <span className="text-sm text-[var(--hh-text)] font-semibold">{selectedCategory?.count ?? 0}</span>
            </div>
          </div>
        </div>
      </HouseholdDialog>

    </div>
  );
}
