import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CarTaxiFront,
  CircleHelp,
  CreditCard,
  HandCoins,
  House,
  Landmark,
  PiggyBank,
  ShoppingBasket,
  UtensilsCrossed,
  Wallet,
  Zap,
  Coins,
} from "lucide-react";

import type { Account } from "@/types/account";
import type { TransactionType } from "@/types/transaction";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

type VisualTone = {
  accent: string;
  accentSoft: string;
  icon: LucideIcon;
};

const categoryPalette = [
  "#e4b363",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#4fd1c5",
  "#94a3b8",
];

const toneByTransactionType: Record<TransactionType, VisualTone> = {
  income: {
    accent: "#34d399",
    accentSoft: "rgba(52,211,153,0.14)",
    icon: BriefcaseBusiness,
  },
  expense: {
    accent: "#fb7185",
    accentSoft: "rgba(251,113,133,0.14)",
    icon: Banknote,
  },
  transfer: {
    accent: "#60a5fa",
    accentSoft: "rgba(96,165,250,0.14)",
    icon: ArrowLeftRight,
  },
  reimbursement: {
    accent: "#94a3b8",
    accentSoft: "rgba(148,163,184,0.14)",
    icon: HandCoins,
  },
  pending: {
    accent: "#e4b363",
    accentSoft: "rgba(228,179,99,0.16)",
    icon: CircleHelp,
  },
};

const normalizeValue = (value: string): string => value.toLowerCase().trim();

// WPP-014 — mapa de iconKey (Android/Web) a ícono Lucide.
const iconKeyToLucide: Record<string, LucideIcon> = {
  bank: Landmark,
  bank_generic: Landmark,
  wallet: Wallet,
  cash: Coins,
  savings: PiggyBank,
  account: Building2,
  credit_card: CreditCard,
  digital_wallet: Wallet,
  other: Building2,
};

const pickCategoryIcon = (value: string): LucideIcon => {
  const normalized = normalizeValue(value);

  if (normalized.includes("comida") || normalized.includes("restaur")) {
    return UtensilsCrossed;
  }
  if (normalized.includes("transporte") || normalized.includes("moto") || normalized.includes("uber")) {
    return CarTaxiFront;
  }
  if (normalized.includes("servicio") || normalized.includes("factura") || normalized.includes("suscrip")) {
    return Zap;
  }
  if (normalized.includes("mercado") || normalized.includes("compra")) {
    return ShoppingBasket;
  }
  if (normalized.includes("hogar") || normalized.includes("arriendo")) {
    return House;
  }

  return CircleHelp;
};

export const getCategoryVisual = (
  name: string,
  index: number,
  color?: string,
  iconKey?: string,
  type: "expense" | "income" | string = "expense"
): VisualTone => {
  const accent = color || categoryPalette[index % categoryPalette.length];
  return {
    accent,
    accentSoft: `${accent}22`,
    icon: iconKey ? resolveCategoryIcon(iconKey, type) : pickCategoryIcon(name),
  };
};

const deriveAccentFromType = (account: Account): string => {
  const normalizedName = normalizeValue(account.name);
  const normalizedType = normalizeValue(account.type);

  if (normalizedType.includes("cash") || normalizedName.includes("efectivo")) return "#e4b363";
  if (normalizedName.includes("nequi") || normalizedName.includes("davi") || normalizedType.includes("wallet")) return "#a78bfa";
  if (normalizedType.includes("saving") || normalizedName.includes("ahorro")) return "#6c8e7f";
  if (normalizedType.includes("bank")) return "#60a5fa";
  return "#94a3b8";
};

const deriveIconFromType = (account: Account): LucideIcon => {
  const normalizedName = normalizeValue(account.name);
  const normalizedType = normalizeValue(account.type);

  if (normalizedType.includes("cash") || normalizedName.includes("efectivo")) return Wallet;
  if (normalizedName.includes("nequi") || normalizedName.includes("davi") || normalizedType.includes("wallet")) return CreditCard;
  if (normalizedType.includes("saving") || normalizedName.includes("ahorro")) return PiggyBank;
  if (normalizedType.includes("bank")) return Landmark;
  return Building2;
};

export const getAccountVisual = (account: Account): VisualTone => {
  // WPP-014 — usar color/icono real de la cuenta cuando están disponibles (set desde create-account o Android).
  const accent = account.color || deriveAccentFromType(account);
  const accentSoft = `${accent}22`;
  const icon: LucideIcon = iconKeyToLucide[account.iconKey] ?? deriveIconFromType(account);

  return { accent, accentSoft, icon };
};

export const getTransactionVisual = (type: TransactionType, label: string): VisualTone => {
  if (type === "expense") {
    return {
      accent: getCategoryVisual(label, 0).accent,
      accentSoft: getCategoryVisual(label, 0).accentSoft,
      icon: pickCategoryIcon(label),
    };
  }

  return toneByTransactionType[type];
};
