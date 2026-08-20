import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  Home,
  List,
  Settings2,
} from "lucide-react";

export type PersonalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const personalNavigationItems: PersonalNavItem[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: Home,
  },
  {
    href: "/movements",
    label: "Movimientos",
    icon: List,
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings2,
  },
];

/**
 * Ítem del menú que debe pintarse activo para una ruta dada.
 *
 * Match por prefijo — necesario desde que el detalle de cuenta es su propia
 * pantalla (`/accounts/{accountId}`) y debe mantener "Cuentas" activo — pero
 * quedándose SIEMPRE con el href más específico: en `/household/settings` gana
 * "Ajustes", no "Inicio" de Hogar. Se exige la barra final para que
 * `/household-otro` nunca cuente como sub-ruta de `/household`.
 *
 * Devuelve `null` cuando ninguna entrada corresponde (p. ej. `/design-system`).
 */
export const resolveActiveNavHref = (
  pathname: string | null | undefined,
  items: readonly { href: string }[],
): string | null => {
  if (!pathname) return null;

  return items.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return best === null || item.href.length > best.length ? item.href : best;
  }, null);
};

export type HouseholdNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const householdNavigationItems: HouseholdNavItem[] = [
  {
    href: "/household",
    label: "Inicio",
    icon: Home,
  },
  {
    href: "/household/movements",
    label: "Movimientos",
    icon: List,
  },
  {
    href: "/household/categories",
    label: "Gastos por categoria",
    icon: CircleDollarSign,
  },
  {
    href: "/household/settings",
    label: "Ajustes",
    icon: Settings2,
  },
];
