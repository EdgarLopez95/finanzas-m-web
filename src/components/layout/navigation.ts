import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  CreditCard,
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
    href: "/accounts",
    label: "Cuentas",
    icon: CreditCard,
  },
  {
    href: "/categories",
    label: "Gastos por categoria",
    icon: CircleDollarSign,
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings2,
  },
];
