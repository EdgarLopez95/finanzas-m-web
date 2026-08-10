"use client";

/**
 * src/components/finance/account-icon.tsx
 *
 * Renderizador único y reutilizable de ícono de cuenta.
 * Muestra:
 *  - Logo de marca (img tag, sin tint) si iconType === "bank_logo" y el logo existe.
 *  - Ícono genérico Lucide en círculo con color si iconType === "generic" (o fallback).
 *
 * Compatible con cuentas antiguas: maneja iconKeys legados (bank, account, wallet, etc.)
 */

import { Building2, Coins, Landmark, MoreHorizontal, PiggyBank, TrendingUp, Flag, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { resolveAccountLogoSrc } from "@/lib/accounts/account-visual-catalog";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Mapa de iconKey genérico → componente Lucide
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_ICON_MAP: Record<string, LucideIcon> = {
  // Claves primarias del catálogo Bloque 4
  cash:           Coins,
  wallet:         Wallet,
  savings:        PiggyBank,
  cdt:            Landmark,
  investment:     TrendingUp,
  fund:           PiggyBank,
  goal:           Flag,
  savings_other:  MoreHorizontal,
  other:          MoreHorizontal,
  bank_generic:   Landmark,

  // Claves legadas (cuentas creadas antes del Bloque 4)
  bank:           Landmark,
  account:        Building2,
  digital_wallet: Wallet,
  credit_card:    Landmark,
  piggy:          PiggyBank,
  general:        Wallet,
  card:           Landmark,
  box:            Building2,
  coins:          Coins,
  home:           Building2,
  work:           Building2,
  pocket:         Wallet,
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type AccountIconSize = "xs" | "sm" | "md" | "lg";

type AccountIconProps = {
  iconType: string;         // "bank_logo" | "generic"
  iconKey: string | null;   // "bancolombia" | "cash" | "wallet" | ...
  color?: string;           // hex — para el círculo genérico
  size?: AccountIconSize;
  className?: string;
  alt?: string;
};

// Dimensiones en px para cada size
const SIZE_CONFIG: Record<AccountIconSize, { container: string; img: string; icon: string }> = {
  xs: { container: "h-6 w-6",   img: "h-6 w-6",   icon: "h-3 w-3"   },
  sm: { container: "h-7 w-7",   img: "h-7 w-7",   icon: "h-3.5 w-3.5"},
  md: { container: "h-9 w-9",   img: "h-9 w-9",   icon: "h-4.5 w-4.5"},
  lg: { container: "h-12 w-12", img: "h-12 w-12", icon: "h-6 w-6"   },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AccountIcon({
  iconType,
  iconKey,
  color,
  size = "md",
  className,
  alt,
}: AccountIconProps) {
  const sizes = SIZE_CONFIG[size];
  const key = iconKey ?? "";

  // ── Logo de marca ──────────────────────────────────────────────────────────
  if (iconType === "bank_logo") {
    const logoSrc = resolveAccountLogoSrc(key);
    if (logoSrc) {
      return (
        <img
          src={logoSrc}
          alt={alt ?? key}
          className={cn(
            sizes.img,
            "shrink-0 rounded-[8px] object-contain",
            className,
          )}
          // No color tint for brand logos — shown as-is per Android behavior
        />
      );
    }
    // Fallback: icono genérico de banco si el logo no existe
    return (
      <GenericIconCircle
        Icon={Landmark}
        color={color}
        sizes={sizes}
        className={className}
      />
    );
  }

  // ── Icono genérico ─────────────────────────────────────────────────────────
  const Icon = GENERIC_ICON_MAP[key] ?? Building2;
  return (
    <GenericIconCircle
      Icon={Icon}
      color={color}
      sizes={sizes}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: círculo con ícono Lucide
// ─────────────────────────────────────────────────────────────────────────────

function GenericIconCircle({
  Icon,
  color,
  sizes,
  className,
}: {
  Icon: LucideIcon;
  color?: string;
  sizes: { container: string; icon: string };
  className?: string;
}) {
  const accent = color ?? "#94a3b8";
  return (
    <div
      className={cn(
        "shrink-0 grid place-items-center rounded-full border",
        sizes.container,
        className,
      )}
      style={{
        backgroundColor: `${accent}22`,
        borderColor: `${accent}33`,
        color: accent,
      }}
    >
      <Icon className={sizes.icon} />
    </div>
  );
}
