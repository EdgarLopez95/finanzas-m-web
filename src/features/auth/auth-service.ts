import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";

import type { AuthUser } from "@/features/auth/types";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getGoogleProvider,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { ensureMplusUserBootstrap } from "@/lib/mplus/user-bootstrap";
import { useAuthStore } from "@/stores/auth-store";

const mapAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email ?? "",
  displayName: user.displayName ?? "Usuario Finanzas M+",
  photoUrl: user.photoURL,
});

/**
 * Crea `users/{uid}` y el seed Personal v1 del contrato v1 si faltan.
 *
 * Sustituye al perfil legacy (`displayName`/`photoUrl`/`defaultCurrency`/
 * `activeHouseholdId`): el contrato §6.2 fija exactamente qué campos admite
 * `users/{uid}` y prohíbe cualquier extra, incluido el correo (§3.11). La
 * identidad de Google solo se publica dentro de la membresía del Hogar (§11).
 */
const ensureContractUser = async (uid: string): Promise<void> => {
  await ensureMplusUserBootstrap(getFirebaseDb(), uid);
};

export const signInWithGoogle = async (): Promise<AuthUser> => {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Configura .env.qa-real.local y usa npm run dev:qa antes de iniciar sesion real.",
    );
  }

  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, getGoogleProvider());

  // Web es online-only (contrato §22): si el bootstrap remoto no confirma, el
  // inicio de sesion FALLA de forma visible. No se devuelve una sesion "lista"
  // cuyo estado remoto todavia no existe.
  await ensureContractUser(result.user.uid);
  useAuthStore.getState().clearBootstrapError();

  return mapAuthUser(result.user);
};

export const signOutUser = async (): Promise<void> => {
  if (!isFirebaseConfigured()) {
    return;
  }

  await signOut(getFirebaseAuth());
};

export const onAuthState = (callback: (user: AuthUser | null) => void) => {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }

  const auth = getFirebaseAuth();

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    // La resolucion de sesion no se bloquea por el bootstrap (una recarga con
    // sesion viva debe pintar la app), pero un bootstrap fallido deja de ser
    // invisible: queda registrado en el store para que la UI pueda mostrarlo
    // en lugar de fingir que la cuenta ya esta lista en el servidor.
    callback(mapAuthUser(user));

    try {
      await ensureContractUser(user.uid);
      useAuthStore.getState().clearBootstrapError();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo preparar la cuenta en el servidor.";
      useAuthStore.getState().setBootstrapError(message);
      console.error("Bootstrap del contrato v1 fallido para users/{uid}.", error);
    }
  });
};

export const forceGoogleAccountSelection = () => {
  if (!isFirebaseConfigured()) {
    return;
  }

  getGoogleProvider().setCustomParameters({ prompt: "select_account" });
};
