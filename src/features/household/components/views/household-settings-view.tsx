"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, LogOut, Trash2, Edit2, Copy, Check, Tags, AlertTriangle, Cloud, Clock, ChevronRight, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { SettingsLayout } from "@/components/layout/settings-layout";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useRenameHousehold } from "@/features/household/hooks/use-rename-household";
import { useLeaveHousehold } from "@/features/household/hooks/use-leave-household";
import { useDissolveHousehold } from "@/features/household/hooks/use-dissolve-household";
import { useGenerateInviteCode } from "@/features/household/hooks/use-generate-invite-code";
import { getInviteCodeExpiryLabel, isInviteCodeExpired } from "@/features/household/lib/invite-code-expiry";
import type { HouseholdMemberProfile } from "@/types/household";

import { useAuthStore } from "@/stores/auth-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { signOutUser } from "@/features/auth/auth-service";
import { usePersonalDataStore } from "@/stores/personal-data-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { isQaResetToolAvailable } from "@/features/qa-reset/lib/qa-reset-availability";
import { QaResetConfirmDialog } from "@/features/qa-reset/components/qa-reset-confirm-dialog";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";

type Props = {
  householdId: string;
  currentUid: string;
  ownerId: string;
  currentName: string;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: Date | null;
  memberProfiles: Record<string, HouseholdMemberProfile>;
  memberIds: string[];
};

function HouseholdSettingItem({
  icon,
  title,
  description,
  onClick,
  destructive = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          destructive
            ? "bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_90%)] text-[var(--hh-destructive-content)]"
            : disabled
              ? "bg-[var(--hh-border)]/[0.04] text-[var(--hh-text-muted)]/[0.5]"
              : "bg-[var(--hh-border)]/[0.08] text-[var(--hh-text)]"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p
          className={`font-semibold text-sm leading-tight ${
            destructive
              ? "text-[var(--hh-destructive-content)]"
              : disabled
                ? "text-[var(--hh-text)]/[0.4]"
                : "text-[var(--hh-text)]"
          }`}
        >
          {title}
        </p>
        <p
          className={`mt-0.5 text-xs leading-snug ${
            disabled ? "text-[var(--hh-text-muted)]/[0.5]" : "text-[var(--hh-text-muted)]"
          }`}
        >
          {description}
        </p>
      </div>
      {onClick && !disabled && (
        <div
          className={`shrink-0 ${
            destructive ? "text-[var(--hh-destructive-content)]" : "text-[var(--hh-text-secondary)]"
          }`}
        >
          <ChevronRight className="h-5 w-5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
      )}
    </>
  );

  const wrapperClass = `group flex w-full items-center gap-4 rounded-2xl px-4 py-4 transition-all ${
    destructive
      ? "bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_95%)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_90%)]"
      : disabled
        ? "bg-transparent cursor-not-allowed"
        : onClick 
          ? "bg-transparent hover:bg-[var(--hh-border)]/[0.04]"
          : "bg-transparent"
  }`;

  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className={wrapperClass}>
        {content}
      </button>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}


