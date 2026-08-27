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
import { createSingleFlightSubmitGuard } from "@/features/movements/lib/single-flight-submit-guard";
import { movementFromFirestore } from "@/lib/mplus/converters";
import { categoryMappingId, newUuid } from "@/lib/mplus/ids";
import type { MplusMovement } from "@/lib/mplus/models";
import type { MplusMutationOutcome } from "@/lib/mplus/mutation-runner";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Puente entre la UI Personal y las mutaciones del contrato v1.
 *
 * Reglas que hace cumplir, todas del contrato §22:
 *
 * - **Nada de exito anticipado.** El estado local solo se toca cuando el
 *   servidor confirmo el commit; hasta entonces la UI sigue en `saving`.
 * - **Conflicto explicito (spec §22.2).** Un choque de `revision` no se
 *   resuelve solo ni se adopta silenciosamente la del servidor: se captura el
 *   conflicto con ambas versiones (local vs remota) y se ofrece al usuario
 *   la elección de conservar su versión o la del servidor.
 * - **Sin cola ni reintento oculto.** Un fallo de red es `unavailable` y se
 *   muestra tal cual.
 * - **Doble envio bloqueado**, con el mismo guard que ya usaba la Web.
 *
 * Ademas mantiene coherentes los DOS tableros: un movimiento marcado
 * "Contar en Hogar" se guarda desde Personal pero se muestra tambien en Hogar
 * (§19.3).
 */

export type MovementMutationFeedback =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "saving" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export type MovementConflictState = Readonly<{
  draft: MovementDraft;
  baseMovement: MplusMovement;
  serverMovement: MplusMovement | null;
}>;

const CONFLICT_MESSAGE =
  "Alguien más cambió este movimiento mientras lo editabas. Revisa las dos versiones y elige cuál conservar.";

