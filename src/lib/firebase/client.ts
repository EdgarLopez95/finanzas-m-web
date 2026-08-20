import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  resolveFirebaseEnvironment,
  type FirebaseClientEnvironment,
} from "./environment";

/**
 * Cliente Firebase de la Web (ORQ-041 / DEC-081).
 *
 * Un solo entorno: el proyecto real `finanzas-m-plus`. No hay conexión a
 * emuladores ni persistencia offline — la Web es online-only (contrato §22).
 *
 * La configuración se resuelve de forma PEREZOSA, en el primer uso real de
 * Auth o Firestore, no al importar el módulo. Así el bloqueo por ambiente
 * inválido sigue ocurriendo antes de la primera lectura o escritura, pero
 * importar un servicio (por ejemplo en la suite unitaria, que no tiene ni debe
 * tener credenciales) no revienta por sí solo.
 */

const FIREBASE_APP_NAME = "finanzas-m-plus-web";

let cachedEnvironment: FirebaseClientEnvironment | null = null;
let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

const getEnvironment = (): FirebaseClientEnvironment => {
  cachedEnvironment ??= resolveFirebaseEnvironment({
    NEXT_PUBLIC_FIREBASE_RUNTIME: process.env.NEXT_PUBLIC_FIREBASE_RUNTIME,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return cachedEnvironment;
};

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

  const environment = getEnvironment();

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
  cachedAuth ??= getAuth(getAppInstance());
  return cachedAuth;
};

export const getFirebaseDb = (): Firestore => {
  cachedDb ??= getFirestore(getAppInstance());
  return cachedDb;
};

export const getGoogleProvider = (): GoogleAuthProvider => {
  cachedProvider ??= new GoogleAuthProvider();
  return cachedProvider;
};

export const getFirebaseRuntime = () => getEnvironment().runtime;

export const isFirebaseConfigured = (): boolean => true;
