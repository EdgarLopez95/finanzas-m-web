"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Info, Plus, Repeat } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";

type AccountPocketCardProps = {
  account: Account;
  pockets: Pocket[];
  expanded?: boolean;
  masked?: boolean;
  compact?: boolean;
  variant?: "home" | "accounts-page";
  onCardClick?: () => void;
  onAddPocketClick?: () => void;
};

export function AccountPocketCard({
  account,
  pockets,
  masked = false,
  variant = "home",
  onCardClick,
  onAddPocketClick,
}: AccountPocketCardProps) {
  const visual = getAccountVisual(account);
  const Icon = visual.icon;

  const openCreate = useTransactionPanelStore((state) => state.openCreate);

  const isAccountsPage = variant === "accounts-page";

  // Bolsillos siempre colapsados por defecto; el usuario los despliega si quiere
  const [pocketsExpanded, setPocketsExpanded] = useState(false);
  const showPockets = pocketsExpanded && pockets.length > 0;

  // Saldo fuera de bolsillos
  const pocketsTotal = pockets.reduce((sum, p) => sum + p.balance, 0);
  const freeBalance = account.balance - pocketsTotal;

  const handleTogglePockets = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setPocketsExpanded((prev) => !prev);
  };

  const plusItems = [
    {
      label: "Nuevo gasto",
      description: "Registrar una salida de dinero",
      icon: <ArrowDownLeft className="h-4.5 w-4.5 text-[var(--fm-expense)]" />,
      onClick: () => openCreate("expense", account.id),
    },
    {
      label: "Nuevo ingreso",
      description: "Registrar una entrada personal",
      icon: <ArrowUpRight className="h-4.5 w-4.5 text-[var(--fm-income)]" />,
      onClick: () => openCreate("income", account.id),
    },
    {
      label: "Nueva transferencia",
      description: "Mover dinero entre cuentas o bolsillos",
      icon: <Repeat className="h-4.5 w-4.5 text-[var(--fm-transfer)]" />,
      onClick: () => openCreate("transfer", account.id),
    },
  ];

  return (
    <article className="rounded-[24px] border border-white/8 bg-[rgba(22,30,44,0.94)] px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.02)] animate-in fade-in duration-200">

      {/* ── Header: icono · info cuenta · acciones ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Izquierda: icono + nombre + saldo */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border"
            style={{
              backgroundColor: visual.accentSoft,
              borderColor: `${visual.accent}22`,
              color: visual.accent,
            }}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-[var(--font-display)] text-base font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                {account.name}
              </h3>
              {!isAccountsPage && pockets.length ? (
                <FinanceChip className="normal-case tracking-normal px-2 py-0.5 text-[10px]" variant="transfer">
                  {pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}
                </FinanceChip>
              ) : null}
            </div>

            {/* Saldo */}
            <div className="mt-0.5">
              <Amount
                className={isAccountsPage ? "text-2xl font-bold text-[var(--fm-warm-paper)] leading-tight" : "text-base font-bold text-[var(--fm-warm-paper)]"}
                masked={masked}
                showSign={false}
                size="sm"
                value={account.balance}
              />
              {/* Saldo libre (fuera de bolsillos) — solo cuando hay bolsillos */}
              {isAccountsPage && pockets.length > 0 ? (
                <div className="mt-0.5 flex items-baseline gap-1 text-[11px] text-[var(--fm-text-muted)]">
                  <span>Libre:</span>
                  <Amount masked={masked} showSign={false} size="sm" value={freeBalance} className="text-[11px] text-[var(--fm-text-soft)]" />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botón expandir/colapsar bolsillos — visible solo si hay bolsillos */}
          {pockets.length > 0 ? (
            <button
              type="button"
              onClick={handleTogglePockets}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] hover:bg-white/5 transition-all cursor-pointer select-none"
              title={pocketsExpanded ? "Ocultar bolsillos" : "Ver bolsillos"}
            >
              <span>{pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${pocketsExpanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}

          {/* Botón "Ver detalle" — solo en accounts-page */}
          {isAccountsPage ? (
            <button
              type="button"
              onClick={onCardClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] hover:bg-white/5 transition-all cursor-pointer"
              title="Ver detalle de cuenta"
            >
              <Info className="h-3.5 w-3.5" />
              <span>Ver detalle</span>
            </button>
          ) : null}

          {/* Botón + acceso rápido */}
          <FinanceDropdown
            items={plusItems}
            align="right"
            itemLayout="rich"
            menuClassName="w-[292px]"
            menuWidth={292}
            trigger={
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--fm-pending)]/20 text-[var(--fm-pending)] hover:bg-[rgba(228,179,99,0.1)] transition-colors focus:outline-none cursor-pointer"
                title="Acceso directo a nuevo movimiento"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            }
          />
        </div>
      </div>

      {/* ── Lista de bolsillos (colapsable) ── */}
      {showPockets ? (
        <div className="mt-3 space-y-1 border-t border-white/8 pt-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {pockets.map((pocket, index) => (
            <div key={pocket.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
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

      {/* ── Botón "+ Nuevo bolsillo" — solo en accounts-page ── */}
      {isAccountsPage ? (
        <div className="mt-3 border-t border-white/8 pt-2.5">
          <button
            type="button"
            onClick={onAddPocketClick}
            className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--fm-pending)] hover:text-[var(--fm-pending)]/80 hover:bg-white/5 rounded-xl border border-dashed border-[var(--fm-pending)]/20 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo bolsillo
          </button>
        </div>
      ) : null}
    </article>
  );
}
