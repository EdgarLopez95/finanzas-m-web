"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Edit3,
  MoreVertical,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { AccountIcon } from "@/components/finance/account-icon";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { PersonalTransactionRow } from "@/components/finance/personal-transaction-row";
import { EditAccountDialog, EditPocketDialog, groupRowsByDateLabel } from "@/features/dashboard/components/personal-views";
import { useDeletePersonalEntities } from "@/features/accounts/hooks/use-delete-personal-entities";
import { useAccountLifecycle } from "@/features/accounts/hooks/use-account-lifecycle";
import { resolveAccountActionAvailability } from "@/features/accounts/lib/account-action-availability";
import {
  resolveOwnershipViewState,
  isOwnershipReady,
  runIfAllowed,
  type OwnershipSnapshot,
} from "@/features/accounts/lib/account-ownership-view-state";
import { PocketDetailDialog } from "@/features/pockets/components/pocket-detail-dialog";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import { buildPersonalMovementRows } from "@/features/dashboard/lib/personal-view-model";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";
import { resolveAccountComposition, buildPocketCompositionRows } from "@/lib/finance/account-ownership-composition";
import { evaluateThirdPartyLegacy } from "@/lib/finance/third-party-legacy-evaluation";
import { formatCurrencyCop } from "@/lib/format/currency";
import { isSameMonthAndYear } from "@/lib/format/date";
import { useAppContextStore } from "@/stores/app-context-store";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

/**
 * Nivel 2 de profundidad: superficie de módulo. El fondo del shell es el nivel
 * 1 (breadcrumb, header, espacio entre secciones) y el nivel 3 —más presente—
 * queda reservado a interacción: hover, selección y menús.
 *
 * Los cuatro módulos de esta pantalla (resumen, movimientos, este mes,
 * bolsillos) comparten esta constante para que el rail se lea como sistema y no
 * como contenido suelto. Nada más recibe superficie permanente.
 */
const MODULE_SURFACE = "rounded-[20px] border border-white/[0.06] bg-white/[0.022]";

/**
 * Detalle de cuenta como PANTALLA (`/accounts/[accountId]`), no como modal.
 *
 * Conserva íntegra la semántica financiera que tenía el antiguo
 * `AccountDetailDialog`: snapshot de propiedad, composición, disponibilidad de
 * acciones, bolsillos, resumen del mes y movimientos. Lo único que cambió es el
 * chrome: fuera overlay, semántica de diálogo, trampa de foco y bloqueo de
 * scroll; dentro breadcrumb y layout de página. Los diálogos pequeños (editar
 * cuenta,
 * cerrar/reabrir/eliminar, editar/eliminar bolsillo) siguen siendo modales.
 */
