import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import {
  personalCategoryToFirestore,
  userProfileFromFirestore,
  userProfileToFirestore,
  type FirestoreData,
} from "./converters";
import { newMutationId } from "./ids";
import type { MplusPersonalCategory, MplusUserProfile } from "./models";
import { runMplusMutation } from "./mutation-runner";
import { MPLUS_PATHS } from "./paths";
import { PERSONAL_SEED, personalSeedCategoryId } from "./seeds";
import { mplusValidators } from "./schemas";
import { completeResetSessionExit } from "@/features/auth/session-exit";
import { resumeAccountResetIfNeeded } from "@/features/settings/services/mplus-account-reset-service";

/**
 * Bootstrap del usuario operativo del contrato v1 (§6) y del seed Personal v1
 * (§8.3), equivalente Web de `MplusPersonalSeed.bootstrap` en Android.
 *
 * Es idempotente y seguro de llamar en cada login:
 *
 * - `users/{uid}` se crea solo si no existe; si ya existe se lee tal cual y
 *   NUNCA se revierte (`status`, `householdId`, `revision` son del usuario).
 * - las categorias seed usan IDs deterministas: las que ya existen se dejan
 *   intactas, incluso si el usuario las renombro o archivo.
 *
 * No escribe correo, telefono ni ningun campo fuera del contrato (§6.3). El
 * nombre y la foto se leen de Firebase Auth y solo se publican dentro de la
 * membresia del Hogar (§11), nunca aqui.
 *
 * Todos los fallos se propagan: Web es online-only y un bootstrap incompleto
 * debe verse, no silenciarse.
 */

export type MplusBootstrapResult = Readonly<{
  profile: MplusUserProfile;
  /** `true` si esta llamada creo el documento de usuario. */
  createdProfile: boolean;
  /** IDs de categorias seed creadas por esta llamada (vacio si ya estaban). */
  createdSeedCategoryIds: readonly string[];
}>;

export class MplusBootstrapError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MplusBootstrapError";
  }
}

/** Perfil recien creado segun `validUserCreate` de las Rules canonicas. */
export const buildInitialUserProfile = (
  uid: string,
  nowMillis: number,
  mutationId: string,
): MplusUserProfile => ({
  uid,
  schemaVersion: 1,
  status: "ready",
  householdId: null,
  householdMembershipState: "none",
  personalCatalogVersion: 1,
  revision: 1,
  lastMutationId: mutationId,
  createdAtMillis: nowMillis,
  updatedAtMillis: nowMillis,
  resetRequestedAtMillis: null,
});

/** Categoria seed recien creada (contrato §8.3). */
export const buildSeedCategory = (
  ownerId: string,
  seed: (typeof PERSONAL_SEED)[number],
  nowMillis: number,
  mutationId: string,
): MplusPersonalCategory => ({
  id: personalSeedCategoryId(seed),
  schemaVersion: 1,
  ownerId,
  type: seed.type,
  name: seed.name,
  iconKey: seed.iconKey,
  color: seed.color,
  state: "active",
  seedKey: seed.seedKey,
  sortOrder: seed.sortOrder,
  revision: 1,
  lastMutationId: mutationId,
  createdAtMillis: nowMillis,
  updatedAtMillis: nowMillis,
});

/**
 * Lee `users/{uid}` tal cual esta en el servidor, o null si aun no existe.
 * Publico porque el estado Personal necesita el `householdId` y el `status`
 * del contrato para decidir que puede escribirse.
 */
export const readMplusUserProfile = async (
  db: Firestore,
  uid: string,
): Promise<MplusUserProfile | null> => {
  const snapshot = await getDoc(doc(db, MPLUS_PATHS.users, uid));
  if (!snapshot.exists()) {
    return null;
  }
  return userProfileFromFirestore(uid, (snapshot.data() ?? {}) as FirestoreData);
};

/**
 * Suscripción en tiempo real a `users/{uid}`.
 * Emite inmediatamente el perfil actual y se actualiza ante cualquier cambio
 * (estado de reinicio, vínculo a Hogar, revisión).
 */
