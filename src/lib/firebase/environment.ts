import { REGISTERED_FIREBASE_WEB_APP } from "./registered-web-app.mjs";

export type FirebaseRuntime = "EMULATOR" | "QA_REAL";

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
  useEmulators: boolean;
  config: FirebaseClientConfig;
}>;

const emulatorConfig: FirebaseClientConfig = {
  apiKey: "demo-key",
  authDomain: "demo-finanzas-m-plus.firebaseapp.com",
  projectId: "demo-finanzas-m-plus",
  storageBucket: "demo-finanzas-m-plus.appspot.com",
  messagingSenderId: "demo-sender",
  appId: "demo-finanzas-m-plus-web",
};

export function resolveFirebaseEnvironment(
  env: PublicEnvironment,
): FirebaseClientEnvironment {
  const rawRuntime = env.NEXT_PUBLIC_FIREBASE_RUNTIME ?? "EMULATOR";
  if (rawRuntime !== "EMULATOR" && rawRuntime !== "QA_REAL") {
    throw new Error("Firebase runtime inválido. Usa EMULATOR o QA_REAL.");
  }

  if (rawRuntime === "EMULATOR") {
    return {
      runtime: "EMULATOR",
      useEmulators: true,
      config: { ...emulatorConfig },
    };
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
    throw new Error("Configuración QA_REAL incompleta.");
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
    throw new Error("QA_REAL solo admite el proyecto finanzas-m-plus.");
  }

  return { runtime: "QA_REAL", useEmulators: false, config };
}
