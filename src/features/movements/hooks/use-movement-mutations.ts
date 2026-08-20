"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  createMovement,
  purgeMovement,
  restoreMovement,
  trashMovement,
  updateMovement,
  MovementPreconditionError,
  type MovementDraft,
} from "@/features/movements/services/movement-mutations";
import { createSingleFlightSubmitGuard } from "@/features/transactions/lib/single-flight-submit-guard";
import { newUuid } from "@/lib/mplus/ids";
import type { MplusMovement } from "@/lib/mplus/models";
import type { MplusMutationOutcome } from "@/lib/mplus/mutation-runner";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Puente entre la UI Personal y las mutaciones del contrato v1.
 *
 * Reglas que hace cumplir, todas del contrato §22:
 *
 * - **Nada de exito anticipado.** El estado local solo se toca cuando el
 *   servidor confirmo el commit; hasta entonces la UI sigue en `saving`.
 * - **Conflicto explicito.** Un choque de `revision` no se resuelve solo ni se
 *   reintenta a ciegas: se comunica y se recarga el mes para que la persona
 *   vea la version del servidor antes de decidir.
 * - **Sin cola ni reintento oculto.** Un fallo de red es `unavailable` y se
 *   muestra tal cual.
 * - **Doble envio bloqueado**, con el mismo guard que ya usaba la Web.
 */

export type MovementMutationFeedback =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "saving" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

const CONFLICT_MESSAGE =
  "Alguien mas cambio este movimiento mientras lo editabas. Se recargo la version del servidor: revisa y vuelve a aplicar tu cambio.";

const OFFLINE_MESSAGE =
  "No hay conexion con el servidor. El cambio NO se guardo. Reintenta cuando vuelvas a tener red.";

export const describeOutcomeFailure = (
  outcome: Exclude<MplusMutationOutcome<unknown>, { kind: "success" }>,
): MovementMutationFeedback =>
  outcome.kind === "conflict"
    ? { kind: "conflict", message: CONFLICT_MESSAGE }
    : outcome.kind === "unavailable"
      ? { kind: "error", message: OFFLINE_MESSAGE }
      : { kind: "error", message: outcome.message };

export const useMovementMutations = () => {
  const [feedback, setFeedback] = useState<MovementMutationFeedback>({ kind: "idle" });
  const guardRef = useRef(createSingleFlightSubmitGuard());

  const applyCommittedMovement = useMplusPersonalStore((state) => state.applyCommittedMovement);
  const removeMovement = useMplusPersonalStore((state) => state.removeMovement);
  const refresh = useMplusPersonalStore((state) => state.refresh);

  const clearFeedback = useCallback(() => setFeedback({ kind: "idle" }), []);

  /**
   * Envuelve una mutacion con guard de doble envio, traduccion de resultado y
   * actualizacion del estado local SOLO tras confirmacion remota.
   */
  const run = useCallback(
    async <T>(
      operation: () => Promise<MplusMutationOutcome<T>>,
      onCommitted: (value: T) => void,
    ): Promise<boolean> => {
      if (!guardRef.current.tryAcquire()) {
        return false;
      }
      setFeedback({ kind: "saving" });

      try {
        const outcome = await operation();

        if (outcome.kind === "success") {
          if (outcome.replayed) {
            // El servidor ya tenia aplicada esta misma mutacion: no hay valor
            // local de confianza, se relee el mes.
            await refresh();
          } else {
            onCommitted(outcome.value);
          }
          setFeedback({ kind: "idle" });
          return true;
        }

        setFeedback(describeOutcomeFailure(outcome));
        if (outcome.kind === "conflict") {
          // Traer la version del servidor es parte de resolver el conflicto.
          await refresh();
        }
        return false;
      } catch (error) {
        setFeedback({
          kind: "error",
          message:
            error instanceof MovementPreconditionError
              ? error.message
              : error instanceof Error
                ? error.message
                : "No se pudo completar la operacion.",
        });
        return false;
      } finally {
        guardRef.current.release();
      }
    },
    [refresh],
  );

  const create = useCallback(
    (ownerId: string, draft: MovementDraft) =>
      run(
        () => createMovement(ownerId, newUuid(), draft),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      ),
    [applyCommittedMovement, run],
  );

  const update = useCallback(
    (current: MplusMovement, draft: MovementDraft) =>
      run(
        () => updateMovement(current, draft),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      ),
    [applyCommittedMovement, run],
  );

  const trash = useCallback(
    (current: MplusMovement) =>
      run(
        () => trashMovement(current),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      ),
    [applyCommittedMovement, run],
  );

  const restore = useCallback(
    (current: MplusMovement) =>
      run(
        () => restoreMovement(current),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      ),
    [applyCommittedMovement, run],
  );

  const purge = useCallback(
    (current: MplusMovement) =>
      run(
        () => purgeMovement(current),
        (movementId: string) => removeMovement(movementId),
      ),
    [removeMovement, run],
  );

  return useMemo(
    () => ({
      feedback,
      clearFeedback,
      isSubmitting: feedback.kind === "saving",
      create,
      update,
      trash,
      restore,
      purge,
    }),
    [clearFeedback, create, feedback, purge, restore, trash, update],
  );
};