export const subscribeMplusUserProfile = (
  db: Firestore,
  uid: string,
  onUpdate: (profile: MplusUserProfile | null) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  return onSnapshot(
    doc(db, MPLUS_PATHS.users, uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(userProfileFromFirestore(uid, (snapshot.data() ?? {}) as FirestoreData));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

const ensureProfile = async (
  db: Firestore,
  uid: string,
  nowMillis: number,
): Promise<{ profile: MplusUserProfile; created: boolean }> => {
  const existing = await readMplusUserProfile(db, uid);
  if (existing) {
    return { profile: existing, created: false };
  }

  const mutationId = newMutationId();
  const profile = mplusValidators.user(buildInitialUserProfile(uid, nowMillis, mutationId));
  const userRef = doc(db, MPLUS_PATHS.users, uid);

  const outcome = await runMplusMutation(db, {
    mutationId,
    occ: [{ resource: MPLUS_PATHS.users, id: uid, ref: userRef, baseRevision: null }],
    work: (tx) => {
      tx.set(userRef, userProfileToFirestore(profile));
      return profile;
    },
  });

  if (outcome.kind === "success") {
    // `replayed` significa que otra pestania/dispositivo lo creo con este mismo
    // mutationId: hay que releer para devolver el estado remoto real.
    if (!outcome.replayed) {
      return { profile, created: true };
    }
  } else if (outcome.kind === "conflict") {
    // Carrera con otra sesion que ya creo el perfil: no es un error.
  } else if (outcome.kind === "rejected" && outcome.code === "already-exists") {
    // Mismo caso, pero detectado por el SERVIDOR en vez de por la revision
    // local: el commit llevaba la precondicion `currentDocument.exists = false`
    // y otro escritor creo el documento en medio. Crear algo que ya existe con
    // el estado que queriamos es exito, no fallo.
    //
    // Se veia como un `409 Conflict` / `already-exists` que tumbaba el inicio de
    // sesion entero: la persona pulsaba "Continuar con Google", el perfil SI
    // quedaba creado en Firestore, y la pantalla se quedaba igual.
  } else {
    throw new MplusBootstrapError(
      `No se pudo crear el perfil del contrato v1 (${outcome.code}): ${outcome.message}`,
    );
  }

  const reread = await readMplusUserProfile(db, uid);
  if (!reread) {
    throw new MplusBootstrapError(
      "El perfil del contrato v1 no quedo disponible tras el bootstrap.",
    );
  }
  return { profile: reread, created: false };
};

const ensureSeedCategories = async (
  db: Firestore,
  uid: string,
  nowMillis: number,
): Promise<readonly string[]> => {
  const categoriesRef = collection(db, MPLUS_PATHS.users, uid, MPLUS_PATHS.categories);
  const existing = await getDocs(categoriesRef);
  const existingIds = new Set(existing.docs.map((snapshot) => snapshot.id));

  const missing = PERSONAL_SEED.filter(
    (seed) => !existingIds.has(personalSeedCategoryId(seed)),
  );
  if (missing.length === 0) {
    return [];
  }

  const batch = writeBatch(db);
  const createdIds: string[] = [];
  for (const seed of missing) {
    const category = mplusValidators.category(
      buildSeedCategory(uid, seed, nowMillis, newMutationId()),
    );
    batch.set(
      doc(db, MPLUS_PATHS.users, uid, MPLUS_PATHS.categories, category.id),
      personalCategoryToFirestore(category),
    );
    createdIds.push(category.id);
  }

  await batch.commit();
  return createdIds;
};

/**
 * Bootstrap en vuelo por uid.
 *
 * El inicio de sesion dispara DOS bootstraps a la vez: el de
 * `signInWithGoogle` y el del listener `onAuthState`. Mientras el perfil ya
 * existia eso era inocuo —los dos solo leian—, pero desde que el reinicio QA
 * elimina `users/{uid}`, ambos intentan CREARLO y uno pierde la carrera.
 *
 * Compartir la promesa elimina la carrera en su origen, en vez de limitarse a
 * sobrevivirla. La tolerancia a `already-exists` de arriba sigue siendo
 * necesaria para las carreras que este mapa no puede ver: otra pestania, otro
 * dispositivo.
 */
const inFlightBootstrap = new Map<string, Promise<MplusBootstrapResult>>();

export const ensureMplusUserBootstrap = async (
  db: Firestore,
  uid: string,
  options?: { nowMillis?: number },
): Promise<MplusBootstrapResult> => {
  const pending = inFlightBootstrap.get(uid);
  if (pending) {
    return pending;
  }

  const run = runBootstrap(db, uid, options);
  inFlightBootstrap.set(uid, run);
  try {
    return await run;
  } finally {
    inFlightBootstrap.delete(uid);
  }
};

const runBootstrap = async (
  db: Firestore,
  uid: string,
  options?: { nowMillis?: number },
): Promise<MplusBootstrapResult> => {
  const nowMillis = options?.nowMillis ?? Date.now();

  const { profile, created } = await ensureProfile(db, uid, nowMillis);

  // Contrato §17.1 & §17.2: durante `resetting` las Rules rechazan categorias nuevas
  // (`validPersonalCategoryCreate` exige `status == 'ready'`). Si un reinicio quedó
  // a medias o se interrumpió, la siguiente sesión conectada reanuda la limpieza
  // automáticamente (paridad con `resumeIfNeeded` en Android).
  if (profile.status === "resetting") {
    try {
      const resetResult = await resumeAccountResetIfNeeded(db, uid);
      if (resetResult?.deletedUserProfile) {
        if (typeof window !== "undefined") {
          void completeResetSessionExit();
        }
        return { profile, createdProfile: false, createdSeedCategoryIds: [] };
      }
      if (resetResult && !resetResult.deletedUserProfile) {
        const refreshed = await readMplusUserProfile(db, uid);
        if (refreshed && refreshed.status === "ready") {
          return { profile: refreshed, createdProfile: false, createdSeedCategoryIds: [] };
        }
      }
    } catch (err) {
      console.warn("Fallo al reanudar reinicio de cuenta en bootstrap:", err);
    }
    return { profile, createdProfile: created, createdSeedCategoryIds: [] };
  }

  const createdSeedCategoryIds = await ensureSeedCategories(db, uid, nowMillis);
  return { profile, createdProfile: created, createdSeedCategoryIds };
};
