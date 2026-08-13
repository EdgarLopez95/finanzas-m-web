export const FIREBASE_KEYS = Object.freeze([
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]);

const EXPECTED_QA_VALUES = Object.freeze({
  NEXT_PUBLIC_FIREBASE_API_KEY:
    "AIzaSyALPXlIPg8w7p0l5a8qHH05Qv_DTUs7dpk",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    "finanzas-m-plus.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
  NEXT_PUBLIC_FIREBASE_APP_ID:
    "1:608498270578:web:e97ccea7ffa7ed72871deb",
});

export const parseEnvFile = (contents) => {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error("Linea invalida en el archivo de ambiente QA.");
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

export const validateQaValues = (values) => {
  const missing = FIREBASE_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Configuracion QA_REAL incompleta: ${missing.join(", ")}`);
  }

  const mismatch = FIREBASE_KEYS.some(
    (key) => values[key] !== EXPECTED_QA_VALUES[key],
  );
  if (mismatch) {
    throw new Error(
      "Configuracion QA_REAL invalida: solo se admite la app Web registrada de finanzas-m-plus.",
    );
  }

  return Object.fromEntries(
    FIREBASE_KEYS.map((key) => [key, values[key]]),
  );
};

export const createFirebaseChildEnvironment = (
  runtime,
  inheritedEnvironment,
  qaValues,
) => {
  if (runtime !== "EMULATOR" && runtime !== "QA_REAL") {
    throw new Error("Runtime Firebase invalido. Usa EMULATOR o QA_REAL.");
  }

  const childEnvironment = {
    ...inheritedEnvironment,
    NEXT_PUBLIC_FIREBASE_RUNTIME: runtime,
  };

  for (const key of FIREBASE_KEYS) delete childEnvironment[key];
  if (runtime === "QA_REAL") {
    const validated = validateQaValues(qaValues ?? {});
    for (const key of FIREBASE_KEYS) childEnvironment[key] = validated[key];
  }

  return childEnvironment;
};
