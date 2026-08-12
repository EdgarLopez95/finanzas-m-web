export type FirebaseRuntime = "EMULATOR" | "QA_REAL";

type PublicEnvironment = Record<string, string | undefined>;

export type FirebaseClientEnvironment = {
  runtime: FirebaseRuntime;
  useEmulators: boolean;
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
};

const emulatorConfig = {
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
      config: emulatorConfig,
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

  if (Object.values(config).some((value) => !value)) {
    throw new Error("Configuración QA_REAL incompleta.");
  }

  const belongsToMPlus =
    config.projectId === "finanzas-m-plus" &&
    config.authDomain === "finanzas-m-plus.firebaseapp.com" &&
    config.storageBucket === "finanzas-m-plus.firebasestorage.app" &&
    config.messagingSenderId === "608498270578" &&
    config.appId.startsWith("1:608498270578:web:");

  if (!belongsToMPlus) {
    throw new Error("QA_REAL solo admite el proyecto finanzas-m-plus.");
  }

  return { runtime: "QA_REAL", useEmulators: false, config };
}
