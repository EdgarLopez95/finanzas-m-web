"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { personalNavigationItems, householdNavigationItems, resolveActiveNavHref } from "@/components/layout/navigation";
import { cn } from "@/lib/utils";
import type { AppContext } from "@/lib/navigation/app-context";
import { useAppContextStore } from "@/stores/app-context-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

type SidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
  userPhotoURL?: string | null;
  movementCount?: number;
};

/**
 * Paso 8A — frontera visual del chrome lateral. Cada contexto define su propia
 * paleta de roles y ninguna rama lee tokens de la otra.
 */
// #region PERSONAL
const PERSONAL_SIDEBAR_STYLES = {
  aside: "bg-[linear-gradient(180deg,rgba(15,22,35,0.98),rgba(11,17,28,0.98))] lg:border-r-white/7",
  toggleShell: "border-[rgba(124,145,181,0.14)] bg-[rgba(17,24,36,0.74)]",
  toggleActive: "bg-[rgba(34,49,76,0.98)] text-[var(--fm-warm-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]",
  toggleIdle: "text-[#8da0bd] hover:bg-white/4 hover:text-[var(--fm-warm-paper)]",
  focusRing: "focus-visible:ring-[var(--fm-transfer)]",
  sectionLabel: "text-[#6f809b]",
  navActive: "bg-[rgba(31,45,69,0.96)] text-[var(--fm-warm-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.025)]",
  navIdle: "text-[#91a2bb] hover:bg-white/4 hover:text-[var(--fm-warm-paper)]",
  navIconActive: "text-[var(--fm-pending)]",
  navIconIdle: "text-[#788aa6] group-hover:text-[#96a8c0]",
  badge: "bg-[rgba(36,50,74,0.95)] text-[#c4d3e7]",
  footerBorder: "border-white/7",
  avatar: "bg-[linear-gradient(180deg,rgba(76,95,128,0.96),rgba(46,58,82,0.96))] text-[var(--fm-warm-paper)]",
  userName: "text-[var(--fm-warm-paper)]",
  userEmail: "text-[#7385a0]",
} as const;
// #endregion PERSONAL

// #region HOGAR
const HOUSEHOLD_SIDEBAR_STYLES = {
  aside: "bg-[linear-gradient(180deg,var(--hh-background-dark),var(--hh-background))] lg:border-r-[var(--hh-border)]",
  toggleShell: "border-[var(--hh-border)] bg-[var(--hh-surface)]",
  // Paso 9 / QA-001: paridad con FinanzasHomeContextVisuals.household()
  // (householdToggleSelectedBackground/Border = Sage.copy(alpha 0.22/0.48)).
  toggleActive: "bg-[var(--hh-sage-accent)]/22 border border-[var(--hh-sage-accent)]/48 text-[var(--hh-text)]",
  toggleIdle: "text-[var(--hh-text-muted)] hover:bg-[var(--hh-surface-elevated)] hover:text-[var(--hh-text)]",
  focusRing: "focus-visible:ring-[var(--hh-focus-ring)]",
  sectionLabel: "text-[var(--hh-text-muted)]",
  navActive: "bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]",
  navIdle: "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface)] hover:text-[var(--hh-text)]",
  navIconActive: "text-[var(--hh-primary-action)]",
  navIconIdle: "text-[var(--hh-text-muted)] group-hover:text-[var(--hh-text-secondary)]",
  badge: "bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]",
  footerBorder: "border-[var(--hh-border)]",
  avatar: "bg-[var(--hh-primary)] text-[var(--hh-text)]",
  userName: "text-[var(--hh-text)]",
  userEmail: "text-[var(--hh-text-muted)]",
} as const;
// #endregion HOGAR

