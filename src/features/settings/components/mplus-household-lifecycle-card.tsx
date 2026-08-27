"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Edit2,
  Home,
  LogOut,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";

import {
  cancelWaitingHousehold,
  createHousehold,
  joinHousehold,
  leaveHouseholdPause,
  leaveHouseholdPermanently,
  regenerateHouseholdInvite,
  renameHousehold,
  returnToHousehold,
} from "@/features/household/services/mplus-household-service";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { normalizeHouseholdInviteCode } from "@/lib/mplus/ids";
import type { MplusMutationOutcome } from "@/lib/mplus/mutation-runner";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

type Props = {
  currentUid: string;
  userName?: string | null;
  userPhotoURL?: string | null;
};

const resolveOutcomeError = (outcome: MplusMutationOutcome<unknown>, fallback: string): string => {
  if (outcome.kind === "conflict") {
    return "Hubo un conflicto de versiones. Por favor actualiza e inténtalo de nuevo.";
  }
  if (outcome.kind === "rejected" || outcome.kind === "unavailable") {
    return outcome.message || fallback;
  }
  return fallback;
};

export function MplusHouseholdLifecycleCard({
  currentUid,
  userName,
  userPhotoURL,
}: Props) {
  const userProfile = useMplusPersonalStore((state) => state.profile);
  const reloadPersonal = useMplusPersonalStore((state) => state.refresh);

  const household = useMplusHouseholdStore((state) => state.household);
  const members = useMplusHouseholdStore((state) => state.members);
  const activeInvite = useMplusHouseholdStore((state) => state.activeInvite);
  const reloadHousehold = useMplusHouseholdStore((state) => state.refresh);

  // Estados de modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPauseConfirmOpen, setIsPauseConfirmOpen] = useState(false);
  const [isLeaveAllConfirmOpen, setIsLeaveAllConfirmOpen] = useState(false);
  const [isCancelWaitingConfirmOpen, setIsCancelWaitingConfirmOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const membershipState = userProfile?.householdMembershipState ?? "none";
  const hasHousehold = Boolean(userProfile?.householdId);

  const currentMember = useMemo(
    () => members.find((m) => m.userId === currentUid) ?? null,
    [members, currentUid],
  );

  const otherMember = useMemo(
    () => members.find((m) => m.userId !== currentUid) ?? null,
    [members, currentUid],
  );

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const trimmed = createName.trim();
    if (!trimmed) {
      setActionError("Ingresa un nombre para el hogar.");
      return;
    }

    setIsActionLoading(true);
    setActionError(null);

    const outcome = await createHousehold({
      householdId: crypto.randomUUID().toLowerCase(),
      name: trimmed,
      creatorUid: currentUid,
      displayName: userName || "Usuario",
      photoUrl: userPhotoURL || "",
      userProfile,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsCreateOpen(false);
      setCreateName("");
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al crear el hogar."));
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeHouseholdInviteCode(joinCode);
    if (normalized.length !== 3) {
      setActionError("El código de invitación debe tener 3 dígitos numéricos.");
      return;
    }

    setIsActionLoading(true);
    setActionError(null);

    const outcome = await joinHousehold({
      rawInviteCode: normalized,
      joinerUid: currentUid,
      displayName: userName || "Usuario",
      photoUrl: userPhotoURL || "",
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsJoinOpen(false);
      setJoinCode("");
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al unirse al hogar."));
    }
  };

  const handleCancelWaiting = async () => {
    if (!household || !userProfile) return;
    setIsActionLoading(true);
    setActionError(null);

    const outcome = await cancelWaitingHousehold({
      householdId: household.id,
      creatorUid: currentUid,
      userProfile,
      household,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsCancelWaitingConfirmOpen(false);
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al cancelar el hogar."));
    }
  };

  const handleRegenerateInvite = async () => {
    if (!household) return;
    setIsActionLoading(true);
    setActionError(null);

    const outcome = await regenerateHouseholdInvite({
      household,
      currentUid,
      reservedForUid: activeInvite?.reservedForUid ?? null,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al regenerar código."));
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household) return;
    const trimmed = renameValue.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setActionError("El nombre debe tener entre 1 y 50 caracteres.");
      return;
    }

    setIsActionLoading(true);
    setActionError(null);

    const outcome = await renameHousehold({
      household,
      newName: trimmed,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsRenameOpen(false);
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al renombrar el hogar."));
    }
  };

  const handleLeavePause = async () => {
    if (!household || !currentMember || !userProfile) return;
    setIsActionLoading(true);
    setActionError(null);

    const outcome = await leaveHouseholdPause({
      household,
      member: currentMember,
      userProfile,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsPauseConfirmOpen(false);
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al pausar participación."));
    }
  };

  const handleReturnFromPause = async () => {
    if (!household || !currentMember || !userProfile) return;
    setIsActionLoading(true);
    setActionError(null);

    const outcome = await returnToHousehold({
      household,
      member: currentMember,
      otherMember,
      userProfile,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al regresar al hogar."));
    }
  };

  const handleLeavePermanently = async () => {
    if (!household || !currentMember || !userProfile) return;
    setIsActionLoading(true);
    setActionError(null);

    const outcome = await leaveHouseholdPermanently({
      household,
      member: currentMember,
      otherMember,
      otherUserProfile: null,
      userProfile,
    });

    setIsActionLoading(false);

    if (outcome.kind === "success") {
      setIsLeaveAllConfirmOpen(false);
      await reloadPersonal();
      await reloadHousehold();
    } else {
      setActionError(resolveOutcomeError(outcome, "Error al salir del hogar."));
    }
  };

  // ESTADO 1: SIN HOGAR (none)
  if (membershipState === "none" || !hasHousehold || !household) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Hogar
            </p>
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)]">
              Sin hogar todavía
            </h3>
            <p className="mt-1 text-xs text-[var(--fm-text-muted)]">
              Creá un espacio compartido para consolidar ingresos y gastos con tu pareja.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <FinanceButton
            size="default"
            tone="filled"
            onClick={() => {
              setActionError(null);
              setIsCreateOpen(true);
            }}
          >
            <Home className="mr-2 h-4 w-4" />
            Crear un hogar
          </FinanceButton>
          <FinanceButton
            size="default"
            tone="text"
            variant="ghost"
            onClick={() => {
              setActionError(null);
              setIsJoinOpen(true);
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Unirme con código
          </FinanceButton>
        </div>

        {/* Diálogo Crear Hogar */}
        <FinanceDialog
          open={isCreateOpen}
          subtitle="Define un nombre para tu espacio compartido."
          title="Crear un hogar"
          onClose={() => setIsCreateOpen(false)}
        >
          <form className="space-y-4" onSubmit={handleCreateHousehold}>
            {actionError && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                {actionError}
              </div>
            )}
            <FinanceTextField
              label="Nombre del hogar"
              placeholder="Ej. Casa, Hogar Gómez, Nuestro hogar..."
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <div className="flex gap-3 pt-2">
              <FinanceButton className="flex-1" type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </FinanceButton>
              <FinanceButton className="flex-1" disabled={!createName.trim() || isActionLoading} tone="filled" type="submit">
                {isActionLoading ? "Creando..." : "Crear hogar"}
              </FinanceButton>
            </div>
          </form>
        </FinanceDialog>

        {/* Diálogo Unirse con Código */}
        <FinanceDialog
          open={isJoinOpen}
          subtitle="Ingresa el código de 3 dígitos que te compartió tu pareja."
          title="Unirme a un hogar"
          onClose={() => setIsJoinOpen(false)}
        >
          <form className="space-y-4" onSubmit={handleJoinHousehold}>
            {actionError && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                {actionError}
              </div>
            )}
            <FinanceTextField
              label="Código de invitación (3 dígitos)"
              placeholder="000"
              maxLength={3}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <div className="flex gap-3 pt-2">
              <FinanceButton className="flex-1" type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>
                Cancelar
              </FinanceButton>
              <FinanceButton className="flex-1" disabled={joinCode.trim().length !== 3 || isActionLoading} tone="filled" type="submit">
                {isActionLoading ? "Uniéndose..." : "Unirme al hogar"}
              </FinanceButton>
            </div>
          </form>
        </FinanceDialog>
      </div>
    );
  }

  // ESTADO 2: ESPERANDO MIEMBRO B (waiting, DEC-068)
  if (household.status === "waiting") {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Hogar
            </p>
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)]">
              {household.name || "Hogar"} · Esperando a tu pareja
            </h3>
            <p className="mt-1 text-xs text-[var(--fm-text-muted)]">
              Comparte este código de 3 dígitos para que tu pareja se una al hogar.
            </p>
          </div>
        </div>

        {/* Tarjeta del Código de 3 dígitos */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[rgba(228,179,99,0.25)] bg-[rgba(228,179,99,0.06)] p-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-pending)]">
            Código de invitación (válido por 7 días)
          </span>
          <div className="font-[var(--font-display)] text-4xl font-bold tracking-widest text-[var(--fm-warm-paper)]">
            {household.activeInviteId || "---"}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <FinanceButton
              size="sm"
              tone="filled"
              onClick={() => handleCopyCode(household.activeInviteId || "")}
            >
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "¡Copiado!" : "Copiar código"}
            </FinanceButton>
            <FinanceButton
              disabled={isActionLoading}
              size="sm"
              variant="ghost"
              onClick={handleRegenerateInvite}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Regenerar
            </FinanceButton>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/6">
          <p className="text-xs text-[var(--fm-text-muted)]">
            Si ya no deseas esperar, puedes cancelar este hogar.
          </p>
          <FinanceButton
            size="sm"
            tone="text"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => setIsCancelWaitingConfirmOpen(true)}
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Cancelar hogar
          </FinanceButton>
        </div>

        {/* Confirmar Cancelar Hogar en Espera */}
        <FinanceDialog
          open={isCancelWaitingConfirmOpen}
          subtitle="La invitación activa quedará cancelada y podrás crear o unirte a otro hogar."
          title="¿Cancelar este hogar?"
          onClose={() => setIsCancelWaitingConfirmOpen(false)}
        >
          {actionError && (
            <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {actionError}
            </div>
          )}
          <div className="flex gap-3">
            <FinanceButton className="flex-1" variant="ghost" onClick={() => setIsCancelWaitingConfirmOpen(false)}>
              Volver
            </FinanceButton>
            <FinanceButton
              className="flex-1 bg-red-600 text-white hover:bg-red-500"
              disabled={isActionLoading}
              onClick={handleCancelWaiting}
            >
              {isActionLoading ? "Cancelando..." : "Sí, cancelar hogar"}
            </FinanceButton>
          </div>
        </FinanceDialog>
      </div>
    );
  }

  // ESTADO 3: EN PAUSA (waiting_return / membershipState == 'left')
  if (membershipState === "left" || (currentMember && currentMember.state === "left")) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Hogar
            </p>
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)]">
              {household.name || "Hogar"} · Participación en pausa
            </h3>
            <p className="mt-1 text-xs text-[var(--fm-text-muted)]">
              Pausaste tu participación en este hogar. Tu historial compartido se conserva intacto.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PauseCircle className="h-6 w-6 text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--fm-warm-paper)]">
                Puedes regresar en cualquier momento
              </p>
              <p className="text-xs text-[var(--fm-text-muted)]">
                No necesitas código: tu cuenta sigue vinculada a este hogar.
              </p>
            </div>
          </div>
          <FinanceButton
            disabled={isActionLoading}
            size="sm"
            tone="filled"
            onClick={handleReturnFromPause}
          >
            <PlayCircle className="mr-1.5 h-4 w-4" />
            Regresar al hogar
          </FinanceButton>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/6">
          <p className="text-xs text-[var(--fm-text-muted)]">
            O puedes desvincularte completamente para crear o unirte a otro hogar.
          </p>
          <FinanceButton
            size="sm"
            tone="text"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => setIsLeaveAllConfirmOpen(true)}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Salirme del todo
          </FinanceButton>
        </div>

        {/* Modal Salirme del Todo */}
        <FinanceDialog
          open={isLeaveAllConfirmOpen}
          subtitle="Te desvincularás por completo de este hogar. Tu historial compartido se preservará en el hogar. Si deseas volver más adelante, tu pareja deberá emitirte un código de reingreso."
          title="¿Salirte del todo del hogar?"
          onClose={() => setIsLeaveAllConfirmOpen(false)}
        >
          {actionError && (
            <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {actionError}
            </div>
          )}
          <div className="flex gap-3">
            <FinanceButton className="flex-1" variant="ghost" onClick={() => setIsLeaveAllConfirmOpen(false)}>
              Cancelar
            </FinanceButton>
            <FinanceButton
              className="flex-1 bg-red-600 text-white hover:bg-red-500"
              disabled={isActionLoading}
              onClick={handleLeavePermanently}
            >
              {isActionLoading ? "Saliendo..." : "Confirmar salida total"}
            </FinanceButton>
          </div>
        </FinanceDialog>
      </div>
    );
  }

  // ESTADO 4: ACTIVO (active, 2 miembros o 1 miembro activo + 1 plaza desvinculada reservada)
  return (
    <div className="space-y-5">
      {/* Encabezado con Nombre y Botón Renombrar (DEC-074) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
            Hogar compartido
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)]">
              {household.name || "Hogar compartido"}
            </h3>
            <button
              className="rounded-lg p-1 text-[var(--fm-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--fm-warm-paper)]"
              title="Renombrar hogar"
              type="button"
              onClick={() => {
                setRenameValue(household.name || "");
                setActionError(null);
                setIsRenameOpen(true);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Integrantes */}
      <div className="space-y-2">
        {members.map((member) => {
          const isSelf = member.userId === currentUid;
          return (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar
                  name={member.displayName}
                  photoURL={member.photoUrl}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--fm-warm-paper)]">
                    {member.displayName} {isSelf ? "(Tú)" : ""}
                  </p>
                  <p className="text-xs text-[var(--fm-text-muted)]">
                    {member.state === "active" ? "Miembro activo" : "En pausa"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Si hay código reservado para plaza desvinculada (DEC-076) */}
      {household.activeInviteId && activeInvite?.reservedForUid && (
        <div className="rounded-2xl border border-[rgba(228,179,99,0.25)] bg-[rgba(228,179,99,0.06)] p-4 text-center space-y-2">
          <p className="text-xs font-semibold text-[var(--fm-pending)]">
            Código de reingreso reservado para tu pareja
          </p>
          <div className="font-[var(--font-display)] text-3xl font-bold tracking-widest text-[var(--fm-warm-paper)]">
            {household.activeInviteId}
          </div>
          <div className="flex justify-center gap-2">
            <FinanceButton
              size="sm"
              tone="filled"
              onClick={() => handleCopyCode(household.activeInviteId || "")}
            >
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? "¡Copiado!" : "Copiar"}
            </FinanceButton>
            <FinanceButton
              disabled={isActionLoading}
              size="sm"
              variant="ghost"
              onClick={handleRegenerateInvite}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Regenerar
            </FinanceButton>
          </div>
        </div>
      )}

      {/* Acciones de Salida (DEC-075) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/6">
        <FinanceButton
          size="sm"
          variant="ghost"
          onClick={() => {
            setActionError(null);
            setIsPauseConfirmOpen(true);
          }}
        >
          <PauseCircle className="mr-1.5 h-4 w-4" />
          Salir (pausa)
        </FinanceButton>

        <FinanceButton
          size="sm"
          tone="text"
          variant="ghost"
          className="text-red-400 hover:text-red-300"
          onClick={() => {
            setActionError(null);
            setIsLeaveAllConfirmOpen(true);
          }}
        >
          <LogOut className="mr-1.5 h-4 w-4" />
          Salirme del todo
        </FinanceButton>
      </div>

      {/* Modal Renombrar */}
      <FinanceDialog
        open={isRenameOpen}
        subtitle="Cualquier miembro activo puede actualizar el nombre del hogar."
        title="Renombrar hogar"
        onClose={() => setIsRenameOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleRename}>
          {actionError && (
            <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {actionError}
            </div>
          )}
          <FinanceTextField
            label="Nombre del hogar"
            placeholder="Ej. Casa, Nuestro hogar..."
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <FinanceButton className="flex-1" type="button" variant="ghost" onClick={() => setIsRenameOpen(false)}>
              Cancelar
            </FinanceButton>
            <FinanceButton className="flex-1" disabled={!renameValue.trim() || isActionLoading} tone="filled" type="submit">
              {isActionLoading ? "Guardando..." : "Guardar nombre"}
            </FinanceButton>
          </div>
        </form>
      </FinanceDialog>

      {/* Modal Salir (Pausa) */}
      <FinanceDialog
        open={isPauseConfirmOpen}
        subtitle="Tu participación se pausará temporalmente. El historial compartido se preserva y podrás regresar cuando quieras sin necesidad de código."
        title="¿Pausar tu participación en el hogar?"
        onClose={() => setIsPauseConfirmOpen(false)}
      >
        {actionError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            {actionError}
          </div>
        )}
        <div className="flex gap-3">
          <FinanceButton className="flex-1" variant="ghost" onClick={() => setIsPauseConfirmOpen(false)}>
            Cancelar
          </FinanceButton>
          <FinanceButton
            className="flex-1 bg-yellow-600 text-white hover:bg-yellow-500"
            disabled={isActionLoading}
            onClick={handleLeavePause}
          >
            {isActionLoading ? "Pausando..." : "Pausar participación"}
          </FinanceButton>
        </div>
      </FinanceDialog>

      {/* Modal Salirme del Todo */}
      <FinanceDialog
        open={isLeaveAllConfirmOpen}
        subtitle="Te desvincularás por completo de este hogar. Tu historial compartido se preservará en el hogar. Si deseas volver más adelante, tu pareja deberá emitirte un código de reingreso."
        title="¿Salirte del todo del hogar?"
        onClose={() => setIsLeaveAllConfirmOpen(false)}
      >
        {actionError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            {actionError}
          </div>
        )}
        <div className="flex gap-3">
          <FinanceButton className="flex-1" variant="ghost" onClick={() => setIsLeaveAllConfirmOpen(false)}>
            Cancelar
          </FinanceButton>
          <FinanceButton
            className="flex-1 bg-red-600 text-white hover:bg-red-500"
            disabled={isActionLoading}
            onClick={handleLeavePermanently}
          >
            {isActionLoading ? "Saliendo..." : "Confirmar salida total"}
          </FinanceButton>
        </div>
      </FinanceDialog>
    </div>
  );
}
