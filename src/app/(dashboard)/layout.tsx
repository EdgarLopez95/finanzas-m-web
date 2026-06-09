import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * Layout compartido del grupo (dashboard). Mantiene la carcasa (sidebar, topbar,
 * paneles, carga de datos) montada al navegar entre secciones: solo se
 * intercambia el contenido de cada página, por lo que el cambio es instantáneo.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
