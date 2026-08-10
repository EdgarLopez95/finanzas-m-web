/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO
 * Retirar obligatoriamente `src/features/qa-reset/**` completo antes del
 * lanzamiento productivo. No forma parte del contrato de producción.
 * ============================================================================
 *
 * Orquestador del reinicio de datos de prueba para el usuario actual.
 * Paridad funcional con `DebugDataResetRepository.kt` (Android):
 *
 * 1. Descubre TODOS los Hogares del usuario (`discoverHouseholdsForCurrentUser`
 *    — `whereArrayContains("memberIds", uid)`, nunca dependiente de
 *    `activeHouseholdId` ni de una query `ownerId == uid`). Sigue funcionando
 *    si `activeHouseholdId` está vacío, apunta a un Hogar borrado, o un reset
 *    anterior quedó a medias.
 * 2. Borra los datos personales del usuario.
 * 3. Limpia los documentos de Hogar vinculados al usuario por UID
 *    (`resetHouseholdLinkedDocsForCurrentUser` — paridad con
 *    `deleteOrphanedHouseholdDocs`), ANTES de abandonar ningún Hogar ajeno —
 *    mientras las Rules todavía lo reconocen como miembro.
 * 4. Disuelve CADA Hogar propio descubierto (`dissolveHousehold`, ya
 *    canónico).
 * 5. Abandona CADA Hogar ajeno descubierto (`leaveHousehold`, ya canónico) —
 *    nunca borra el Hogar ni los datos del dueño/otro miembro.
 * 6. Limpieza final best-effort de `activeHouseholdId` (`clearActiveHousehold`)
 *    por si quedó un valor colgante no cubierto por los pasos 4/5 (Hogar
 *    referenciado que ya no aparece en el descubrimiento, p. ej. borrado por
 *    fuera).
 *
 * No usa una transacción global: cada paso se reporta por separado, con
 * detalle por Hogar (para disolución/abandono) — un fallo puntual nunca se
 * oculta ni se disfraza de éxito total. Nunca lee, muestra ni borra datos de
 * otro usuario fuera de lo que el modelo ya autoriza: Hogares propios se
 * disuelven completos (son del usuario), Hogares ajenos solo pierden la
 * membresía y los documentos que el propio UID generó.
 */
import { dissolveHousehold } from "@/features/household/services/dissolve-household";
import { leaveHousehold } from "@/features/household/services/leave-household";
import { clearActiveHousehold } from "@/features/household/services/clear-active-household";
import {
  discoverHouseholdsForCurrentUser,
  type DiscoverHouseholdsDeps,
} from "@/features/qa-reset/services/discover-households-for-current-user";
import {
  resetPersonalDataForCurrentUser,
  type QaResetWipeResult,
  type ResetPersonalDataDeps,
} from "@/features/qa-reset/services/reset-personal-data-for-current-user";
import {
  resetHouseholdLinkedDocsForCurrentUser,
  type ResetHouseholdLinkedDocsDeps,
} from "@/features/qa-reset/services/reset-household-linked-docs-for-current-user";

export type ResetQaDataForCurrentUserInput = {
  uid: string;
};

export type HouseholdActionOutcome = { householdId: string; success: boolean };

export type ResetQaDataForCurrentUserResult = {
  discoveryFailed: boolean;
  personal: QaResetWipeResult;
  householdLinkedDocsCleanup: QaResetWipeResult;
  ownedHouseholdsDissolved: HouseholdActionOutcome[];
  memberHouseholdsLeft: HouseholdActionOutcome[];
  activeHouseholdIdClearFailed: boolean;
  hadAnyFailure: boolean;
};

export type ResetQaDataForCurrentUserDeps = {
  discoverDeps?: DiscoverHouseholdsDeps;
  personalDeps?: ResetPersonalDataDeps;
  householdLinkedDocsDeps?: ResetHouseholdLinkedDocsDeps;
  dissolveHouseholdFn?: typeof dissolveHousehold;
  leaveHouseholdFn?: typeof leaveHousehold;
  clearActiveHouseholdFn?: typeof clearActiveHousehold;
};