export function AccountDetailView({
  account,
  pockets,
  transactions,
  categories,
  accounts,
  masked,
  onAddPocketClick,
  ownerId,
  onDeleted,
  refresh,
}: {
  account: Account | null;
  pockets: Pocket[];
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  masked: boolean;
  ownerId: string;
  onAddPocketClick: () => void;
  onDeleted: () => Promise<void>;
  refresh?: () => Promise<void>;
}) {
  // Bolsillo abierto en su detalle. Se guarda el id, no el objeto: así la
  // ventana refleja el saldo vigente tras cada refresh.
  const [selectedPocketId, setSelectedPocketId] = useState<string | null>(null);
  const [pocketPendingEdit, setPocketPendingEdit] = useState<Pocket | null>(null);
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [accountCloseOpen, setAccountCloseOpen] = useState(false);
  const [accountReopenOpen, setAccountReopenOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Al ser una pantalla, el detalle ya no atrapa el foco, no consume Escape ni
  // bloquea el scroll del body: eso corresponde solo a los diálogos anidados,
  // que conservan su propio manejo (`FinanceDialog`).
  // `detailTitleId` sobrevive porque además del título nombra los motivos de
  // bloqueo referenciados por `aria-describedby` en la zona de bolsillos.
  const detailTitleId = useId();

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const {
    isSubmitting,
    error,
    resetError,
    submitDeleteAccount,
  } = useDeletePersonalEntities();
  const {
    isSubmitting: isLifecycleSubmitting,
    error: lifecycleError,
    resetError: resetLifecycleError,
    submitCloseAccount,
    submitReopenAccount,
  } = useAccountLifecycle();

  // ── Paso 6: composición de propiedad (Mi dinero / Dinero no propio) ──────
  // Se lee bajo demanda al abrir el detalle, con el mismo patrón ya usado por
  // `create-transfer-card.tsx` (efecto con loading/error), nunca desde render,
  // store ni suscripción.
  const [ownershipSnapshot, setOwnershipSnapshot] = useState<OwnershipSnapshot | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  const detailAccountId = account?.id ?? null;

  useEffect(() => {
    if (!detailAccountId || !ownerId) return;
    let cancelled = false;

    // P1/H1: se limpia ANTES de leer. Nunca se muestra ni se usa el snapshot de
    // la cuenta anterior mientras llega el de la nueva.
    setOwnershipSnapshot(null);
    setOwnershipError(null);
    setOwnershipLoading(true);

    readThirdPartyLocationSnapshot(ownerId)
      .then((snapshot) => {
        if (cancelled) return;
        // Se etiqueta con la cuenta para la que se pidió: si el usuario ya cambió
        // de cuenta, `resolveOwnershipViewState` lo descarta por no coincidir.
        setOwnershipSnapshot({ accountId: detailAccountId, ...snapshot });
      })
      .catch(() => {
        if (cancelled) return;
        setOwnershipSnapshot(null);
        setOwnershipError("No se pudo calcular tu dinero propio. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setOwnershipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailAccountId, ownerId]);

  const accountTxs = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter((t) => t.accountId === account.id || t.targetAccountId === account.id)
      .sort((a, b) => {
        const dateA = a.date || a.createdAt || new Date(0);
        const dateB = b.date || b.createdAt || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [transactions, account]);

  const displayTxs = useMemo(() => {
    return accountTxs;
  }, [accountTxs]);

  const rows = useMemo(() => {
    return buildPersonalMovementRows(displayTxs, categories, accounts, pockets);
  }, [displayTxs, categories, accounts, pockets]);

  const groupedTxs = useMemo(() => {
    return groupRowsByDateLabel(rows);
  }, [rows]);

  if (!account) return null;

  const accentColor = account.color || "#60a5fa";
  // Paso 1 (cierre): nunca reconstruir Disponible restando bolsillos del Total.
  // `account.balance` YA es el Disponible crudo; el Total se deriva explícitamente aquí.
  const { availableBalance, pocketsBalance, totalBalance } = calculateAccountPhysicalBalances(account.balance, pockets);
  const disponibleBalance = availableBalance;

  // P1/H1: la composición SOLO se deriva de un snapshot válido de esta cuenta.
  // Mientras no lo haya, el estado es loading/error y no se inventan ceros.
  const ownershipView = resolveOwnershipViewState({
    accountId: account.id,
    loading: ownershipLoading,
    error: ownershipError,
    snapshot: ownershipSnapshot,
  });
  const ownershipReady = isOwnershipReady(ownershipView);
  const readySnapshot = ownershipReady ? ownershipView.snapshot : null;

  // Paso 6: composición derivada con el helper puro. `account.balance` es el
  // Disponible crudo — jamás se usa un total enriquecido como si lo fuera.
  const ownershipComposition = resolveAccountComposition({
    accountId: account.id,
    availableBalance,
    pockets: pockets.map((pocket) => ({ id: pocket.id, balance: pocket.balance })),
    entries: readySnapshot?.entries ?? [],
    moves: readySnapshot?.moves ?? [],
    consumptions: readySnapshot?.consumptions ?? [],
  });
  const legacyEvaluation = evaluateThirdPartyLegacy({ entries: readySnapshot?.entries ?? [] });
  const accountActions = resolveAccountActionAvailability({
    archived: account.archived === true,
    composition: ownershipComposition,
    legacy: legacyEvaluation,
    pocketCount: pockets.length,
    ownershipStatus: ownershipView.status,
  });
  const pocketCompositionRows = buildPocketCompositionRows(
    ownershipComposition,
    pockets.map((pocket) => ({ id: pocket.id, name: pocket.name })),
  );
  // Motivo visible más relevante para el usuario en el encabezado del detalle.
  const accountBlockReason = accountActions.moveThirdParty.reason;

  const selectedPocket = selectedPocketId ? pockets.find((item) => item.id === selectedPocketId) ?? null : null;

  // Reparto Disponible / En bolsillos para la barra de composición. Se deriva
  // de los mismos valores ya mostrados, sin recalcular saldos.
  const showCompositionBar = !masked && totalBalance > 0 && pocketsBalance > 0;
  const availableShare = totalBalance > 0 ? Math.max(0, Math.min(100, (disponibleBalance / totalBalance) * 100)) : 0;

  const currentMonthTxs = transactions.filter((t) => {
    const date = t.date ?? t.createdAt;
    return (t.accountId === account.id || t.targetAccountId === account.id) &&
      isSameMonthAndYear(date, selectedPeriod);
  });

  const gastoMes = currentMonthTxs
    .filter((t) => t.type === "expense" && t.accountId === account.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const ingresoMes = currentMonthTxs
    .filter((t) => t.type === "income" && t.accountId === account.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const transferCount = currentMonthTxs
    .filter((t) => t.type === "transfer" && (t.accountId === account.id || t.targetAccountId === account.id))
    .length;

  // Eliminar un bolsillo ya no vive aquí: es una acción del detalle del
  // bolsillo (`PocketDetailDialog`), con su propio gate y su confirmación.

  const handleDeleteAccount = async () => {
    resetError();
    const deleted = await submitDeleteAccount(ownerId, account.id);
    if (!deleted) {
      return;
    }

    setAccountDeleteOpen(false);
    await onDeleted();
  };

  const handleCloseAccount = async () => {
    resetLifecycleError();
    const closed = await submitCloseAccount(ownerId, account.id);
    if (!closed) {
      return;
    }
    setAccountCloseOpen(false);
    if (refresh) {
      await refresh();
    }
  };

  const handleReopenAccount = async () => {
    resetLifecycleError();
    const reopened = await submitReopenAccount(ownerId, account.id);
    if (!reopened) {
      return;
    }
    setAccountReopenOpen(false);
    if (refresh) {
      await refresh();
    }
  };

  return (
    /* Ancho máximo amplio y centrado: en monitores anchos el monto de un
       movimiento no debe quedar a media pantalla de su descripción. */
    <div className="mx-auto w-full max-w-[1440px]">
      {/* Breadcrumb: Cuentas › {nombre}. El segmento actual es texto, no link. */}
      <nav aria-label="Ruta de navegación" className="mb-4 flex items-center gap-1.5 text-sm">
        <Link
          href="/accounts"
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[var(--fm-text-muted)] transition-colors hover:text-[var(--fm-warm-paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Cuentas
        </Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[var(--fm-text-soft)]" />
        <span aria-current="page" className="truncate px-1.5 py-1 font-medium text-[var(--fm-warm-paper)]">
          {account.name}
        </span>
      </nav>

      {/*
        Header de cuenta. La página ya no vive dentro de una card gigante: el
        fondo del shell es el lienzo y las zonas se separan por espacio y
        divisores puntuales.
      */}
      <header className="mt-6 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <div
                  className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full border"
                  style={{ backgroundColor: `${accentColor}22`, borderColor: `${accentColor}28`, color: accentColor }}
                >
                  <AccountIcon
                    iconType={(account.iconType as "generic" | "bank_logo") || "generic"}
                    iconKey={account.iconKey || "bank"}
                    color={accentColor}
                    size="md"
                  />
                </div>
                <div className="min-w-0">
                  <h2
                    id={detailTitleId}
                    className="truncate font-[var(--font-display)] text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[var(--fm-warm-paper)]"
                  >
                    {account.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] capitalize text-[var(--fm-text-muted)]">
                    {account.type.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <FinanceButton
                    type="button" size="icon" tone="text" variant="ghost"
                    aria-label="Más opciones"
                    onClick={() => setMoreMenuOpen((v) => !v)}
                    className="h-8 w-8 rounded-lg text-[var(--fm-text-soft)] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[var(--fm-warm-paper)] active:bg-white/[0.09]"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </FinanceButton>
                  {moreMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[180px] rounded-xl border border-white/10 bg-[rgba(16,24,38,0.98)] shadow-[0_8px_32px_rgba(0,0,0,0.45)] py-1 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => { setMoreMenuOpen(false); resetError(); setAccountEditOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--fm-text-soft)] hover:bg-white/[0.05] hover:text-[var(--fm-warm-paper)] transition-colors text-left"
                        >
                          <Edit3 className="h-3.5 w-3.5 flex-shrink-0" />
                          Editar cuenta
                        </button>
                        <div className="mx-3 my-1 h-px bg-white/[0.06]" />
                        {account.archived ? (
                          <button
                            type="button"
                            onClick={() => { setMoreMenuOpen(false); resetLifecycleError(); setAccountReopenOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--fm-text-soft)] hover:bg-white/[0.05] hover:text-[var(--fm-warm-paper)] transition-colors text-left"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 flex-shrink-0" />
                            Reabrir cuenta
                          </button>
                        ) : (
                          // Paso 6: deshabilitado comprensible — el motivo real
                          // viaja en `title` y en `aria-describedby` textual.
                          <button
                            type="button"
                            disabled={!accountActions.closeAccount.enabled}
                            title={accountActions.closeAccount.reason ?? undefined}
                            onClick={() => { setMoreMenuOpen(false); resetLifecycleError(); setAccountCloseOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--fm-text-soft)] hover:bg-white/[0.05] hover:text-[var(--fm-warm-paper)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Archive aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" />
                            Cerrar cuenta
                          </button>
                        )}
                        {account.archived ? (
                          <button
                            type="button"
                            disabled={!accountActions.deleteAccount.enabled}
                            title={accountActions.deleteAccount.reason ?? undefined}
                            onClick={() => { setMoreMenuOpen(false); resetError(); setAccountDeleteOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--fm-expense)]/60 hover:bg-[var(--fm-expense)]/8 hover:text-[var(--fm-expense)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" />
                            Eliminar cuenta
                          </button>
                        ) : null}
                        {accountActions.closeAccount.reason && !account.archived ? (
                          <p className="px-3.5 pb-2 pt-0.5 text-[11px] leading-snug text-[var(--fm-text-muted)]">
                            {accountActions.closeAccount.reason}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
      </header>

      {/*
        Franja financiera a ancho completo. Una sola composición: el Total
        físico domina y los demás datos se separan por divisores verticales
        suaves, nunca por cards independientes.
      */}
      <section className={`${MODULE_SURFACE} mt-6 px-7 py-7`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="lg:pr-10">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fm-text-muted)]/80">
              Total físico
            </p>
            <Amount
              masked={masked}
              showSign={false}
              size="display"
              value={totalBalance}
              className="mt-1.5 block text-[40px] font-bold leading-none tracking-[-0.02em]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-white/[0.06] pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]/70">Disponible</p>
              <Amount masked={masked} showSign={false} size="sm" value={disponibleBalance} className="mt-1 block text-[20px] font-bold text-[var(--fm-income)]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]/70">En bolsillos</p>
              <Amount masked={masked} showSign={false} size="sm" value={pocketsBalance} className="mt-1 block text-[20px] font-bold text-[var(--fm-pending)]" />
            </div>

            {/* Paso 6 — Composición de propiedad. Nunca se oculta ni se
                "arregla": si Mi dinero es negativo se muestra negativo.
                G1: si no hay no propio y todo es consistente, el bloque
                agregado no aporta nada nuevo sobre "Total físico" — se
                oculta (Android hace lo mismo). Loading/error se muestran
                siempre para no ocultar el estado de carga. */}
            {!ownershipReady || ownershipComposition.thirdParty !== 0 || ownershipComposition.isInconsistent ? (
              <>
                <div className="hidden h-10 w-px bg-white/[0.06] lg:block" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]/70">Mi dinero</p>
                  {!ownershipReady && ownershipView.status === "loading" ? (
                    <p className="mt-1 text-[13px] text-[var(--fm-text-muted)]">Calculando…</p>
                  ) : ownershipView.status === "error" ? (
                    <p className="mt-1 text-[12px] text-[var(--fm-expense)]">{ownershipError}</p>
                  ) : (
                    <Amount
                      masked={masked}
                      showSign={false}
                      size="sm"
                      value={ownershipComposition.own}
                      className={`mt-1 block text-[20px] font-bold ${ownershipComposition.own < 0 ? "text-[var(--fm-expense)]" : "text-[var(--fm-warm-paper)]"}`}
                    />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]/70">Dinero no propio</p>
                  {!ownershipReady && ownershipView.status === "loading" ? (
                    <p className="mt-1 text-[13px] text-[var(--fm-text-muted)]">Calculando…</p>
                  ) : ownershipView.status === "error" ? (
                    <p className="mt-1 text-[12px] text-[var(--fm-expense)]">—</p>
                  ) : (
                    <Amount masked={masked} showSign={false} size="sm" value={ownershipComposition.thirdParty} className="mt-1 block text-[20px] font-bold text-[var(--fm-transfer)]" />
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
        {/*
          Composición proporcional del Total: acompaña a las cifras, no las
          reemplaza. Solo aparece cuando hay algo que proporcionar (bolsillos
          con saldo) y nunca con los montos ocultos, para no filtrar por la
          geometría lo que el ojo global tapa.
        */}
        {showCompositionBar ? (
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full bg-[var(--fm-income)] transition-[width] duration-200"
                style={{ width: `${availableShare}%` }}
              />
              <div
                className="h-full bg-[var(--fm-pending)] transition-[width] duration-200"
                style={{ width: `${100 - availableShare}%` }}
              />
            </div>
            <p className="shrink-0 text-[11px] text-[var(--fm-text-muted)]">
              {Math.round(availableShare)}% disponible · {100 - Math.round(availableShare)}% en bolsillos
            </p>
          </div>
        ) : null}
      </section>

      {/* Banner de bloqueo: solo existe si hay gate. No reserva espacio. */}
      {accountBlockReason ? (
        <p
          role="status"
          className="mt-5 rounded-xl border border-[var(--fm-pending)]/30 bg-[var(--fm-pending)]/10 px-4 py-3 text-[13px] leading-relaxed text-[var(--fm-warm-paper)]"
        >
          {accountBlockReason}
        </p>
      ) : null}

      {/* Cuerpo: Movimientos manda; "Este mes" y Bolsillos son contexto. */}
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">

              {/* RAIL — contexto secundario. En desktop va a la derecha; en
                  pantallas angostas cae debajo de Movimientos. */}
              <aside className="order-2 space-y-7">

                {/* Este mes */}
                <div className={`${MODULE_SURFACE} px-4 py-4`}>
                  <h3 className="mb-2 px-1 text-[13px] font-semibold text-[var(--fm-text-soft)]">Este mes</h3>
                  <div className="divide-y divide-white/[0.04]">
                    <div className="flex items-center justify-between px-1 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--fm-expense)]" />
                        <span className="text-[12px] text-[var(--fm-text-muted)]">Gastos</span>
                      </div>
                      <Amount masked={masked} showSign={false} size="sm" value={gastoMes} className="text-[13px] font-semibold text-[var(--fm-warm-paper)]" />
                    </div>
                    <div className="flex items-center justify-between px-1 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--fm-income)]" />
                        <span className="text-[12px] text-[var(--fm-text-muted)]">Ingresos</span>
                      </div>
                      <Amount masked={masked} showSign={false} size="sm" value={ingresoMes} className="text-[13px] font-semibold text-[var(--fm-warm-paper)]" />
                    </div>
                    <div className="flex items-center justify-between px-1 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-[#60a5fa]" />
                        <span className="text-[12px] text-[var(--fm-text-muted)]">Transferencias</span>
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--fm-warm-paper)]">{transferCount}</span>
                    </div>
                  </div>
                </div>

                {/* Bolsillos — mismo lenguaje visual que "Este mes". */}
                <div className={`${MODULE_SURFACE} px-4 py-4`}>
                  <div className="flex items-center justify-between border-b border-white/[0.05] px-1 pb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[var(--fm-text-soft)]">Bolsillos</h3>
                      {pockets.length > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-white/8 text-[var(--fm-text-muted)]">{pockets.length}</span>
                      )}
                    </div>
                    {/* Corrección P1-A (Paso 2): una cuenta cerrada no admite gestión de
                        bolsillos desde la UI — el servicio ya es la barrera real, esto
                        solo evita ofrecer una acción que el backend rechazaría. */}
                    {!account.archived ? (
                      <button
                        type="button"
                        disabled={!accountActions.createPocket.enabled}
                        aria-describedby={accountActions.createPocket.reason ? `${detailTitleId}-pockets-blocked` : undefined}
                        onClick={() => runIfAllowed(accountActions.createPocket, onAddPocketClick)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--fm-pending)] px-2 py-1 rounded-lg hover:bg-[var(--fm-pending)]/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <Plus className="h-3 w-3" />
                        Nuevo
                      </button>
                    ) : null}
                  </div>
                  {/* P1/H2 — el motivo del bloqueo es texto visible y queda
                      asociado por aria-describedby a cada control deshabilitado. */}
                  {accountActions.createPocket.reason ? (
                    <p id={`${detailTitleId}-pockets-blocked`} className="px-1 pb-2 pt-2 text-[11px] leading-snug text-[var(--fm-text-muted)]">
                      {accountActions.createPocket.reason}
                    </p>
                  ) : null}
                  <div className="divide-y divide-white/[0.04]">
                    {pockets.length === 0 ? (
                      <p className="text-[11px] text-[var(--fm-text-muted)] py-5 text-center">Sin bolsillos.</p>
                    ) : (
                      pockets.map((pocket, idx) => (
                        /*
                          Fila-acción: abre el detalle del bolsillo, igual que el
                          tile de la lista de Cuentas. Mover / editar / eliminar
                          ya no viven aquí como iconos al hover — son acciones
                          del detalle, con sus gates y sus confirmaciones.
                        */
                        <button
                          key={pocket.id}
                          type="button"
                          onClick={() => setSelectedPocketId(pocket.id)}
                          aria-label={`Ver detalle del bolsillo ${pocket.name}`}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-150 hover:bg-white/[0.035] active:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Wallet
                              aria-hidden="true"
                              className="h-5 w-5 shrink-0"
                              style={{ color: idx % 2 === 0 ? accentColor : "var(--fm-pending)" }}
                            />
                            <span className="block min-w-0">
                              <span className="block text-[13px] font-medium text-[var(--fm-text-soft)] truncate">{pocket.name}</span>
                              {/* P1/H3 — composición LOCALIZADA de este bolsillo (nunca el total de la cuenta). */}
                              {ownershipView.status === "loading" ? (
                                <span className="block text-[10px] text-[var(--fm-text-muted)]">Calculando tu dinero…</span>
                              ) : ownershipView.status === "error" ? (
                                <span className="block text-[10px] text-[var(--fm-expense)]">No se pudo calcular la composición</span>
                              ) : (
                                (() => {
                                  const row = pocketCompositionRows.find((item) => item.pocketId === pocket.id);
                                  if (!row) return null;
                                  // G1: sin no propio y consistente, la línea agregada no
                                  // aporta nada sobre el saldo del bolsillo ya visible.
                                  if (row.thirdParty === 0 && !row.isInconsistent) return null;
                                  return (
                                    <span className="block text-[10px] text-[var(--fm-text-muted)]">
                                      Mi dinero{" "}
                                      <span className={row.own < 0 ? "text-[var(--fm-expense)] font-semibold" : "text-[var(--fm-text-soft)]"}>
                                        {formatCurrencyCop(row.own)}
                                      </span>
                                      {" · "}No propio{" "}
                                      <span className="text-[var(--fm-transfer)]">{formatCurrencyCop(row.thirdParty)}</span>
                                      {row.isInconsistent ? " · Requiere revisión" : null}
                                    </span>
                                  );
                                })()
                              )}
                            </span>
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-1.5">
                            <Amount masked={masked} showSign={false} size="sm" value={pocket.balance} className="text-[13px] font-semibold text-[var(--fm-warm-paper)] tabular-nums" />
                            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[var(--fm-text-muted)]/50" />
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </aside>

              {/* COLUMNA PRINCIPAL — Movimientos. Sin `max-height` propio: es el
                  área de trabajo de la página y scrollea con ella. */}
              <section className={`${MODULE_SURFACE} order-1 min-w-0 px-5 py-4`}>
                <div className="flex items-baseline justify-between border-b border-white/[0.05] px-1 pb-2.5">
                  <h3 className="text-[13px] font-semibold text-[var(--fm-text-soft)]">Movimientos</h3>
                  {accountTxs.length > 0 && (
                    <span className="text-[11px] text-[var(--fm-text-muted)]/60">{accountTxs.length} movimientos</span>
                  )}
                </div>
                <div>
                  {groupedTxs.length === 0 ? (
                    <p className="text-[12px] text-[var(--fm-text-muted)] py-10 text-center">Sin movimientos.</p>
                  ) : (
                    groupedTxs.map((group) => (
                      <div key={group.label}>
                        <div className="px-1 text-[10px] font-semibold text-[var(--fm-text-muted)]/40 uppercase tracking-widest pt-5 pb-2 first:pt-4">
                          {group.label}
                        </div>
                        <div className="space-y-1 mb-3">
                          {group.rows.map((row) => (
                            <PersonalTransactionRow key={row.id} row={row} />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

      {/* Detalle de bolsillo: mismo flujo que desde la lista de Cuentas. Es el
          dueño de mover / editar / eliminar, con sus gates y confirmación. */}
      <PocketDetailDialog
        open={!!selectedPocket && !pocketPendingEdit}
        account={account}
        pocket={selectedPocket}
        pockets={pockets}
        masked={masked}
        ownerId={ownerId}
        onClose={() => setSelectedPocketId(null)}
        onEdit={(pocket) => setPocketPendingEdit(pocket)}
        onDeleted={async () => {
          // Se elimina el bolsillo, no la cuenta: se refresca y se sigue aquí.
          setSelectedPocketId(null);
          if (refresh) {
            await refresh();
          }
        }}
      />

      <FinanceDialog
        open={accountDeleteOpen}
        title="Eliminar cuenta"
        subtitle="Se elimina únicamente el contenedor de la cuenta. Tus movimientos reales no se borran: quedarán en tu historial mostrando esta cuenta como eliminada. Esta acción no se puede deshacer."
        onClose={() => {
          if (!isSubmitting) {
            setAccountDeleteOpen(false);
            resetError();
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fm-warm-paper)]">
            Vas a eliminar la cuenta cerrada &quot;{account.name}&quot;. Solo se elimina la cuenta en sí; ningún movimiento real se pierde.
          </p>
          {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setAccountDeleteOpen(false);
                resetError();
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton type="button" tone="destructive" onClick={() => void handleDeleteAccount()} disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar cuenta"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>

      <FinanceDialog
        open={accountCloseOpen}
        title="Cerrar cuenta"
        subtitle={
          pockets.length > 0
            ? "No puedes cerrar esta cuenta mientras tenga bolsillos activos."
            : 'La cuenta saldrá de tus saldos totales y de los selectores de nuevos movimientos, pero conserva todo su historial. Podrás reabrirla cuando quieras.'
        }
        onClose={() => {
          if (!isLifecycleSubmitting) {
            setAccountCloseOpen(false);
            resetLifecycleError();
          }
        }}
      >
        <div className="space-y-4">
          {pockets.length > 0 ? (
            <p className="text-sm text-[var(--fm-warm-paper)]">
              &quot;{account.name}&quot; tiene {pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}. Resuélvelos o elimínalos antes de cerrar la cuenta.
            </p>
          ) : (
            <p className="text-sm text-[var(--fm-warm-paper)]">
              Vas a cerrar &quot;{account.name}&quot;. No se borra ningún dato: solo deja de contar en tus saldos activos.
            </p>
          )}
          {lifecycleError ? <p className="text-sm text-[var(--fm-expense)]">{lifecycleError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setAccountCloseOpen(false);
                resetLifecycleError();
              }}
              disabled={isLifecycleSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton
              type="button"
              tone="destructive"
              onClick={() => void handleCloseAccount()}
              disabled={isLifecycleSubmitting || pockets.length > 0}
            >
              {isLifecycleSubmitting ? "Cerrando..." : "Cerrar cuenta"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>

      <FinanceDialog
        open={accountReopenOpen}
        title="Reabrir cuenta"
        subtitle="La cuenta vuelve a contar en tus saldos y aparece de nuevo en los selectores de nuevos movimientos."
        onClose={() => {
          if (!isLifecycleSubmitting) {
            setAccountReopenOpen(false);
            resetLifecycleError();
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fm-warm-paper)]">
            Vas a reabrir &quot;{account.name}&quot;. Su Disponible, bolsillos e historial se conservan tal cual.
          </p>
          {lifecycleError ? <p className="text-sm text-[var(--fm-expense)]">{lifecycleError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setAccountReopenOpen(false);
                resetLifecycleError();
              }}
              disabled={isLifecycleSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton type="button" tone="filled" onClick={() => void handleReopenAccount()} disabled={isLifecycleSubmitting}>
              {isLifecycleSubmitting ? "Reabriendo..." : "Reabrir cuenta"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
      {pocketPendingEdit && (
        <EditPocketDialog
          open={!!pocketPendingEdit}
          account={account}
          pocket={pocketPendingEdit}
          ownerId={ownerId}
          onClose={() => setPocketPendingEdit(null)}
          onUpdated={async () => {
            if (refresh) {
              await refresh();
            }
          }}
        />
      )}
      <EditAccountDialog
        open={accountEditOpen}
        account={account}
        availableBalance={disponibleBalance}
        pocketsBalance={pocketsBalance}
        adjustAvailability={accountActions.adjustAvailable}
        ownerId={ownerId}
        onClose={() => setAccountEditOpen(false)}
        onUpdated={async () => {
          if (refresh) await refresh();
        }}
      />
    </div>
  );
}
