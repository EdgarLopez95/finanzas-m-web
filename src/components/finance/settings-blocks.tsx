import React from "react";
import { ChevronRight, AlertTriangle, LogOut, Cloud, LayoutGrid, Tag, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceButton } from "@/components/finance/finance-button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useRouter } from "next/navigation";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

// ─── Shared UI Elements ──────────────────────────────────────────────────────

export const Toggle = ({
  checked,
  label,
  onToggle,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) => {
  const TagEl = disabled ? "div" : "button";
  return (
    <TagEl
      type={disabled ? undefined : "button"}
      aria-label={label}
      aria-pressed={checked}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-white/8 bg-[rgba(28,37,55,0.94)] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]",
        disabled ? "opacity-30 cursor-default" : "cursor-pointer"
      )}
    >
      <span
        className="absolute inset-y-1 left-1 w-6 rounded-full bg-[var(--fm-warm-paper)] transition-transform"
        style={{
          transform: checked ? "translateX(1.45rem)" : "translateX(0)",
          background: checked ? "var(--fm-pending)" : "var(--fm-warm-paper)",
        }}
      />
    </TagEl>
  );
};

export type SettingItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  sincronizado?: boolean;
};

export function SettingItem({
  icon,
  title,
  description,
  badge,
  onClick,
  disabled = false,
  destructive = false,
  sincronizado = false,
}: SettingItemProps) {
  const isClickable = Boolean(onClick) && !disabled;
  const TagEl = isClickable ? "button" : "div";

  return (
    <TagEl
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "w-full text-left flex items-center justify-between p-4 rounded-[20px] border transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
        sincronizado
          ? "border-[rgba(52,211,153,0.1)] bg-[rgba(52,211,153,0.04)] cursor-default"
          : isClickable
          ? destructive
            ? "border-[rgba(239,68,68,0.12)] bg-[rgba(239,68,68,0.02)] hover:bg-[rgba(239,68,68,0.06)] active:bg-[rgba(239,68,68,0.08)] cursor-pointer"
            : "border-white/5 bg-white/[0.01] hover:bg-white/[0.04] active:bg-white/5 cursor-pointer"
          : destructive
          ? "border-red-500/10 bg-red-500/[0.01] opacity-65 cursor-default"
          : "border-white/5 bg-white/[0.01] opacity-65 cursor-default",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            destructive
              ? "bg-red-500/10 text-red-400"
              : sincronizado
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/[0.04] text-[var(--fm-text-soft)]"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p
            className={cn(
              "font-semibold text-sm truncate",
              destructive ? "text-red-400" : sincronizado ? "text-emerald-400" : "text-[var(--fm-warm-paper)]"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-xs truncate",
              destructive ? "text-red-400/60" : sincronizado ? "text-emerald-400/60" : "text-[var(--fm-text-muted)]"
            )}
          >
            {description}
          </p>
        </div>
      </div>

      {badge ? (
        <div
          className={cn(
            "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider select-none shrink-0 border",
            badge.includes("NO DISPONIBLE") || destructive
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-white/10 border-white/10 text-[var(--fm-text-soft)]"
          )}
        >
          {badge}
        </div>
      ) : (
        isClickable && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              destructive ? "text-red-400/50" : "text-[var(--fm-text-muted)]"
            )}
          />
        )
      )}
    </TagEl>
  );
}

// ─── Shared Blocks ───────────────────────────────────────────────────────────

/**
 * Cabecera de identidad de Ajustes — NO es una card de configuración.
 *
 * Abre la página a ancho completo (ver `SettingsLayout`) y representa "mi
 * cuenta", frente a la card Hogar ("nuestro espacio compartido") y a
 * Preferencias/Organización (ajustes del producto). Por eso no lleva heading
 * "Perfil" equivalente al de las otras cards, no encierra la identidad en un
 * segundo rectángulo y no expone ninguna acción: es informativa de punta a
 * punta. La moneda es metadata pasiva mientras el producto sea COP-only.
 */
