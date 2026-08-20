import { REGISTERED_FIREBASE_WEB_APP } from "./registered-web-app.mjs";

/**
 * Política de ambiente Firebase de la Web (ORQ-041 / DEC-081).
 *
 * La Web tiene UN solo entorno de ejecución: el proyecto real
 * `finanzas-m-plus`. No existe modo emulador, ni proyecto `demo-*`, ni
 * fallback silencioso de un ambiente a otro. Cualquier configuración que no
 * sea exactamente la app Web registrada de `finanzas-m-plus` produce un
 * bloqueo visible antes de la primera lectura o escritura.
 *
 * `finanzas-m` (la aplicación base anterior) es un bloqueo explícito y
 * nombrado: es el error que más daño causaría si pasara inadvertido.
 */

/** Único runtime admitido. Se conserva el tipo para no perder expresividad. */
export type FirebaseRuntime = "QA_REAL";

export const FIREBASE_RUNTIME: FirebaseRuntime = "QA_REAL";

/** Proyecto de la aplicación base anterior; nunca debe recibir escrituras M+. */
export const BLOCKED_LEGACY_PROJECT_ID = "finanzas-m";

type PublicEnvironment = Record<string, string | undefined>;

type FirebaseClientConfig = Readonly<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}>;

export type FirebaseClientEnvironment = Readonly<{
  runtime: FirebaseRuntime;
  config: FirebaseClientConfig;
}>;

export function resolveFirebaseEnvironment(
  env: PublicEnvironment,
): FirebaseClientEnvironment {
  // Un `.env` heredado del modo emulador debe fallar de forma ruidosa: si se
  // ignorara en silencio, quien lo tenga creería seguir apuntando al emulador.
  const declaredRuntime = env.NEXT_PUBLIC_FIREBASE_RUNTIME;
  if (declaredRuntime !== undefined && declaredRuntime !== FIREBASE_RUNTIME) {
    throw new Error(
      `NEXT_PUBLIC_FIREBASE_RUNTIME='${declaredRuntime}' ya no existe. La Web solo opera contra finanzas-m-plus (ORQ-041/DEC-081): elimina la variable de tu archivo de ambiente.`,
    );
  }

  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  if (Object.values(config).some((value) => value.trim().length === 0)) {
    throw new Error(
      "Configuración de Firebase incompleta. Copia .env.local.example como .env.qa-real.local con los valores de finanzas-m-plus.",
    );
  }

  if (config.projectId === BLOCKED_LEGACY_PROJECT_ID) {
    throw new Error(
      "Bloqueado: la Web de Finanzas M+ nunca opera sobre el proyecto finanzas-m.",
    );
  }

  const belongsToMPlus =
    config.apiKey === REGISTERED_FIREBASE_WEB_APP.apiKey &&
    config.projectId === REGISTERED_FIREBASE_WEB_APP.projectId &&
    config.authDomain === REGISTERED_FIREBASE_WEB_APP.authDomain &&
    config.storageBucket === REGISTERED_FIREBASE_WEB_APP.storageBucket &&
    config.messagingSenderId ===
      REGISTERED_FIREBASE_WEB_APP.messagingSenderId &&
    config.appId === REGISTERED_FIREBASE_WEB_APP.appId;

  if (!belongsToMPlus) {
    throw new Error("Solo se admite la app Web registrada de finanzas-m-plus.");
  }

  return { runtime: FIREBASE_RUNTIME, config };
}