const OFFLINE_MESSAGE =
  "No hay conexión con el servidor. El cambio NO se guardó. Reintenta cuando vuelvas a tener red.";

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
  const [conflictState, setConflictState] = useState<MovementConflictState | null>(null);
  const guardRef = useRef(createSingleFlightSubmitGuard());

  const applyPersonalMovement = useMplusPersonalStore((state) => state.applyCommittedMovement);
  const removePersonalMovement = useMplusPersonalStore((state) => state.removeMovement);
  const refreshPersonal = useMplusPersonalStore((state) => state.refresh);

  const applyHouseholdMovement = useMplusHouseholdStore((state) => state.applyCommittedMovement);
  const applyHouseholdMapping = useMplusHouseholdStore((state) => state.applyCommittedMapping);
  const removeHouseholdMovement = useMplusHouseholdStore((state) => state.removeMovement);
  const refreshHousehold = useMplusHouseholdStore((state) => state.refresh);

  const clearFeedback = useCallback(() => setFeedback({ kind: "idle" }), []);
  const clearConflict = useCallback(() => setConflictState(null), []);

  /**
   * Un documento confirmado se refleja en las dos superficies.
   */
  const applyCommittedMovement = useCallback(
    (movement: MplusMovement) => {
      applyPersonalMovement(movement);
      applyHouseholdMovement(movement);
    },
    [applyHouseholdMovement, applyPersonalMovement],
  );

  const removeMovement = useCallback(
    (movementId: string) => {
      removePersonalMovement(movementId);
      removeHouseholdMovement(movementId);
    },
    [removeHouseholdMovement, removePersonalMovement],
  );

  /** Una relectura de la verdad del servidor alcanza a los dos tableros. */
  const refresh = useCallback(async () => {
    await Promise.all([refreshPersonal(), refreshHousehold()]);
  }, [refreshHousehold, refreshPersonal]);

  /**
   * Envuelve una mutacion con guard de doble envio, traduccion de resultado y
   * actualizacion del estado local SOLO tras confirmacion remota.
   */
  const run = useCallback(
    async <T>(
      operation: () => Promise<MplusMutationOutcome<T>>,
      onCommitted: (value: T) => void,
    ): Promise<MplusMutationOutcome<T> | null> => {
      if (!guardRef.current.tryAcquire()) {
        return null;
      }
      setFeedback({ kind: "saving" });

      try {
        const outcome = await operation();

        if (outcome.kind === "success") {
          if (outcome.replayed) {
            await refresh();
          } else {
            onCommitted(outcome.value);
          }
          setFeedback({ kind: "idle" });
          setConflictState(null);
          return outcome;
        }

        setFeedback(describeOutcomeFailure(outcome));
        return outcome;
      } catch (error) {
        setFeedback({
          kind: "error",
          message:
            error instanceof MovementPreconditionError
              ? error.message
              : error instanceof Error
                ? error.message
                : "No se pudo completar la operación.",
        });
        return null;
      } finally {
        guardRef.current.release();
      }
    },
    [refresh],
  );

  const create = useCallback(
    async (ownerId: string, draft: MovementDraft): Promise<boolean> => {
      const res = await run(
        () => createMovement(ownerId, newUuid(), draft),
        (movement: MplusMovement) => {
          applyCommittedMovement(movement);
          if (
            draft.householdId &&
            draft.householdCategoryId &&
            draft.type === "expense" &&
            draft.learnMapping !== false
          ) {
            applyHouseholdMapping({
              id: categoryMappingId(ownerId, draft.categoryId),
              schemaVersion: 1,
              householdId: draft.householdId,
              ownerId,
              personalCategoryId: draft.categoryId,
              householdCategoryId: draft.householdCategoryId,
              updatedBy: ownerId,
              revision: 1,
              lastMutationId: movement.lastMutationId,
              createdAtMillis: movement.createdAtMillis,
              updatedAtMillis: movement.updatedAtMillis,
            });
          }
        },
      );
      return res?.kind === "success";
    },
    [applyCommittedMovement, applyHouseholdMapping, run],
  );

  const update = useCallback(
    async (current: MplusMovement, draft: MovementDraft): Promise<boolean> => {
      const res = await run(
        () => updateMovement(current, draft),
        (movement: MplusMovement) => {
          applyCommittedMovement(movement);
          if (
            draft.householdId &&
            draft.householdCategoryId &&
            draft.type === "expense" &&
            draft.learnMapping !== false
          ) {
            applyHouseholdMapping({
              id: categoryMappingId(current.ownerId, draft.categoryId),
              schemaVersion: 1,
              householdId: draft.householdId,
              ownerId: current.ownerId,
              personalCategoryId: draft.categoryId,
              householdCategoryId: draft.householdCategoryId,
              updatedBy: current.ownerId,
              revision: 1,
              lastMutationId: movement.lastMutationId,
              createdAtMillis: movement.createdAtMillis,
              updatedAtMillis: movement.updatedAtMillis,
            });
          }
        },
      );

      if (res?.kind === "conflict") {
        let serverMovement: MplusMovement | null = null;
        if (res.conflict.remoteSnapshot) {
          try {
            serverMovement = movementFromFirestore(
              res.conflict.id,
              res.conflict.remoteSnapshot,
            );
          } catch {
            serverMovement = null;
          }
        }
        setConflictState({
          draft,
          baseMovement: current,
          serverMovement,
        });
        return false;
      }

      if (res?.kind === "success") {
        setConflictState(null);
        return true;
      }

      return false;
    },
    [applyCommittedMovement, applyHouseholdMapping, run],
  );

  const trash = useCallback(
    async (current: MplusMovement): Promise<boolean> => {
      const res = await run(
        () => trashMovement(current),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      );
      return res?.kind === "success";
    },
    [applyCommittedMovement, run],
  );

  const restore = useCallback(
    async (current: MplusMovement): Promise<boolean> => {
      const res = await run(
        () => restoreMovement(current),
        (movement: MplusMovement) => applyCommittedMovement(movement),
      );
      return res?.kind === "success";
    },
    [applyCommittedMovement, run],
  );

  const purge = useCallback(
    async (current: MplusMovement): Promise<boolean> => {
      const res = await run(
        () => purgeMovement(current),
        (movementId: string) => removeMovement(movementId),
      );
      return res?.kind === "success";
    },
    [removeMovement, run],
  );

  /**
   * Resuelve el conflicto aceptando la versión remota del servidor.
   */
  const resolveConflictKeepServer = useCallback(async (): Promise<void> => {
    if (!conflictState) return;
    if (conflictState.serverMovement) {
      applyCommittedMovement(conflictState.serverMovement);
    } else {
      removeMovement(conflictState.baseMovement.id);
    }
    setConflictState(null);
    setFeedback({ kind: "idle" });
  }, [applyCommittedMovement, conflictState, removeMovement]);

  /**
   * Resuelve el conflicto reintentando guardar la versión local (draft)
   * sobre la nueva revisión del servidor.
   */
  const resolveConflictKeepLocal = useCallback(async (): Promise<boolean> => {
    if (!conflictState) return false;
    if (!conflictState.serverMovement) {
      // Si fue eliminado en el servidor, no se puede actualizar sobre el documento borrado
      setFeedback({
        kind: "error",
        message: "El movimiento fue eliminado del servidor por otra sesión.",
      });
      return false;
    }
    const { serverMovement, draft } = conflictState;
    return await update(serverMovement, draft);
  }, [conflictState, update]);

  return useMemo(
    () => ({
      feedback,
      conflictState,
      clearFeedback,
      clearConflict,
      isSubmitting: feedback.kind === "saving",
      create,
      update,
      trash,
      restore,
      purge,
      resolveConflictKeepServer,
      resolveConflictKeepLocal,
    }),
    [
      clearConflict,
      clearFeedback,
      conflictState,
      create,
      feedback,
      purge,
      resolveConflictKeepLocal,
      resolveConflictKeepServer,
      restore,
      trash,
      update,
    ],
  );
};
