import {
  getIdTokenResult,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

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

const assertConfigured = () => {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Configura .env.qa-real.local con los valores de finanzas-m-plus antes de iniciar sesion.",
    );
  }
};

export const signInWithGoogle = async (): Promise<AuthUser> => {
  assertConfigured();

  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, getGoogleProvider());

  // Web es online-only (contrato §22): si el bootstrap remoto no confirma, el
  // inicio de sesion FALLA de forma visible. No se devuelve una sesion "lista"
  // cuyo estado remoto todavia no existe.
  await ensureContractUser(result.user.uid);
  useAuthStore.getState().clearBootstrapError();

  return mapAuthUser(result.user);
};

/**
 * Alternativa por redireccion, para cuando la ventana emergente no puede
 * completar el acceso.
 *
 * Existe por un fallo real de QA: Chrome registro
 * `Cross-Origin-Opener-Policy policy would block the window.close call` y la
 * promesa de `signInWithPopup` se quedo sin resolver NI rechazar despues de
 * elegir la cuenta. Una promesa que nunca se asienta no se puede atrapar con
 * un `catch`: hace falta otra via.
 *
 * Esta funcion NO devuelve un usuario: navega fuera de la pagina. El resultado
 * se recoge al volver, con `consumeGoogleRedirectResult`.
 */
export const signInWithGoogleRedirect = async (): Promise<void> => {
  assertConfigured();
  await signInWithRedirect(getFirebaseAuth(), getGoogleProvider());
};

/**
 * Recoge el resultado del acceso por redireccion al volver a la pagina.
 *
 * Devuelve `null` cuando no se venia de una redireccion, que es el caso
 * normal en cada carga. Cuando si, completa el mismo bootstrap del contrato que
 * hace el acceso por ventana emergente: una sesion nunca se da por lista sin
 * su `users/{uid}` confirmado.
 */
export const consumeGoogleRedirectResult = async (): Promise<AuthUser | null> => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const result = await getRedirectResult(getFirebaseAuth());
  if (!result) {
    return null;
  }

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

    // El bootstrap va ANTES de dar la sesion por lista, y el orden importa:
    // las Rules de `users/{uid}/accounts` y `users/{uid}/categories` exigen
    // `parentUserExists(uid)`, asi que pintar el dashboard sin `users/{uid}`
    // creado hace que su PRIMERA lectura muera con
    // `Missing or insufficient permissions`.
    //
    // Antes se llamaba a `callback` primero, para no retrasar el pintado en una
    // recarga con sesion viva. Era seguro mientras el perfil existiera siempre;
    // desde que el reinicio QA elimina `users/{uid}`, el primer login pasa
    // SIEMPRE por el caso de crearlo, y el dashboard aparecia con "Error al
    // cargar datos". En una recarga normal el perfil ya existe y esto es una
    // lectura, no una escritura.
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

    // Se reporta la sesion pase lo que pase: un bootstrap fallido no puede
    // dejar la pestania colgada en "cargando". Si fallo, `bootstrapError`
    // queda en el store en vez de fingir que la cuenta esta lista.
    callback(mapAuthUser(user));
  });
};

/**
 * Identidad del usuario TAL Y COMO LA VEN LAS RULES.
 *
 * `identityMatchesClaims` (firestore.rules) exige igualdad EXACTA entre lo
 * que se escribe en la membresia del Hogar y los claims del ID token:
 *
 *   data.displayName == request.auth.token.name
 *   data.photoUrl    == request.auth.token.picture
 *
 * Construir la membresia desde `User.displayName` / `User.photoURL` es
 * parecido pero NO es lo mismo: son dos fuentes distintas que pueden
 * divergir (un valor por defecto del cliente, una foto sin URL, un perfil
 * actualizado en Google que aun no se refresco en el objeto `User`). Cuando
 * divergen, el servidor rechaza la escritura con
 * `Missing or insufficient permissions` sin decir cual de los dos campos
 * fallo.
 *
 * Se leen del token porque el token es lo que el servidor va a comparar.
 * `undefined` significa que el claim no viene; la regla entonces no lo exige
 * (`!('name' in request.auth.token)`).
 */
export type MplusIdentityClaims = Readonly<{
  name: string | undefined;
  picture: string | undefined;
}>;

export const readIdentityClaims = async (): Promise<MplusIdentityClaims> => {
  if (!isFirebaseConfigured()) {
    return { name: undefined, picture: undefined };
  }

  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return { name: undefined, picture: undefined };
  }

  const token = await getIdTokenResult(user);
  const name = token.claims.name;
  const picture = token.claims.picture;

  return {
    name: typeof name === "string" ? name : undefined,
    picture: typeof picture === "string" ? picture : undefined,
  };
};

export const forceGoogleAccountSelection = () => {
  if (!isFirebaseConfigured()) {
    return;
  }

  getGoogleProvider().setCustomParameters({ prompt: "select_account" });
};

export { completeResetSessionExit, type SessionExitOptions } from "./session-exit";