/**
 * Ejecuta el reinicio completo para el usuario actual. Nunca borra un Hogar
 * del que el usuario no sea dueño, ni saca de un Hogar al que no pertenezca
 * (ambos derivados del descubrimiento real, no de un solo Hogar "activo"
 * asumido de antemano).
 */
export const resetQaDataForCurrentUser = async (
  input: ResetQaDataForCurrentUserInput,
  deps: ResetQaDataForCurrentUserDeps = {},
): Promise<ResetQaDataForCurrentUserResult> => {
  const { uid } = input;

  if (!uid || !uid.trim()) {
    throw new Error("El UID es obligatorio.");
  }

  const dissolveHouseholdFn = deps.dissolveHouseholdFn ?? dissolveHousehold;
  const leaveHouseholdFn = deps.leaveHouseholdFn ?? leaveHousehold;
  const clearActiveHouseholdFn = deps.clearActiveHouseholdFn ?? clearActiveHousehold;

  // 1. Descubrimiento completo — nunca depende de activeHouseholdId cargado en la UI.
  const discovery = await discoverHouseholdsForCurrentUser(uid, deps.discoverDeps);

  // 2. Datos personales.
  const personal = await resetPersonalDataForCurrentUser(uid, deps.personalDeps);

  // 3. Documentos de Hogar vinculados al usuario (por UID, nunca por
  // householdId ajeno) — ANTES de abandonar ningún Hogar, mientras la
  // membresía sigue vigente para los Hogares ajenos.
  const householdLinkedDocsCleanup = await resetHouseholdLinkedDocsForCurrentUser(uid, deps.householdLinkedDocsDeps);

  // 4. Cada Hogar propio descubierto: disolver completo.
  const ownedHouseholdsDissolved: HouseholdActionOutcome[] = [];
  for (const owned of discovery.owned) {
    try {
      await dissolveHouseholdFn(owned.id, uid);
      ownedHouseholdsDissolved.push({ householdId: owned.id, success: true });
    } catch (err) {
      console.warn(`[qa-reset] Fallo disolviendo el Hogar propio (householdId=${owned.id}):`, err);
      ownedHouseholdsDissolved.push({ householdId: owned.id, success: false });
    }
  }

  // 5. Cada Hogar ajeno descubierto: abandonar sin tocar datos del dueño.
  const memberHouseholdsLeft: HouseholdActionOutcome[] = [];
  for (const memberOnly of discovery.memberOnly) {
    try {
      await leaveHouseholdFn(memberOnly.id, uid);
      memberHouseholdsLeft.push({ householdId: memberOnly.id, success: true });
    } catch (err) {
      console.warn(`[qa-reset] Fallo abandonando el Hogar ajeno (householdId=${memberOnly.id}):`, err);
      memberHouseholdsLeft.push({ householdId: memberOnly.id, success: false });
    }
  }

  // 6. Limpieza final best-effort de un activeHouseholdId colgante no
  // cubierto por los pasos 4/5 (p. ej. apuntaba a un Hogar ya inexistente,
  // fuera del descubrimiento). No es un fallo bloqueante por sí solo, pero
  // se reporta explícitamente — nunca se oculta.
  let activeHouseholdIdClearFailed = false;
  try {
    await clearActiveHouseholdFn(uid);
  } catch (err) {
    console.warn(`[qa-reset] Fallo limpiando activeHouseholdId (uid=${uid}):`, err);
    activeHouseholdIdClearFailed = true;
  }

  const hadAnyFailure =
    discovery.queryFailed ||
    personal.failed > 0 ||
    householdLinkedDocsCleanup.failed > 0 ||
    ownedHouseholdsDissolved.some((h) => !h.success) ||
    memberHouseholdsLeft.some((h) => !h.success) ||
    activeHouseholdIdClearFailed;

  return {
    discoveryFailed: discovery.queryFailed,
    personal,
    householdLinkedDocsCleanup,
    ownedHouseholdsDissolved,
    memberHouseholdsLeft,
    activeHouseholdIdClearFailed,
    hadAnyFailure,
  };
};
