import { signOutUser } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import { resetAllStoresForSessionBoundary } from "@/stores/session-boundary";

export type SessionExitOptions = {
  /** Ruta a navegar tras salir. Por defecto '/'. */
  redirectHref?: string;
  /** Función de navegación personalizada (por defecto window.location.assign). */
  navigate?: (href: string) => void;
  /** Override opcional de la función de signOut para pruebas unitarias. */
  signOutOverride?: () => Promise<void>;
};

/**
 * Salida unificada de sesión (tras reinicio de cuenta, logout de emergencia o cambio de sesión).
 *
 * Garantiza la secuencia estricta:
 * 1. `signOutUser()` en Firebase Auth (con captura de errores de red).
 * 2. `clearSession()` en AuthStore.
 * 3. `resetAllStoresForSessionBoundary()` para desuscribir listeners en tiempo real y resetear stores.
 * 4. Navegación dura a `/` (o la ruta provista).
 */
export const completeResetSessionExit = async (
  options?: SessionExitOptions,
): Promise<void> => {
  try {
    if (options?.signOutOverride) {
      await options.signOutOverride();
    } else {
      await signOutUser();
    }
  } catch {
    // Si falla el signOut remoto (ej. fallo de red), la limpieza local de stores
    // y la navegación al acceso deben ejecutarse de todas formas.
  }

  useAuthStore.getState().clearSession();
  resetAllStoresForSessionBoundary();

  const href = options?.redirectHref ?? "/";
  if (options?.navigate) {
    options.navigate(href);
  } else if (typeof window !== "undefined") {
    window.location.assign(href);
  }
};
