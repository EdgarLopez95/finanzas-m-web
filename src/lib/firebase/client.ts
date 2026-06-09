import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Firebase client is only available in the browser.");
  }
};

const getAppInstance = (): FirebaseApp => {
  assertBrowser();

  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
};

export const getFirebaseAuth = (): Auth => {
  if (!hasRequiredConfig) {
    throw new Error("Firebase web config is incomplete. Check NEXT_PUBLIC_FIREBASE_* variables.");
  }

  if (cachedAuth) {
    return cachedAuth;
  }

  cachedAuth = getAuth(getAppInstance());
  return cachedAuth;
};

export const getFirebaseDb = (): Firestore => {
  if (!hasRequiredConfig) {
    throw new Error("Firebase web config is incomplete. Check NEXT_PUBLIC_FIREBASE_* variables.");
  }

  if (cachedDb) {
    return cachedDb;
  }

  const app = getAppInstance();

  // Persistencia offline en IndexedDB: la primera visita baja de red, las
  // siguientes (y los refrescos) se sirven al instante desde disco y se
  // revalidan en segundo plano. persistentMultipleTabManager evita conflictos
  // entre pestañas. Si initializeFirestore ya corrió (HMR, doble import),
  // caemos a getFirestore para no duplicar la instancia.
  try {
    cachedDb = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    cachedDb = getFirestore(app);
  }

  return cachedDb;
};

export const getGoogleProvider = (): GoogleAuthProvider => {
  if (cachedProvider) {
    return cachedProvider;
  }

  cachedProvider = new GoogleAuthProvider();
  return cachedProvider;
};

export const isFirebaseConfigured = (): boolean => hasRequiredConfig;
