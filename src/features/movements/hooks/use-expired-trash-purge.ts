"use client";

import { useEffect, useRef } from "react";

import { purgeMovement } from "@/features/movements/services/movement-mutations";
import { splitTrashByExpiry } from "@/features/movements/services/read-personal-movements";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Purga de la Papelera vencida (contrato §9.5).
 *
 * "La siguiente apertura conectada del dueño elimina fisicamente los vencidos
 * y ajusta el contador de cuenta". Esto es mantenimiento, no una accion del
 * usuario: no muestra exito ni error en la UI, y si falla (sin red, permisos)
 * simplemente se reintenta en la proxima apertura. Lo que NUNCA hace es
 * ocultar el documento sin borrarlo: la lista ya lo oculta por su cuenta, pero
 * el borrado real tiene que ocurrir para que el contador de la cuenta quede
 * correcto.
 *
 * Cada documento se purga una sola vez por sesion aunque el store se recargue.
 */
export const useExpiredTrashPurge = (enabled: boolean) => {
  const trashed = useMplusPersonalStore((state) => state.trashed);
  const removeMovement = useMplusPersonalStore((state) => state.removeMovement);
  const attemptedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || trashed.length === 0) {
      return;
    }

    const { expired } = splitTrashByExpiry(trashed, Date.now());
    const pending = expired.filter((movement) => !attemptedIdsRef.current.has(movement.id));
    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    const purgeAll = async () => {
      for (const movement of pending) {
        attemptedIdsRef.current.add(movement.id);
        try {
          const outcome = await purgeMovement(movement);
          if (cancelled) return;
          if (outcome.kind === "success") {
            removeMovement(movement.id);
          }
        } catch (error) {
          // Mantenimiento silencioso: se reintenta en la proxima apertura.
          console.warn("No se pudo purgar un movimiento vencido.", error);
        }
      }
    };

    void purgeAll();

    return () => {
      cancelled = true;
    };
  }, [enabled, removeMovement, trashed]);
};
