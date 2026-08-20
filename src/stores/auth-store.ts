import { create } from "zustand";

import type { AuthStatus, AuthUser } from "@/features/auth/types";

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * W1 — mensaje del último bootstrap remoto fallido (`users/{uid}` + seed
   * Personal v1). Web es online-only: si el servidor no confirmó la creación
   * de la cuenta, eso no puede quedar en un `console.warn`. El inicio de
   * sesión explícito ya falla de forma visible; este campo cubre el otro
   * camino, la sesión ya viva que se rehidrata al recargar la pestaña.
   */
  bootstrapError: string | null;
  setSession: (user: AuthUser) => void;
  clearSession: () => void;
  setLoading: () => void;
  setBootstrapError: (message: string) => void;
  clearBootstrapError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  isAuthenticated: false,
  bootstrapError: null,
  setSession: (user) => set({ status: "authenticated", user, isAuthenticated: true }),
  clearSession: () =>
    set({ status: "unauthenticated", user: null, isAuthenticated: false, bootstrapError: null }),
  setLoading: () => set({ status: "loading" }),
  setBootstrapError: (message) => set({ bootstrapError: message }),
  clearBootstrapError: () => set({ bootstrapError: null }),
}));
