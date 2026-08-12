import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { resolveFirebaseEnvironment } from "./environment";

const FIREBASE_APP_NAME = "finanzas-m-plus-web";
const environment = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_RUNTIME: process.env.NEXT_PUBLIC_FIREBASE_RUNTIME,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

type EmulatorConnectionState = {
  auth: Set<string>;
  firestore: Set<string>;
};

type FirebaseGlobal = typeof globalThis & {
  __finanzasMPlusFirebaseEmulators?: EmulatorConnectionState;
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Firebase client is only available in the browser.");
  }
};

const getEmulatorConnectionState = (): EmulatorConnectionState => {
  const firebaseGlobal = globalThis as FirebaseGlobal;
  firebaseGlobal.__finanzasMPlusFirebaseEmulators ??= {
    auth: new Set<string>(),
    firestore: new Set<string>(),
  };
  return firebaseGlobal.__finanzasMPlusFirebaseEmulators;
};

const getAppInstance = (): FirebaseApp => {
  assertBrowser();
  if (cachedApp) {
    return cachedApp;
  }

  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existingApp) {
    if (existingApp.options.projectId !== environment.config.projectId) {
      throw new Error("La app Firebase M+ ya existe con otro proyecto. Reinicia el proceso.");
    }
    cachedApp = existingApp;
    return cachedApp;
  }

  cachedApp = initializeApp(environment.config, FIREBASE_APP_NAME);
  return cachedApp;
};

export const getFirebaseAuth = (): Auth => {
  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getAppInstance();
  cachedAuth = getAuth(app);

  if (environment.useEmulators) {
    const key = `${app.name}:${environment.config.projectId}`;
    const state = getEmulatorConnectionState();
    if (!state.auth.has(key)) {
      connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      state.auth.add(key);
    }
  }

  return cachedAuth;
};

export const getFirebaseDb = (): Firestore => {
  if (cachedDb) {
    return cachedDb;
  }

  const app = getAppInstance();
  cachedDb = getFirestore(app);

  if (environment.useEmulators) {
    const key = `${app.name}:${environment.config.projectId}`;
    const state = getEmulatorConnectionState();
    if (!state.firestore.has(key)) {
      connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
      state.firestore.add(key);
    }
  }

  return cachedDb;
};

export const getGoogleProvider = (): GoogleAuthProvider => {
  cachedProvider ??= new GoogleAuthProvider();
  return cachedProvider;
};

export const getFirebaseRuntime = () => environment.runtime;

export const isFirebaseConfigured = (): boolean => true;
