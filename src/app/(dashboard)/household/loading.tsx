import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";

/**
 * Estado de carga de la navegación dentro del ambiente Hogar.
 *
 * Mismo propósito que el del grupo Personal, pero con los tokens de Hogar
 * (`--hh-*`): al entrar a una sección compartida el esqueleto ya debe verse del
 * color del ambiente, no del Personal. Un esqueleto con el tono equivocado se
 * lee como un parpadeo de contexto.
 *
 * Al estar en `household/`, Next lo prefiere sobre el del grupo para todas las
 * rutas de Hogar.
 */
export default function HouseholdSectionLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando sección de Hogar…</span>
      <HouseholdShimmer className="h-40 w-full rounded-[32px]" />
      <HouseholdShimmer className="h-72 w-full rounded-[32px]" />
    </div>
  );
}
