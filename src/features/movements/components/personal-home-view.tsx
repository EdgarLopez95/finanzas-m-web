"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, EyeOff, GripVertical, Plus } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { PersonalRecentMovementRow } from "@/components/finance/personal-transaction-row";
import { groupRowsByDay } from "@/features/movements/lib/personal-month-view-model";
import { useMplusPersonal } from "@/features/movements/hooks/use-mplus-personal";
import { formatPeriodLabel } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export const SectionLink = ({
  href,
  label = "Ver todo",
}: {
  href: string;
  label?: string;
}) => {
  const router = useRouter();

  return (
    <FinanceButton
      className="text-[var(--fm-text-soft)]"
      onClick={() => router.push(href)}
      size="sm"
      tone="text"
      type="button"
      variant="ghost"
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </FinanceButton>
  );
};

export const MonthlyMetricPanel = ({
  amount,
  icon: Icon,
  label,
  masked,
  tone,
  progressValue,
}: {
  amount: number;
  icon: typeof ArrowUpRight;
  label: string;
  masked: boolean;
  tone: "expense" | "income";
  progressValue: number;
}) => {
  const isIncome = tone === "income";
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border",
            isIncome
              ? "border-[rgba(74,222,128,0.15)] bg-[rgba(74,222,128,0.08)] text-[var(--fm-income)]"
              : "border-[rgba(248,113,113,0.15)] bg-[rgba(248,113,113,0.08)] text-[var(--fm-expense)]"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fm-text-muted)]">{label}</p>
            <span className="text-xs font-bold text-[var(--fm-text-muted)]">{progressValue}%</span>
          </div>
          <Amount
            className="mt-0.5 font-bold tracking-tight text-3xl leading-none"
            masked={masked}
            showSign={false}
            size="lg"
            value={amount}
            variant={tone}
          />
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-[rgba(37,48,71,0.6)]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isIncome ? "bg-[var(--fm-income)]" : "bg-[var(--fm-expense)]"
          )}
          style={{ width: `${progressValue}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Inicio Personal del contrato v1 (matriz W2).
 *
 * Conserva la composicion de la Web base: la misma card hero a dos columnas,
 * el mismo tablero de cards reordenables con arrastre y ocultado, y los mismos
 * componentes (`FinanceCard`, `Amount`, `CategoryBreakdownList`, `EmptyState`).
 *
 * Cambia SOLO el contenido, y solo donde el producto cambio:
 *
 * - la columna izquierda del hero pasa de "Dinero propio / Saldo real" a la
 *   diferencia del mes, que es la cifra que M+ pone al frente;
 * - se retiran saldo bancario bruto, dinero no propio y su panel de
 *   distribucion, "Te deben", "Por anotar" y los bolsillos;
 * - la card de categorias gana una vista secundaria de ingresos (matriz W2);
 * - la card de cuentas las muestra como etiquetas, sin saldo.
 *
 * La columna derecha del hero (ingresos, gastos y su resultado) ya era
 * exactamente el juego de KPIs de M+: no se toca.
 */

/** Tarjetas del tablero. "household" (Por anotar) se retiro con los eventos. */
const MPLUS_BOARD_CARDS = ["categories", "movements", "accounts"] as const;
type MplusBoardCardId = (typeof MPLUS_BOARD_CARDS)[number];

const CARD_TITLES: Record<MplusBoardCardId, string> = {
  categories: "Gastos por categoria",
  movements: "Movimientos recientes",
  accounts: "Cuentas",
};

export function MplusHomeView({ masked }: { masked: boolean }) {
  const { kpis, expenseBreakdown, incomeBreakdown, rows, status, error, isLoading } =
    useMplusPersonal();
  const accounts = useMplusPersonalStore((state) => state.accounts);
  const refresh = useMplusPersonalStore((state) => state.refresh);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const isEditingBoard = useUiPreferencesStore((state) => state.isEditingBoard);
  const boardOrder = useUiPreferencesStore((state) => state.boardOrder);
  const hiddenCards = useUiPreferencesStore((state) => state.hiddenCards);
  const setBoardOrder = useUiPreferencesStore((state) => state.setBoardOrder);
  const hideCard = useUiPreferencesStore((state) => state.hideCard);
  const showCard = useUiPreferencesStore((state) => state.showCard);

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  /** Vista secundaria del desglose: gasto (principal) o ingreso. */
  const [breakdownMode, setBreakdownMode] = useState<"expense" | "income">("expense");

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.state === "active"),
    [accounts],
  );

  const groupedRecentRows = useMemo(() => groupRowsByDay(rows.slice(0, 5)), [rows]);

  // El orden persistido puede traer tarjetas ya retiradas (p. ej. "household"):
  // se filtran, y las nuevas que falten se añaden al final.
  const orderedCards = useMemo(() => {
    const known = boardOrder.filter((id): id is MplusBoardCardId =>
      (MPLUS_BOARD_CARDS as readonly string[]).includes(id),
    );
    const missing = MPLUS_BOARD_CARDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [boardOrder]);

  const visibleCards = orderedCards.filter((cardId) => !hiddenCards.includes(cardId));
  const hiddenKnownCards = hiddenCards.filter((id): id is MplusBoardCardId =>
    (MPLUS_BOARD_CARDS as readonly string[]).includes(id),
  );

  const handleDragStart = (event: React.DragEvent, cardId: string) => {
    event.dataTransfer.setData("text/plain", cardId);
    setDraggedCardId(cardId);
  };

  const handleDrop = (event: React.DragEvent, targetCardId: string) => {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text/plain");
    if (cardId === targetCardId) return;

    const newOrder = [...orderedCards];
    const sourceIndex = newOrder.indexOf(cardId as MplusBoardCardId);
    const targetIndex = newOrder.indexOf(targetCardId as MplusBoardCardId);
    if (sourceIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, cardId as MplusBoardCardId);
      setBoardOrder(newOrder);
    }
    setDraggedCardId(null);
  };

  const cardHeaderRight = (cardId: MplusBoardCardId, href: string) =>
    isEditingBoard ? (
      <div className="flex items-center gap-1.5">
        <div
          className="p-1.5 cursor-grab text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] active:cursor-grabbing transition-colors"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <button
          onClick={() => hideCard(cardId)}
          className="p-1.5 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] hover:bg-white/5 transition-all cursor-pointer"
          title="Ocultar del tablero"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <SectionLink href={href} />
    );

  const cardClassName = cn(
    "border-white/8 bg-[rgba(18,25,39,0.96)] h-full transition-all",
    isEditingBoard &&
      "border-dashed border-[var(--fm-pending)]/40 hover:border-[var(--fm-pending)]/80",
  );

  if (status === "error") {
    return (
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div role="alert" className="space-y-4">
          <EmptyState
            title="No pudimos cargar tu mes"
            description={error ?? "Revisa tu conexion e intenta de nuevo."}
          />
          <div className="flex justify-center">
            <FinanceButton type="button" size="sm" onClick={() => void refresh()}>
              Reintentar
            </FinanceButton>
          </div>
        </div>
      </FinanceCard>
    );
  }

  const { income, expense, difference } = kpis;
  let incomeProgress = 100;
  let expenseProgress = 0;
  if (income === 0 && expense === 0) {
    incomeProgress = 0;
    expenseProgress = 0;
  } else if (income >= expense) {
    incomeProgress = 100;
    expenseProgress = income > 0 ? Math.round((expense / income) * 100) : 0;
  } else {
    expenseProgress = 100;
    incomeProgress = expense > 0 ? Math.round((income / expense) * 100) : 0;
  }

  const breakdownItems = breakdownMode === "expense" ? expenseBreakdown : incomeBreakdown;

  const renderCardContent = (cardId: MplusBoardCardId) => {
    switch (cardId) {
      case "categories":
        return (
          <FinanceCard
            className={cardClassName}
            headerRight={cardHeaderRight("categories", "/categories")}
            subtitle={`${breakdownMode === "expense" ? "Total gastado" : "Total recibido"} en ${formatPeriodLabel(selectedPeriod)}`}
            title={breakdownMode === "expense" ? "Gastos por categoria" : "Ingresos por categoria"}
            variant="default"
          >
            {/* Vista secundaria del desglose (matriz W2), con el mismo control
                de segmentos que ya usa el resto de la Web. */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["expense", "Gastos"],
                  ["income", "Ingresos"],
                ] as const
              ).map(([value, label]) => {
                const active = breakdownMode === value;
                return (
                  <FinanceButton
                    key={value}
                    className={
                      active
                        ? "h-8 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]"
                        : "h-8 text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                    }
                    onClick={() => setBreakdownMode(value)}
                    size="sm"
                    tone={active ? "filled" : "text"}
                    type="button"
                    variant={active ? "default" : "ghost"}
                  >
                    {label}
                  </FinanceButton>
                );
              })}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <FinanceShimmer className="h-10 w-full" />
                <FinanceShimmer className="h-10 w-full" />
              </div>
            ) : !breakdownItems.length ? (
              <EmptyState
                title={breakdownMode === "expense" ? "Sin gastos del mes" : "Sin ingresos del mes"}
                description={`Aun no hay ${breakdownMode === "expense" ? "gastos" : "ingresos"} del mes para agrupar por categoria.`}
              />
            ) : (
              <CategoryBreakdownList
                items={breakdownItems.slice(0, 5).map((item) => ({
                  categoryId: item.categoryId,
                  name: item.name,
                  icon: item.iconKey,
                  iconKey: item.iconKey,
                  amount: item.amount,
                  share: item.share,
                  color: item.color,
                }))}
                masked={masked}
                type={breakdownMode}
              />
            )}
          </FinanceCard>
        );

      case "movements":
        return (
          <FinanceCard
            className={cardClassName}
            headerRight={cardHeaderRight("movements", "/movements")}
            subtitle="Ultimos movimientos personales"
            title="Movimientos recientes"
            variant="default"
          >
            {isLoading ? (
              <div className="space-y-3">
                <FinanceShimmer className="h-10 w-full" />
                <FinanceShimmer className="h-10 w-full" />
              </div>
            ) : !rows.length ? (
              <EmptyState
                title="Sin movimientos"
                description="Aun no registraste movimientos en este mes."
              />
            ) : (
              <div className="space-y-4">
                {groupedRecentRows.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                      {group.label}
                    </p>
                    <div className="divide-y divide-white/8">
                      {group.rows.map((row) => (
                        <div key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                          <PersonalRecentMovementRow masked={masked} row={row} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FinanceCard>
        );

      case "accounts":
        return (
          <FinanceCard
            className={cardClassName}
            headerRight={cardHeaderRight("accounts", "/accounts")}
            subtitle={
              activeAccounts.length === 1
                ? "1 cuenta activa"
                : `${activeAccounts.length} cuentas activas`
            }
            title="Cuentas"
            variant="default"
          >
            {!activeAccounts.length ? (
              <EmptyState
                title="Sin cuentas"
                description="Las cuentas son etiquetas opcionales para recordar de donde salio el dinero."
              />
            ) : (
              <div className="divide-y divide-white/8">
                {activeAccounts.slice(0, 4).map((account) => (
                  <div key={account.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                      style={{
                        backgroundColor: `${account.color}22`,
                        borderColor: `${account.color}22`,
                        color: account.color,
                      }}
                    >
                      <AccountIcon
                        iconType={account.iconType}
                        iconKey={account.iconKey}
                        color={account.color}
                        size="xs"
                      />
                    </div>
                    <p className="min-w-0 flex-1 truncate font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                      {account.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FinanceCard>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <section>
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)]"
          variant="hero"
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.38fr)_minmax(20rem,0.92fr)]">
            <div className="flex min-h-[220px] flex-col justify-between pr-0 lg:pr-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-[var(--font-display)] text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                    Diferencia del mes
                  </p>
                  <FinanceChip
                    className="min-h-0 bg-[rgba(228,179,99,0.14)] px-3 py-1 text-[11px] text-[var(--fm-pending)] uppercase tracking-[0.12em]"
                    variant="pending"
                  >
                    {formatPeriodLabel(selectedPeriod)}
                  </FinanceChip>
                </div>

                <div className="pb-2">
                  <Amount
                    masked={masked}
                    showSign
                    size="display"
                    value={difference}
                    variant={difference >= 0 ? "income" : "expense"}
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-2 text-[13px] leading-[1.45] text-[var(--fm-text-muted)]">
                  <span className="mt-[0.42rem] h-1.5 w-1.5 flex-none rounded-full bg-[var(--fm-pending)]" />
                  <p className="lg:whitespace-nowrap">
                    Es lo que te quedo este mes: tus ingresos menos tus gastos.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-white/8 pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 flex flex-col justify-between min-h-[220px] h-full">
              <div className="flex-1 flex flex-col justify-center py-2">
                <MonthlyMetricPanel
                  amount={income}
                  icon={ArrowUpRight}
                  label="Ingresos del mes"
                  masked={masked}
                  tone="income"
                  progressValue={incomeProgress}
                />
              </div>

              <div className="border-t border-white/8" />

              <div className="flex-1 flex flex-col justify-center py-2">
                <MonthlyMetricPanel
                  amount={expense}
                  icon={ArrowDownLeft}
                  label="Gastos del mes"
                  masked={masked}
                  tone="expense"
                  progressValue={expenseProgress}
                />
              </div>

              <div className="border-t border-white/8 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--fm-text-muted)]">Quedo libre</span>
                  <Amount
                    masked={masked}
                    showSign
                    size="sm"
                    value={difference}
                    variant={difference >= 0 ? "income" : "expense"}
                    className="text-base font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </FinanceCard>
      </section>

      {isEditingBoard && (
        <div className="flex flex-col gap-3 rounded-[24px] border border-[rgba(228,179,99,0.22)] bg-[rgba(228,179,99,0.04)] px-5 py-4 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[var(--fm-text-soft)]">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[var(--fm-pending)] animate-pulse" />
              <p>
                <strong>Personaliza tu Inicio:</strong> Arrastra para reordenar · oculta lo que no uses.
              </p>
            </div>
            <button
              onClick={() => useUiPreferencesStore.getState().resetBoard()}
              className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] underline cursor-pointer transition-colors"
            >
              Restablecer valores por defecto
            </button>
          </div>
          {hiddenKnownCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-xs text-[var(--fm-text-muted)]">
              <span>Ocultas:</span>
              <div className="flex flex-wrap gap-1.5">
                {hiddenKnownCards.map((cardId) => (
                  <button
                    key={cardId}
                    onClick={() => showCard(cardId)}
                    className="flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-3 py-1 font-semibold text-[var(--fm-text-soft)] hover:bg-white/10 hover:text-[var(--fm-warm-paper)] transition-all cursor-pointer text-xs"
                  >
                    + {CARD_TITLES[cardId]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        {visibleCards.map((cardId) => (
          <div
            key={cardId}
            draggable={isEditingBoard}
            onDragStart={(event) => handleDragStart(event, cardId)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, cardId)}
            onDragEnd={() => setDraggedCardId(null)}
            className={cn(
              "transition-all duration-200",
              isEditingBoard && "hover:scale-[1.005]",
              draggedCardId === cardId && "opacity-40 scale-[0.98]",
            )}
          >
            {renderCardContent(cardId)}
          </div>
        ))}

        {isEditingBoard && hiddenKnownCards.length > 0 && (
          <div
            onClick={() => showCard(hiddenKnownCards[0])}
            className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 hover:border-[var(--fm-pending)]/40 bg-white/[0.01] hover:bg-[rgba(228,179,99,0.02)] rounded-[var(--fm-radius-card-large)] transition-all cursor-pointer group/add select-none min-h-[120px]"
          >
            <Plus className="h-5 w-5 text-[var(--fm-text-muted)] group-hover/add:text-[var(--fm-pending)] transition-colors mb-1.5" />
            <span className="text-sm font-semibold text-[var(--fm-text-muted)] group-hover/add:text-[var(--fm-pending)] transition-colors">
              Agregar tarjeta al tablero
            </span>
            <span className="text-xs text-[var(--fm-text-muted)]/50 mt-1">
              (Haz clic para mostrar {CARD_TITLES[hiddenKnownCards[0]]})
            </span>
          </div>
        )}
      </section>
    </>
  );
}
