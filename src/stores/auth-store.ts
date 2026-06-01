import { create } from "zustand";

import type { AuthStatus, AuthUser } from "@/features/auth/types";

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (user: AuthUser) => void;
  clearSession: () => void;
  setLoading: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  isAuthenticated: false,
  setSession: (user) => set({ status: "authenticated", user, isAuthenticated: true }),
  clearSession: () => set({ status: "unauthenticated", user: null, isAuthenticated: false }),
  setLoading: () => set({ status: "loading" }),
}));