import {
  doc,
  getDocFromServer,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { MPLUS_PATHS } from "@/lib/mplus/paths";

export type HouseholdSharePreflightInput = Readonly<{
  uid: string;
  householdId: string;
  householdCategoryId?: string | null;
}>;

export type HouseholdSharePreflightDeps = Readonly<{
  getDoc?: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  getDocFromServer?: (ref: DocumentReference) => Promise<DocumentSnapshot>;
}>;

export type HouseholdSharePreflightResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string; code: string }>;

/**
 * Verificación remota previa a confirmar "Contar en Hogar".
 * Realiza lectura explícita desde el servidor (bypassing local cache) de:
 * 1. users/{uid}: status === ready, householdId === destino y membershipState === active;
 * 2. households/{householdId}: status === active y uid en memberAId/memberBId;
 * 3. households/{householdId}/members/{uid}: state === active;
 * 4. si hay householdCategoryId, categoría activa en servidor.
 *
 * Si una lectura es denegada, inexistente o no cumple, retorna ok: false con causa explícita.
 */
export const verifyHouseholdSharePreflight = async (
  input: HouseholdSharePreflightInput,
  options?: {
    db?: Firestore;
    deps?: HouseholdSharePreflightDeps;
  },
): Promise<HouseholdSharePreflightResult> => {
  if (!input.uid) {
    return {
      ok: false,
      reason: "No se identificó una sesión activa para verificar permisos de Hogar.",
      code: "no_uid",
    };
  }
  if (!input.householdId) {
    return {
      ok: false,
      reason: "No se especificó el Hogar con el que se desea compartir.",
      code: "no_household",
    };
  }

  const db = options?.db ?? getFirebaseDb();
  const getDocFn = options?.deps?.getDocFromServer ?? options?.deps?.getDoc ?? getDocFromServer;

  try {
    // 1. users/{uid}
    const userRef = doc(db, MPLUS_PATHS.users, input.uid);
    const userSnap = await getDocFn(userRef);
    if (!userSnap.exists()) {
      return {
        ok: false,
        reason: "Tu perfil de usuario no existe en el servidor.",
        code: "user_not_found",
      };
    }
    const userData = userSnap.data() as Record<string, unknown>;
    if (userData.status !== "ready") {
      return {
        ok: false,
        reason: "Tu cuenta de usuario no está en estado activo (reinicio en curso).",
        code: "user_not_ready",
      };
    }
    if (userData.householdId !== input.householdId) {
      return {
        ok: false,
        reason: "El Hogar de tu perfil no coincide con el Hogar seleccionado.",
        code: "user_household_mismatch",
      };
    }
    if (userData.householdMembershipState !== "active") {
      return {
        ok: false,
        reason: "Tu membresía en el Hogar no está activa en tu perfil.",
        code: "user_membership_not_active",
      };
    }

    // 2. households/{householdId}
    const hhRef = doc(db, MPLUS_PATHS.households, input.householdId);
    const hhSnap = await getDocFn(hhRef);
    if (!hhSnap.exists()) {
      return {
        ok: false,
        reason: "El Hogar seleccionado no existe en el servidor.",
        code: "household_not_found",
      };
    }
    const hhData = hhSnap.data() as Record<string, unknown>;
    if (hhData.status !== "active") {
      return {
        ok: false,
        reason: "El Hogar no se encuentra en estado activo para compartir movimientos.",
        code: "household_not_active",
      };
    }
    if (hhData.memberAId !== input.uid && hhData.memberBId !== input.uid) {
      return {
        ok: false,
        reason: "No estás registrado como miembro canónico de este Hogar.",
        code: "not_canonical_member",
      };
    }

    // 3. households/{householdId}/members/{uid}
    const memberRef = doc(db, MPLUS_PATHS.households, input.householdId, MPLUS_PATHS.members, input.uid);
    const memberSnap = await getDocFn(memberRef);
    if (!memberSnap.exists()) {
      return {
        ok: false,
        reason: "Tu registro de integrante del Hogar no existe en el servidor.",
        code: "member_not_found",
      };
    }
    const memberData = memberSnap.data() as Record<string, unknown>;
    if (memberData.state !== "active") {
      return {
        ok: false,
        reason: "Tu membresía en el Hogar no se encuentra activa.",
        code: "member_not_active",
      };
    }

    // 4. households/{householdId}/expenseCategories/{catId} (si aplica)
    if (input.householdCategoryId) {
      const catRef = doc(
        db,
        MPLUS_PATHS.households,
        input.householdId,
        MPLUS_PATHS.expenseCategories,
        input.householdCategoryId,
      );
      const catSnap = await getDocFn(catRef);
      if (!catSnap.exists()) {
        return {
          ok: false,
          reason: "La categoría de Hogar seleccionada no existe en el servidor.",
          code: "category_not_found",
        };
      }
      const catData = catSnap.data() as Record<string, unknown>;
      if (catData.state !== "active") {
        return {
          ok: false,
          reason: "La categoría de Hogar seleccionada no se encuentra activa.",
          code: "category_not_active",
        };
      }
    }

    return { ok: true };
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (
      code === "permission-denied" ||
      (error instanceof Error && error.message.toLowerCase().includes("permission"))
    ) {
      return {
        ok: false,
        reason: "El servidor denegó el acceso para verificar el Hogar (permisos insuficientes).",
        code: "permission_denied",
      };
    }
    return {
      ok: false,
      reason: "No fue posible verificar el estado del Hogar en el servidor. Revisa tu conexión.",
      code: "network_error",
    };
  }
};
