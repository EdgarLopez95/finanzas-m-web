import { cn } from "@/lib/utils";

type TopBarProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  context?: "personal" | "household";
};

/**
 * Paso 9 — antes de esta corrección, TopBar era un chrome único sin adaptar
 * a contexto: se monta desde AppShell en las 4 rutas Hogar
 * (`/household`, `/household/movements`, `/household/settings`,
 * `/household/categories`) igual que en Personal, pero siempre con
 * `--fm-*`/`rgba()` — nunca se veía Hogar. Ahora ramifica por `context`,
 * igual que Sidebar/DashboardShell.
 */
// #region PERSONAL
const PERSONAL_TOP_BAR_STYLES = {
  header: "border-[rgba(148,163,184,0.12)] bg-[rgba(9,14,24,0.92)]",
  title: "text-[var(--fm-warm-paper)]",
  subtitle: "text-[var(--fm-text-muted)]",
} as const;
// #endregion PERSONAL

// #region HOGAR
const HOUSEHOLD_TOP_BAR_STYLES = {
  header: "border-[var(--hh-border)]/40 bg-[var(--hh-surface)]/92",
  title: "text-[var(--hh-text)]",
  subtitle: "text-[var(--hh-text-muted)]",
} as const;
// #endregion HOGAR

export function TopBar({ title, subtitle, actions, context = "personal" }: TopBarProps) {
  const styles = context === "household" ? HOUSEHOLD_TOP_BAR_STYLES : PERSONAL_TOP_BAR_STYLES;

  return (
    <header className={cn("border-b px-4 py-4 backdrop-blur-xl md:px-6 lg:px-8", styles.header)}>
      <div className="flex min-h-[3.75rem] flex-col gap-4 lg:min-h-[4.25rem] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5">
          <h1 className={cn("font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] lg:text-[2.15rem]", styles.title)}>
            {title}
          </h1>
          {subtitle ? (
            <p className={cn("text-sm", styles.subtitle)}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
