"use client";

import { useEffect } from "react";

import { onAuthState } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import { useAppContextStore } from "@/stores/app-context-store";

let authBootstrapStarted = false;

/**
 * Último `uid` observado por el listener de Firebase Auth de esta pestaña.
 * `undefined` significa "todavía no se resolvió ninguna sesión" (carga
 * inicial de la pestaña, sin sesión previa que limpiar).
 */
let lastObservedUid: string | null | undefined = undefined;

/**
 * Corrección P1.1 Paso 10 — decisión pura de si un nuevo `uid` observado por
 * Firebase Auth representa un cambio real de sesión (logout, login de otro
 * usuario, o ambos sin recargar la pestaña) que exige limpiar el contexto
 * Personal/Hogar y el bootstrap ya resuelto de la sesión anterior.
 *
 * `previousUid === undefined` es la primera resolución de la pestaña: no hay
 * sesión previa que limpiar, así que nunca cuenta como cambio. Un callback
 * repetido para el MISMO uid (p. ej. refresco de token) tampoco cuenta —
 * eso no es un cambio de usuario, es la navegación/actividad normal de la
 * misma sesión.
 */
export const shouldResetSessionForUidChange = (
  previousUid: string | null | undefined,
  nextUid: string | null
): boolean => previousUid !== undefined && previousUid !== nextUid;

export const useAuthBootstrap = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (authBootstrapStarted) {
      return;
    }
    authBootstrapStarted = true;

    setLoading();
    let resolved = false;
    const bootstrapTimeout = setTimeout(() => {
      if (!resolved) {
        clearSession();
      }
    }, 8000);

    onAuthState((user) => {
      resolved = true;
      clearTimeout(bootstrapTimeout);

      const nextUid = user?.uid ?? null;
      if (shouldResetSessionForUidChange(lastObservedUid, nextUid)) {
        useAppContextStore.getState().resetForSessionBoundary();
      }
      lastObservedUid = nextUid;

      if (user) {
        setSession(user);
        return;
      }

      clearSession();
    });
  }, [clearSession, setLoading, setSession]);

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return { status, user, isAuthenticated };
};