export function SettingsProfileCard({
  userName,
  userEmail,
  userPhotoURL,
}: {
  userName?: string | null;
  userEmail?: string | null;
  userPhotoURL?: string | null;
}) {
  return (
    <section className="rounded-[var(--fm-radius-card-medium)] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-6 sm:px-8 sm:py-7">
      {/* Asimetría deliberada: la identidad domina, la moneda es metadata. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <ProfileAvatar
            name={userName}
            photoURL={userPhotoURL}
            size="xl"
            decorative
            className="bg-[linear-gradient(180deg,rgba(85,104,138,0.92),rgba(41,53,80,0.92))] font-[var(--font-display)] text-[var(--fm-warm-paper)] ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Tu cuenta
            </p>
            <p className="mt-1 truncate font-[var(--font-display)] text-[30px] font-semibold leading-tight tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              {userName || "Usuario"}
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--fm-text-muted)]">
              {userEmail || "Cargando perfil..."}
            </p>
          </div>
        </div>

        <div className="border-t border-white/6 pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
            Moneda de la app
          </p>
          <p className="mt-1.5 flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
              COP
            </span>
            <span className="text-sm text-[var(--fm-text-muted)]">Peso colombiano</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function SettingsPreferencesCard({
  masked,
  notificationsEnabled,
  onToggleMasked,
  onToggleNotifications,
}: {
  masked: boolean;
  notificationsEnabled: boolean;
  onToggleMasked: () => void;
  onToggleNotifications: () => void;
}) {
  return (
    <FinanceCard className="h-full border-white/8 bg-[rgba(18,25,39,0.96)]" title="Preferencias" variant="default">
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2.5">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[var(--fm-warm-paper)]">Ocultar saldos al abrir</p>
            <p className="text-xs text-[var(--fm-text-muted)]">Empieza con los montos protegidos</p>
          </div>
          <Toggle checked={masked} label="Ocultar saldos al abrir" onToggle={onToggleMasked} />
        </div>
        <div className="flex items-center justify-between py-2.5">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[var(--fm-warm-paper)]">Notificaciones</p>
            <p className="text-xs text-[var(--fm-text-muted)]">Recordatorios de pendientes del Hogar (No disponible en web)</p>
          </div>
          <Toggle checked={notificationsEnabled} label="Notificaciones" onToggle={onToggleNotifications} disabled={true} />
        </div>
      </div>
    </FinanceCard>
  );
}

export function SettingsOrganizationCard() {
  const router = useRouter();
  const setEditingBoard = useUiPreferencesStore((s) => s.setEditingBoard);

  return (
    <FinanceCard className="h-full border-white/8 bg-[rgba(18,25,39,0.96)]" title="Organización" variant="default">
      <div className="space-y-3">
        <SettingItem
          icon={<Tag className="h-5 w-5" />}
          title="Administrar categorías"
          description="Crea, edita y archiva tus categorías personales."
          onClick={() => router.push("/categories")}
        />
        <SettingItem
          icon={<CreditCard className="h-5 w-5" />}
          title="Administrar cuentas"
          description="Crea, edita y archiva tus cuentas personales informativas."
          onClick={() => router.push("/accounts")}
        />
        <SettingItem
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Cards de Inicio"
          description="Decide qué aparece y en qué orden en tu pantalla principal."
          onClick={() => {
            setEditingBoard(true);
            router.push("/dashboard");
          }}
        />
      </div>
    </FinanceCard>
  );
}

export function SettingsFooter({
  onOpenReset,
  onLogout,
}: {
  onOpenReset: () => void;
  onLogout: () => void;
}) {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Sincronización */}
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Sincronización" variant="default">
        <div className="space-y-3">
          <SettingItem
            icon={<Cloud className="h-5 w-5" />}
            title="Sincronización en vivo"
            description="Tus cambios se guardan y sincronizan en la nube de Finanzas M+."
          />
        </div>
      </FinanceCard>

      {/* Zona peligrosa */}
      <FinanceCard className="border-red-500/15 bg-[rgba(239,68,68,0.02)]" title="Zona peligrosa" variant="default">
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          <SettingItem
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Reiniciar cuenta"
            description="Restablece tu cuenta al estado inicial (movimientos, cuentas, categorías y Hogar)."
            onClick={onOpenReset}
            destructive={true}
          />
          <SettingItem
            icon={<LogOut className="h-5 w-5" />}
            title="Cerrar sesión"
            description="Salir de tu cuenta en este dispositivo."
            onClick={() => setLogoutConfirmOpen(true)}
            destructive={true}
          />
        </div>
      </FinanceCard>
      {logoutConfirmOpen && (
        <FinanceDialog
          open={logoutConfirmOpen}
          title="Cerrar sesión"
          onClose={() => setLogoutConfirmOpen(false)}
        >
          <div className="space-y-6 pt-2">
            <p className="text-sm text-[var(--fm-text-muted)]">Vas a cerrar tu sesión en este dispositivo. Tendrás que volver a iniciar sesión para entrar a la app.</p>
            <div className="flex gap-3 justify-end">
              <FinanceButton tone="text" variant="ghost" onClick={() => setLogoutConfirmOpen(false)}>Cancelar</FinanceButton>
              <FinanceButton tone="destructive" onClick={() => { setLogoutConfirmOpen(false); onLogout(); }}>Cerrar sesión</FinanceButton>
            </div>
          </div>
        </FinanceDialog>
      )}
    </div>
  );
}
