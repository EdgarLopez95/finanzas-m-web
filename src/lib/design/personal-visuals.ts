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
} from "lucide-react";

import type { Account } from "@/types/account";
import type { TransactionType } from "@/types/transaction";

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

export const getCategoryVisual = (name: string, index: number): VisualTone => {
  const accent = categoryPalette[index % categoryPalette.length];
  return {
    accent,
    accentSoft: `${accent}22`,
    icon: pickCategoryIcon(name),
  };
};

export const getAccountVisual = (account: Account): VisualTone => {
  const normalizedName = normalizeValue(account.name);
  const normalizedType = normalizeValue(account.type);

  if (normalizedType.includes("cash") || normalizedName.includes("efectivo")) {
    return {
      accent: "#e4b363",
      accentSoft: "rgba(228,179,99,0.14)",
      icon: Wallet,
    };
  }

  if (normalizedName.includes("nequi") || normalizedName.includes("davi") || normalizedType.includes("wallet")) {
    return {
      accent: "#a78bfa",
      accentSoft: "rgba(167,139,250,0.14)",
      icon: CreditCard,
    };
  }

  if (normalizedType.includes("saving") || normalizedName.includes("ahorro")) {
    return {
      accent: "#6c8e7f",
      accentSoft: "rgba(108,142,127,0.16)",
      icon: PiggyBank,
    };
  }

  if (normalizedType.includes("bank")) {
    return {
      accent: "#60a5fa",
      accentSoft: "rgba(96,165,250,0.14)",
      icon: Landmark,
    };
  }

  return {
    accent: "#94a3b8",
    accentSoft: "rgba(148,163,184,0.14)",
    icon: Building2,
  };
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
