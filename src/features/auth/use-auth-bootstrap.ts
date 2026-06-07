"use client";

import { useEffect } from "react";

import { onAuthState } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";

let authBootstrapStarted = false;

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