export function Sidebar({ userName, userEmail, userPhotoURL, movementCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Paso 6 + corrección P0 Paso 9: el store es la ÚNICA autoridad del
  // contexto activo. La URL no debe desempatar ni pintar el sidebar —
  // `resolveContextForPath` sigue siendo válido para redirecciones y
  // recuperación de rutas (app-context.ts), pero no aquí.
  const storeContext = useAppContextStore((state) => state.activeContext);
  const requestContextSwitch = useAppContextStore((state) => state.requestContextSwitch);
  const activeContext = storeContext;
  const personalIsActive = activeContext === "personal";
  const activeNavHref = resolveActiveNavHref(
    pathname,
    personalIsActive ? personalNavigationItems : householdNavigationItems,
  );

  const handleContextSwitch = (target: AppContext) => {
    const decision = requestContextSwitch(target, pathname);
    if (decision.changed) {
      router.push(decision.href);
    }
  };
  const activeHouseholdId = useHouseholdDataStore((state) => state.data.activeHouseholdId);
  // Paridad Android: el switch Personal/Hogar solo existe con Hogar activo.
  // Crear/unirse a un Hogar vive en Ajustes Personal, no como onboarding
  // visible en este switch — sin excepción de onboarding.
  const showHouseholdToggle = activeHouseholdId !== null;

  // Dos ramas visuales reales. Personal conserva el chrome navy del kit
  // Finance; Hogar consume únicamente roles `--hh-*`. Ninguna toca a la otra.
  const styles = personalIsActive ? PERSONAL_SIDEBAR_STYLES : HOUSEHOLD_SIDEBAR_STYLES;

  return (
    <aside className={cn("flex h-full min-h-[calc(100vh-2rem)] flex-col px-4 py-5 lg:min-h-screen lg:border-r lg:px-5 lg:py-6", styles.aside)}>
      <Link className="block px-2" href="/dashboard">
        <Image
          alt="Finanzas M"
          className="h-auto w-full max-w-[190px]"
          height={61}
          priority
          src="/brand/logo-white-text.svg"
          width={244}
        />
      </Link>

      {showHouseholdToggle && (
        <div className={cn("mt-7 rounded-[18px] border p-1", styles.toggleShell)}>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              aria-pressed={personalIsActive}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2",
                styles.focusRing,
                personalIsActive ? styles.toggleActive : styles.toggleIdle,
              )}
              onClick={() => handleContextSwitch("personal")}
            >
              Personal
            </button>
            <button
              type="button"
              aria-pressed={!personalIsActive}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2",
                styles.focusRing,
                !personalIsActive ? styles.toggleActive : styles.toggleIdle,
              )}
              onClick={() => handleContextSwitch("household")}
            >
              Hogar
            </button>
          </div>
        </div>
      )}

      <div className="mt-10 px-2">
        <p className={cn("text-[11px] uppercase tracking-[0.26em]", styles.sectionLabel)}>Menú</p>
      </div>

      <nav aria-label={personalIsActive ? "Personal" : "Hogar"} className="mt-5 flex flex-col gap-1">
        {(personalIsActive ? personalNavigationItems : householdNavigationItems).map((item) => {
          // Solo el ítem MÁS específico queda activo (`resolveActiveNavHref`),
          // para que `/accounts/{id}` marque Cuentas sin que `/household`
          // quede también marcado desde `/household/settings`.
          const isActive = item.href === activeNavHref;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex min-h-[46px] items-center gap-3 rounded-[16px] px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-2",
                styles.focusRing,
                isActive ? styles.navActive : styles.navIdle,
              )}
              data-nav-item
              href={item.href}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center transition-colors",
                  isActive ? styles.navIconActive : styles.navIconIdle,
                )}
              >
                <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
              </span>
              <span className={cn("flex-1", isActive ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {item.href === "/movements" ? (
                <span
                  className={cn(
                    "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    styles.badge,
                  )}
                >
                  {movementCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className={cn("mt-auto border-t px-2 pt-5", styles.footerBorder)}>
        <div className="flex items-center gap-3 py-1">
          <ProfileAvatar name={userName} photoURL={userPhotoURL} size="md" className={styles.avatar} />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-semibold", styles.userName)}>
              {userName || "Sesion activa"}
            </p>
            <p className={cn("truncate text-xs", styles.userEmail)}>{userEmail || "Google Auth"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
