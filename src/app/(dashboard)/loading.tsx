import { FinanceShimmer } from "@/components/finance/finance-shimmer";

/**
 * Estado de carga de la navegación entre secciones Personales.
 *
 * Next lo muestra en cuanto se pulsa un enlace, sin esperar a que el código de
 * la sección destino esté listo. Sin este archivo, la pantalla anterior se
 * quedaba congelada hasta que la nueva podía renderizar: el clic parecía no
 * hacer nada. Ahora la sección cambia al instante y el esqueleto ocupa el sitio
 * mientras llega lo demás.
 *
 * Vive DENTRO del layout del grupo, así que la barra lateral y la superior no
 * parpadean: solo se sustituye el área de contenido.
 *
 * Cubre la fase de navegación. La carga de DATOS tiene su propio esqueleto en
 * `DashboardShell`, y por eso los dos se parecen: el paso de uno a otro no debe
 * notarse.
 */
export default function DashboardSectionLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando sección…</span>
      <FinanceShimmer className="h-40 w-full rounded-[32px]" />
      <FinanceShimmer className="h-72 w-full rounded-[32px]" />
    </div>
  );
}