export function HouseholdSettingsView({
  householdId,
  currentUid,
  ownerId,
  currentName,
  inviteCode,
  inviteCodeExpiresAt,
  memberProfiles,
  memberIds
}: Props) {
  const router = useRouter();
  const isOwner = currentUid === ownerId;

  const [name, setName] = useState(currentName);
  const { isSubmitting: isRenaming, error: renameError, submit: submitRename, resetError: resetRenameError } = useRenameHousehold();
  const { isSubmitting: isLeaving, error: leaveError, submit: submitLeave } = useLeaveHousehold();
  const { isSubmitting: isDissolving, error: dissolveError, submit: submitDissolve } = useDissolveHousehold();
  const { isSubmitting: isGenerating, error: generateError, submit: generateCodeSubmit, resetError: resetGenerateError } = useGenerateInviteCode();
  
  const [copied, setCopied] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showConfirmDissolve, setShowConfirmDissolve] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const toggleMasked = useUiPreferencesStore((state) => state.toggleBalancesHidden);
  
  const qaResetToolAvailable = isQaResetToolAvailable();
  const [isQaResetDialogOpen, setIsQaResetDialogOpen] = useState(false);
  const { data: householdData } = useHouseholdData();

  const handleLogout = async () => {
    await signOutUser();
    clearSession();
    usePersonalDataStore.getState().reset();
    useHouseholdDataStore.getState().reset();
    useAppContextStore.getState().resetForSessionBoundary();
    router.replace("/");
  };

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) return;
    resetRenameError();
    const ok = await submitRename(householdId, currentUid, name);
    if (ok) setShowRenameDialog(false);
  };

  const handleLeave = async () => {
    const ok = await submitLeave(householdId, currentUid);
    if (ok) router.push("/dashboard");
  };

  const handleDissolve = async () => {
    const ok = await submitDissolve(householdId, currentUid);
    if (ok) router.push("/dashboard");
  };

  const handleGenerateCode = async () => {
    resetGenerateError();
    await generateCodeSubmit({ householdId, uid: currentUid });
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const anyLoading = isRenaming || isLeaving || isDissolving || isGenerating;
  const isGeneratingOrJustFinished = isGenerating;

  /**
   * Paridad Android (`SettingsScreen.kt`) y con Home/waiting de la Web: el
   * código de invitación existe solo mientras el hogar está incompleto. Con 2
   * miembros el tope de Rules ya rechaza cualquier join, así que la card
   * desaparece (el documento conserva el código; no se borra nada).
   *
   * Tampoco es owner-only: `generate-household-invite-code.ts` autoriza a
   * CUALQUIER miembro, y el miembro no-owner necesitaba ver el código para
   * reinvitar tras una salida.
   */
  const householdIsIncomplete = memberIds.length < 2;
  const codeIsUsable = Boolean(inviteCode) && !isInviteCodeExpired(inviteCodeExpiresAt);

  return (
    <>
      <SettingsLayout
        profileBlock={
          <section className="rounded-[24px] border border-[var(--hh-border-strong)] bg-[var(--hh-surface-elevated)] px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-10">
              <div className="flex min-w-0 items-center gap-5 lg:self-center">
                <ProfileAvatar
                  name={user?.displayName}
                  photoURL={user?.photoUrl}
                  size="xl"
                  decorative
                  className="bg-[var(--hh-border)] font-[var(--font-display)] text-[var(--hh-text)]"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-secondary)]">
                    Tu cuenta
                  </p>
                  <p className="mt-1 truncate font-[var(--font-display)] text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--hh-text)]">
                    {user?.displayName || "Usuario"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--hh-text-muted)]">
                    {user?.email || "Cargando perfil..."}
                  </p>
                  <p className="mt-3 text-xs text-[var(--hh-text-muted)]">
                    Moneda · <span className="font-semibold text-[var(--hh-text)]">COP</span>
                  </p>
                </div>
              </div>

              <div className="min-w-0 border-t border-[var(--hh-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-secondary)]">
                      Hogar
                    </p>
                    <p className="mt-1 truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--hh-text)]">
                      {currentName}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--hh-text-muted)]">
                      Libro compartido · {memberIds.length} de 2 miembros
                    </p>
                  </div>

                  <div className="relative shrink-0" ref={menuRef}>
                    <HouseholdButton
                      type="button"
                      size="icon"
                      tone="text"
                      variant="ghost"
                      aria-label="Opciones del hogar"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((open) => !open)}
                      className="h-10 w-10 border border-[var(--hh-border)]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </HouseholdButton>
                    {menuOpen && (
                      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] py-1 shadow-[var(--hh-shadow-soft)]">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--hh-text)] hover:bg-[var(--hh-surface-hover)]"
                          onClick={() => {
                            setMenuOpen(false);
                            setShowRenameDialog(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4 text-[var(--hh-text-secondary)]" />
                          Renombrar hogar
                        </button>
                        {isOwner ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--hh-destructive-content)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_92%)]"
                            onClick={() => {
                              setMenuOpen(false);
                              setShowConfirmDissolve(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Disolver Hogar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--hh-destructive-content)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_92%)]"
                            onClick={() => {
                              setMenuOpen(false);
                              setShowConfirmLeave(true);
                            }}
                          >
                            <LogOut className="h-4 w-4" />
                            Abandonar Hogar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[13px] font-medium text-[var(--hh-text-secondary)]">Miembros</p>
                  {memberIds.map((id) => {
                    const isSelf = id === currentUid;
                    const memberName = isSelf ? user?.displayName : memberProfiles[id]?.displayName;
                    const memberPhotoURL = isSelf ? user?.photoUrl : memberProfiles[id]?.photoUrl;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3 py-2.5"
                      >
                        <ProfileAvatar
                          name={memberName}
                          photoURL={memberPhotoURL}
                          size="sm"
                          className="bg-[var(--hh-border)]/[0.08] text-[var(--hh-text)]"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--hh-text)]">
                            {isSelf ? "Tú" : memberName || "Otro miembro"}
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--hh-text-muted)]">
                                {id === ownerId ? "Propietario" : "Miembro"}
                              </span>
                            )}
                            {!isSelf && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--hh-text-muted)]">
                                {id === ownerId ? "Propietario" : "Miembro"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {householdIsIncomplete && !showConfirmLeave && !showConfirmDissolve && (
                  <div className="mt-5 space-y-3 border-t border-[var(--hh-border)]/[0.06] pt-5">
                    <span className="block text-[13px] font-medium text-[var(--hh-text-secondary)]">Código de Invitación</span>
                    {codeIsUsable ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-3">
                          <code className="flex-1 select-all text-center font-mono text-[18px] font-medium tracking-[0.1em] text-[var(--hh-text)]">
                            {inviteCode}
                          </code>
                          <HouseholdButton type="button" variant="ghost" size="icon" onClick={handleCopy} className="h-10 w-10 shrink-0">
                            {copied ? <Check className="h-4 w-4 text-[var(--hh-text)]" /> : <Copy className="h-4 w-4 text-[var(--hh-text-secondary)]" />}
                          </HouseholdButton>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--hh-text-muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          {getInviteCodeExpiryLabel(inviteCodeExpiresAt)}
                        </span>
                        <HouseholdButton
                          type="button"
                          tone="text"
                          variant="ghost"
                          onClick={handleGenerateCode}
                          disabled={anyLoading}
                          className="border border-[var(--hh-border)]"
                        >
                          {isGeneratingOrJustFinished ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                            </>
                          ) : (
                            "Generar nuevo código"
                          )}
                        </HouseholdButton>
                      </div>
                    ) : (
                      <HouseholdButton
                        type="button"
                        tone="filled"
                        onClick={handleGenerateCode}
                        disabled={anyLoading}
                        className="bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] shadow-none"
                      >
                        {isGeneratingOrJustFinished ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                          </>
                        ) : (
                          "Generar código"
                        )}
                      </HouseholdButton>
                    )}
                    {generateError && (
                      <p className="text-xs font-medium text-[var(--hh-destructive-content)]">{generateError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        }
        preferencesBlock={
          <HouseholdCard className="h-full" title="Preferencias" variant="elevated">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2.5">
                <div className="min-w-0 pr-4">
                  <p className="font-semibold text-sm text-[var(--hh-text)]">Ocultar saldos al abrir</p>
                  <p className="text-xs text-[var(--hh-text-muted)]">Afecta saldos de deudas del hogar</p>
                </div>
                <button
                  type="button"
                  aria-pressed={masked}
                  onClick={toggleMasked}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${masked ? 'bg-[var(--hh-primary-action)]' : 'bg-[var(--hh-border)]/[0.2]'}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-[var(--hh-surface)] shadow-none ring-0 transition duration-200 ease-in-out ${masked ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between py-2.5 opacity-50">
                <div className="min-w-0 pr-4">
                  <p className="font-semibold text-sm text-[var(--hh-text)]">Notificaciones</p>
                  <p className="text-xs text-[var(--hh-text-muted)]">Recordatorios de pendientes (No disponible en web)</p>
                </div>
                <button
                  type="button"
                  disabled
                  className="relative inline-flex h-7 w-12 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[var(--hh-border)]/[0.2] transition-colors duration-200 ease-in-out"
                >
                  <span className="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-[var(--hh-surface)] shadow-none ring-0 transition duration-200 ease-in-out translate-x-0" />
                </button>
              </div>
            </div>
          </HouseholdCard>
        }
        organizationBlock={
          <HouseholdCard className="h-full" title="Organización" variant="elevated">
            <div className="space-y-1 -mx-2">
              <HouseholdSettingItem
                icon={<Tags className="h-5 w-5" />}
                title="Categorías del hogar"
                description="Administra categorías compartidas."
                onClick={() => router.push("/household/categories?mode=manage")}
              />
            </div>
          </HouseholdCard>
        }
        footerBlock={
          <div className="space-y-6">
            <HouseholdCard title="Sincronización y diagnóstico" variant="elevated">
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 -mx-2">
                <HouseholdSettingItem
                  icon={<Cloud className="h-5 w-5" />}
                  title="Sincronización automática"
                  description="Tus cambios se sincronizan automáticamente."
                />
              </div>
            </HouseholdCard>
            <HouseholdCard title="Zona peligrosa" variant="elevated" className="border-[color-mix(in_oklch,var(--hh-destructive-content),transparent_85%)] bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_98%)]">
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 -mx-2">
                {qaResetToolAvailable && (
                  <HouseholdSettingItem
                    icon={<AlertTriangle className="h-5 w-5" />}
                    title="Reiniciar datos de prueba"
                    description="QA: borra todos tus movimientos y el hogar."
                    onClick={() => setIsQaResetDialogOpen(true)}
                    destructive
                  />
                )}
                <HouseholdSettingItem
                  icon={<LogOut className="h-5 w-5" />}
                  title="Cerrar sesión"
                  description="Salir de tu cuenta en este dispositivo."
                  onClick={() => setLogoutConfirmOpen(true)}
                  destructive
                />
              </div>
            </HouseholdCard>
          </div>
        }
      />

      <HouseholdDialog
        open={showRenameDialog}
        title="Renombrar hogar"
        subtitle="Visible para ambos miembros del libro compartido."
        onClose={() => {
          if (!isRenaming) {
            setName(currentName);
            resetRenameError();
            setShowRenameDialog(false);
          }
        }}
      >
        <form onSubmit={handleRename} className="space-y-5">
          <HouseholdTextField
            id="householdRenameName"
            label="Nombre del Hogar"
            placeholder="Ej: Hogar Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={anyLoading}
            errorText={renameError || undefined}
            required
            className="text-[16px] sm:text-[14px]"
          />
          <div className="flex justify-end gap-3">
            <HouseholdButton
              type="button"
              tone="text"
              variant="ghost"
              disabled={isRenaming}
              onClick={() => {
                setName(currentName);
                resetRenameError();
                setShowRenameDialog(false);
              }}
              className="border border-[var(--hh-border)]"
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              type="submit"
              tone="filled"
              disabled={anyLoading || !name.trim() || name.trim() === currentName}
              className="bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] shadow-none"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </HouseholdButton>
          </div>
        </form>
      </HouseholdDialog>

      <HouseholdDialog
        open={showConfirmLeave}
        title="¿Abandonar Hogar compartido?"
        onClose={() => !isLeaving && setShowConfirmLeave(false)}
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--hh-text-secondary)]">
            Perderás acceso a todos los gastos, deudas y presupuestos de este hogar de forma inmediata.
          </p>
          {leaveError && <p className="text-xs font-medium text-[var(--hh-destructive-content)]">{leaveError}</p>}
          <div className="flex justify-end gap-3">
            <HouseholdButton
              type="button"
              tone="text"
              variant="ghost"
              disabled={anyLoading}
              onClick={() => setShowConfirmLeave(false)}
              className="border border-[var(--hh-border)]"
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              type="button"
              tone="filled"
              disabled={anyLoading}
              onClick={handleLeave}
              className="bg-[var(--hh-destructive-content)] text-[var(--hh-text)] shadow-none"
            >
              {isLeaving ? "Saliendo..." : "Confirmar salida"}
            </HouseholdButton>
          </div>
        </div>
      </HouseholdDialog>

      <HouseholdDialog
        open={showConfirmDissolve}
        title="¿Disolver Hogar compartido?"
        onClose={() => !isDissolving && setShowConfirmDissolve(false)}
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--hh-text-secondary)]">
            Esta acción desactivará este hogar para ti y el otro miembro. Es irreversible.
          </p>
          {dissolveError && <p className="text-xs font-medium text-[var(--hh-destructive-content)]">{dissolveError}</p>}
          <div className="flex justify-end gap-3">
            <HouseholdButton
              type="button"
              tone="text"
              variant="ghost"
              disabled={anyLoading}
              onClick={() => setShowConfirmDissolve(false)}
              className="border border-[var(--hh-border)]"
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              type="button"
              tone="filled"
              disabled={anyLoading}
              onClick={handleDissolve}
              className="bg-[var(--hh-destructive-content)] text-[var(--hh-text)] shadow-none"
            >
              {isDissolving ? "Disolviendo..." : "Confirmar disolución"}
            </HouseholdButton>
          </div>
        </div>
      </HouseholdDialog>

      {logoutConfirmOpen && (
        <HouseholdDialog
          open={logoutConfirmOpen}
          title="Cerrar sesión"
          onClose={() => setLogoutConfirmOpen(false)}
        >
          <div className="space-y-6 pt-2">
            <p className="text-sm text-[var(--hh-text-muted)]">Vas a cerrar tu sesión en este dispositivo. Tendrás que volver a iniciar sesión para entrar a la app.</p>
            <div className="flex gap-3 justify-end">
              <HouseholdButton tone="text" variant="ghost" onClick={() => setLogoutConfirmOpen(false)} className="border border-[var(--hh-border)]">Cancelar</HouseholdButton>
              <HouseholdButton tone="filled" onClick={() => { setLogoutConfirmOpen(false); handleLogout(); }} className="bg-[var(--hh-destructive-content)] text-[var(--hh-text)] shadow-none">Cerrar sesión</HouseholdButton>
            </div>
          </div>
        </HouseholdDialog>
      )}

      {qaResetToolAvailable && (
        <QaResetConfirmDialog
          open={isQaResetDialogOpen}
          onClose={() => setIsQaResetDialogOpen(false)}
          uid={currentUid}
          household={householdData?.household ?? null}
        />
      )}
    </>
  );
}
