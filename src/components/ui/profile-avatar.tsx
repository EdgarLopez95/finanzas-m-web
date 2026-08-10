"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Avatar de perfil reutilizable — foto de Google con fallback silencioso a
 * iniciales. Vive fuera de `src/components/finance/**` a propósito: tanto
 * Personal como Hogar lo importan, y ninguna superficie Hogar puede importar
 * de `finance/**` (contrato ya exigido por `household-theme-token.test.ts`).
 * No lleva tokens `--fm-*`/`--hh-*` propios — el color/fondo del círculo de
 * iniciales lo decide el caller vía `className`, para respetar la frontera
 * visual de cada contexto.
 *
 * Contrato:
 * - Si `photoURL` es una URL no vacía y la imagen carga bien, se muestra.
 * - Si no hay `photoURL`, viene vacío, o la carga falla (`onError`), se
 *   muestra el fallback de iniciales — nunca un recuadro vacío ni una
 *   imagen rota.
 */

export type ProfileAvatarSize = "sm" | "md" | "lg" | "xl";

export interface ProfileAvatarProps {
  name?: string | null;
  photoURL?: string | null;
  size?: ProfileAvatarSize;
  className?: string;
  /** Marca el avatar como decorativo (alt="") cuando el nombre ya es visible junto a él. */
  decorative?: boolean;
}

const SIZE_CLASSES: Record<ProfileAvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-xl",
  /** Identidad principal (hero de Ajustes): por encima de cualquier avatar de lista. */
  xl: "h-[68px] w-[68px] text-2xl",
};

/** Único cálculo de iniciales de la app — nunca lo dupliques en una pantalla. */
export function getInitialsFromName(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "FM";

  const parts = trimmed
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "FM";

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

/** Puro y testeable: decide si corresponde mostrar la imagen o el fallback de iniciales. */
export function shouldShowAvatarImage(photoURL: string | null | undefined, imageFailed: boolean): boolean {
  return Boolean(photoURL && photoURL.trim().length > 0) && !imageFailed;
}

export function ProfileAvatar({ name, photoURL, size = "md", className, decorative = false }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Si la URL cambia (ej. otro miembro, u otra sesión), reintentar la imagen
  // en vez de arrastrar un fallo previo de una foto distinta.
  useEffect(() => {
    setImageFailed(false);
  }, [photoURL]);

  const showImage = shouldShowAvatarImage(photoURL, imageFailed);
  const initials = getInitialsFromName(name);
  const trimmedName = (name ?? "").trim();

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Google; next/image exigiría allowlist de dominio externo, fuera de alcance.
        <img
          src={photoURL ?? undefined}
          alt={decorative ? "" : `Foto de perfil de ${trimmedName || "usuario"}`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden={decorative || undefined}>{initials}</span>
      )}
    </div>
  );
}
