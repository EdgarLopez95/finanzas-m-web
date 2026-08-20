import { REGISTERED_FIREBASE_WEB_APP } from "../src/lib/firebase/registered-web-app.mjs";

/**
 * Núcleo de ambiente Firebase para los comandos npm (ORQ-041 / DEC-081).
 *
 * La Web tiene un solo entorno: el proyecto real `finanzas-m-plus`. Aquí ya no
 * existe rama de emulador ni selección de runtime; lo único que queda es leer
 * `.env.qa-real.local`, validarlo contra la app Web registrada y pasárselo al
 * proceso hijo de Next.
 */

export const FIREBASE_KEYS = Object.freeze([
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]);

const EXPECTED_VALUES = Object.freeze({
  NEXT_PUBLIC_FIREBASE_API_KEY: REGISTERED_FIREBASE_WEB_APP.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: REGISTERED_FIREBASE_WEB_APP.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: REGISTERED_FIREBASE_WEB_APP.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: REGISTERED_FIREBASE_WEB_APP.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    REGISTERED_FIREBASE_WEB_APP.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: REGISTERED_FIREBASE_WEB_APP.appId,
});

export const parseEnvFile = (contents) => {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error("Linea invalida en el archivo de ambiente.");
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

export const validateFirebaseValues = (values) => {
  const missing = FIREBASE_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Configuracion de Firebase incompleta: ${missing.join(", ")}`);
  }

  if (values.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "finanzas-m") {
    throw new Error(
      "Bloqueado: la Web de Finanzas M+ nunca opera sobre el proyecto finanzas-m.",
    );
  }

  const mismatch = FIREBASE_KEYS.some((key) => values[key] !== EXPECTED_VALUES[key]);
  if (mismatch) {
    throw new Error(
      "Configuracion invalida: solo se admite la app Web registrada de finanzas-m-plus.",
    );
  }

  return Object.fromEntries(FIREBASE_KEYS.map((key) => [key, values[key]]));
};

export const createFirebaseChildEnvironment = (inheritedEnvironment, values) => {
  const childEnvironment = { ...inheritedEnvironment };

  // Reliquia del modo emulador: si sobrevive en el ambiente heredado, el
  // cliente la rechazaria en tiempo de ejecucion. Se limpia aqui para que un
  // `.env` viejo no envenene el proceso hijo.
  delete childEnvironment.NEXT_PUBLIC_FIREBASE_RUNTIME;

  // Nunca se heredan credenciales del shell: la única fuente es el archivo de
  // ambiente ya validado.
  for (const key of FIREBASE_KEYS) delete childEnvironment[key];

  const validated = validateFirebaseValues(values ?? {});
  for (const key of FIREBASE_KEYS) childEnvironment[key] = validated[key];

  return childEnvironment;
};
