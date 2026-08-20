import { DISPLAY_NAME_MAX_LENGTH, PHOTO_URL_MAX_LENGTH } from "@/lib/mplus/catalogs";
import type { HouseholdMemberIdentity } from "./types";

type FirebaseProfileSource = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

/** Nombre por defecto cuando Google no devuelve `displayName`. */
export const DEFAULT_MEMBER_DISPLAY_NAME = "Usuario Finanzas M+";

/**
 * Construye la identidad mínima compartida a partir del usuario de Firebase
 * Auth (contrato §11.1).
 *
 * Reglas que aplica, alineadas con `validMemberShape` de las Rules canónicas:
 *
 * - `displayName` recortado, no vacío, máximo 100 caracteres;
 * - `photoUrl` vacía salvo que sea HTTPS y quepa en 2048 caracteres —
 *   una `http://` o un `data:` se descartan, no se "arreglan";
 * - el correo NUNCA se copia: no existe campo para él en el contrato.
 *
 * Esto NO escribe `users/{uid}`: ese documento lo crea
 * `ensureMplusUserBootstrap` y no contiene identidad.
 */
export const buildHouseholdMemberIdentity = (
  user: FirebaseProfileSource,
): HouseholdMemberIdentity => {
  const rawName = (user.displayName ?? "").trim();
  const displayName = (rawName.length > 0 ? rawName : DEFAULT_MEMBER_DISPLAY_NAME).slice(
    0,
    DISPLAY_NAME_MAX_LENGTH,
  );

  const rawPhoto = (user.photoURL ?? "").trim();
  const photoUrl =
    rawPhoto.startsWith("https://") && rawPhoto.length <= PHOTO_URL_MAX_LENGTH
      ? rawPhoto
      : "";

  return { displayName, photoUrl };
};
