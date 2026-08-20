export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
};

/**
 * Identidad mínima que Finanzas M+ llega a publicar en Firestore.
 *
 * Contrato §6.1/§6.3: `users/{uid}` NO guarda nombre, foto ni correo — el
 * perfil propio se lee de Firebase Auth. Lo único que se comparte es esta
 * identidad, y solo dentro de la membresía del Hogar
 * (`households/{id}/members/{uid}`, contrato §11.1), que la restringe a
 * `displayName` (1–100) y `photoUrl` (vacía o URL HTTPS de máximo 2048).
 *
 * El correo nunca aparece aquí ni en ninguna otra colección (contrato §3.11).
 */
export type HouseholdMemberIdentity = {
  displayName: string;
  photoUrl: string;
};
