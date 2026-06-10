import type { AuthStatus } from "@/features/auth/types";

type AuthArea = "public" | "protected" | "legacy-login";

type AuthRedirectInput = {
  area: AuthArea;
  status: AuthStatus;
};

export const getAuthRedirectPath = ({ area, status }: AuthRedirectInput): string | null => {
  if (area === "legacy-login") {
    return "/";
  }

  if (area === "public") {
    return status === "authenticated" ? "/dashboard" : null;
  }

  if (area === "protected") {
    return status === "unauthenticated" ? "/" : null;
  }

  return null;
};
