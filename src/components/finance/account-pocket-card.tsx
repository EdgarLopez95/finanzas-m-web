"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Info, Plus, Repeat, Wallet } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { AccountIcon } from "@/components/finance/account-icon";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";
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
  /** Solo `accounts-page`: abre el detalle del bolsillo. Sin handler, los tiles quedan pasivos. */
  onPocketClick?: (pocket: Pocket) => void;
};

export function AccountPocketCard({
  account,
  pockets,
  masked = false,
  variant = "home",

  onCardClick,
  onAddPocketClick,
  onPocketClick,
}: AccountPocketCardProps) {
  const accentColor = account.color || "#60a5fa";

  const openCreate = useTransactionPanelStore((state) => state.openCreate);

  const isAccountsPage = variant === "accounts-page";

  // En la página de Cuentas los bolsillos son el desglose permanente de la
  // cuenta: se muestran siempre, sin plegar. El colapso sobrevive solo en la
  // variante `home`, donde la card es un resumen y el espacio es escaso.
  const [pocketsExpanded, setPocketsExpanded] = useState(false);
  const showPockets = pockets.length > 0 && (isAccountsPage || pocketsExpanded);



  // Paso 1 (cierre): nunca reconstruir Disponible restando bolsillos del Total.
  // `account.balance` YA es el Disponible crudo; el Total se deriva explícitamente aquí.
  const { availableBalance, totalBalance } = calculateAccountPhysicalBalances(account.balance, pockets);
  const freeBalance = availableBalance;

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
    /**
     * En `accounts-page` este <article> es la ÚNICA superficie de la cuenta: la
     * página ya no lo envuelve en otra card. Bolsillos y "Nuevo bolsillo" viven
     * dentro de ella como zonas separadas por divisores, no como cajas anidadas.
     */
    <article
      className={
        isAccountsPage
          ? "rounded-[var(--fm-radius-card-medium)] border border-white/8 bg-[rgba(18,25,39,0.96)] px-5 py-5 transition-colors hover:border-white/12 animate-in fade-in duration-200"
          : "rounded-[24px] border border-white/8 bg-[rgba(22,30,44,0.94)] px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.02)] animate-in fade-in duration-200"
      }
    >

      {/* ── Header: identidad + dinero a la izquierda · acciones a la derecha ── */}
      <div
        className={
          isAccountsPage
            ? "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            : "flex items-center justify-between gap-3"
        }
      >
        {/* Izquierda: icono + nombre + saldo */}
        <div className={isAccountsPage ? "flex min-w-0 flex-1 items-start gap-3.5" : "flex items-center gap-3 min-w-0 flex-1"}>
          <AccountIcon
            iconType={(account.iconType as "bank_logo" | "generic") || "generic"}
            iconKey={account.iconKey || "bank"}
            color={accentColor}
            size="md"
          />

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

            {/* Saldo — el Total manda; Disponible queda claramente subordinado. */}
            <div className={isAccountsPage ? "mt-1" : "mt-0.5"}>
              <Amount
                className={
                  isAccountsPage
                    ? "text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--fm-warm-paper)]"
                    : "text-base font-bold text-[var(--fm-warm-paper)]"
                }
                masked={masked}
                showSign={false}
                size="sm"
                value={totalBalance}
              />
              {/* Saldo disponible (fuera de bolsillos) — solo cuando hay bolsillos */}
              {/* `Amount` renderiza un <p>: su contenedor nunca puede serlo. */}
              {isAccountsPage && pockets.length > 0 ? (
                <div className="mt-1.5 flex items-baseline gap-1.5 text-xs text-[var(--fm-text-muted)]">
                  <span>Disponible</span>
                  <Amount
                    masked={masked}
                    showSign={false}
                    size="sm"
                    value={freeBalance}
                    className="text-xs font-medium text-[var(--fm-text-soft)]"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Derecha: acciones secundarias */}
        <div className={isAccountsPage ? "flex shrink-0 items-center gap-1.5 sm:pt-0.5" : "flex items-center gap-2 shrink-0"}>
          {/* Expandir/colapsar: solo en `home`. En Cuentas el desglose es fijo,
              y su conteo ya vive en la label "Bolsillos · N" de la grilla. */}
          {!isAccountsPage && pockets.length > 0 ? (
            <button
              type="button"
              onClick={handleTogglePockets}
              aria-expanded={pocketsExpanded}
              className="flex cursor-pointer select-none items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--fm-text-soft)] transition-all duration-150 hover:bg-white/5 hover:text-[var(--fm-warm-paper)] active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
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
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--fm-text-soft)] transition-all duration-150 hover:bg-white/5 hover:text-[var(--fm-warm-paper)] active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
              title="Ver detalle de cuenta"
            >
              <Info className="h-3.5 w-3.5" />
              <span>Ver detalle</span>
            </button>
          ) : null}

          {/*
            Acción rápida de MOVIMIENTO sobre esta cuenta. El chevron la separa
            del `+` de "Nuevo bolsillo" y "Nueva cuenta": abre un menú, no crea
            una entidad. Las opciones llegan con la cuenta ya preseleccionada.
          */}
          <FinanceDropdown
            items={plusItems}
            align="right"
            itemLayout="rich"
            menuClassName="w-[292px]"
            menuWidth={292}
            trigger={
              <button
                type="button"
                aria-haspopup="menu"
                aria-label={`Nuevo movimiento en ${account.name}`}
                className="flex cursor-pointer items-center gap-0.5 rounded-full border border-[var(--fm-pending)]/20 py-1 pl-2 pr-1.5 text-[var(--fm-pending)] transition-colors duration-150 hover:bg-[rgba(228,179,99,0.1)] active:bg-[rgba(228,179,99,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                title={`Nuevo movimiento en ${account.name}: gasto, ingreso o transferencia`}
              >
                <Plus className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            }
          />
        </div>
      </div>

      {/* ── Bolsillos ── */}
      {showPockets ? (
        isAccountsPage ? (
          /**
           * Compartimentos de la cuenta. Grilla de dos columnas que se reordena
           * sola: cuando la cantidad es impar el último tile toma el ancho
           * completo de la última fila, para que se lea como una decisión de
           * composición y no como un hueco de la grilla.
           */
          <div className="mt-4 border-t border-white/6 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-soft)]">
              <Wallet aria-hidden="true" className="h-4 w-4" />
              Bolsillos · {pockets.length}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {pockets.map((pocket, index) => {
                const dotColor = index % 2 === 0 ? accentColor : "var(--fm-pending)";
                const isOrphanLast = pockets.length % 2 === 1 && index === pockets.length - 1;
                const isInteractive = Boolean(onPocketClick);
                const TileTag = isInteractive ? "button" : "div";

                return (
                  <TileTag
                    key={pocket.id}
                    type={isInteractive ? "button" : undefined}
                    onClick={
                      isInteractive
                        ? (event: React.MouseEvent) => {
                            // La card no tiene handler propio, pero el tile vive
                            // dentro de ella: se corta la propagación por si en
                            // el futuro la superficie se vuelve clickeable.
                            event.stopPropagation();
                            onPocketClick?.(pocket);
                          }
                        : undefined
                    }
                    aria-label={isInteractive ? `Ver detalle del bolsillo ${pocket.name}` : undefined}
                    className={`min-w-0 rounded-[14px] bg-white/[0.03] px-3.5 py-3 text-left transition-all duration-200 ${
                      isInteractive
                        ? "cursor-pointer hover:bg-white/[0.055] active:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                        : ""
                    } ${
                      isOrphanLast
                        ? "sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:gap-4"
                        : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {/* Firma visual del bolsillo: el icono `pocket` del catálogo
                          (`account-icon.tsx`) tintado con su color, en lugar del dot. */}
                      <Wallet aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: dotColor }} />
                      <span className="truncate text-xs font-medium text-[var(--fm-text-muted)]">{pocket.name}</span>
                    </span>
                    <Amount
                      masked={masked}
                      showSign={false}
                      size="sm"
                      value={pocket.balance}
                      className={`block font-semibold text-[var(--fm-warm-paper)] ${
                        isOrphanLast ? "mt-1.5 text-base sm:mt-0" : "mt-1.5 text-base"
                      }`}
                    />
                  </TileTag>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-0.5 border-t border-white/6 pt-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {pockets.map((pocket, index) => (
              <div key={pocket.id} className="flex items-center justify-between gap-3 px-0.5 py-1.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: index % 2 === 0 ? accentColor : "var(--fm-pending)",
                    }}
                  />
                  <span className="truncate text-sm text-[var(--fm-text-soft)] flex items-center">
                    {pocket.name}
                  </span>
                </div>
                <Amount masked={masked} showSign={false} size="sm" value={pocket.balance} className="text-sm text-[var(--fm-text-soft)]" />
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ── Footer de acción "+ Nuevo bolsillo" — solo en accounts-page ── */}
      {isAccountsPage ? (
        <div className="mt-4 border-t border-white/6 pt-2">
          <button
            type="button"
            onClick={onAddPocketClick}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-1 py-2 text-xs font-semibold text-[var(--fm-pending)] transition-colors duration-150 hover:bg-white/[0.035] active:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo bolsillo
          </button>
        </div>
      ) : null}
    </article>
  );
}
