"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { onAuthState } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";

export const useAuthBootstrap = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    setLoading();

    const unsubscribe = onAuthState((user) => {
      if (user) {
        setSession(user);
        return;
      }

      clearSession();
    });

    return () => unsubscribe();
  }, [clearSession, setLoading, setSession]);

  return useAuthStore(
    useShallow((state) => ({
      status: state.status,
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    }))
  );
};
