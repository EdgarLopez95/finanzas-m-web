import { useEffect, useMemo } from "react";

import {
  usePersonalDataStore,
  type PersonalDashboardData,
  type PersonalDataStatus,
} from "@/stores/personal-data-store";

export type { PersonalDashboardData } from "@/stores/personal-data-store";

export type PersonalDashboardState = {
  status: PersonalDataStatus;
  data: PersonalDashboardData;
  error: string | null;
};

/**
 * Driver único de la carga de datos personales. Debe montarse en UN solo lugar
 * (el shell del dashboard) para evitar que varios componentes disparen load/reset
 * en conflicto. Las páginas solo LEEN con `usePersonalDashboardData()`.
 */
export const usePersonalDataLoader = (ownerId: string | null, enabled: boolean) => {
  const load = usePersonalDataStore((state) => state.load);
  const reset = usePersonalDataStore((state) => state.reset);

  useEffect(() => {
    if (!ownerId || !enabled) {
      reset();
      return;
    }

    void load(ownerId);
  }, [enabled, load, ownerId, reset]);
};

/**
 * Lectura pura (sin efectos) de los datos personales desde el store global, más
 * los derivados memoizados. Persiste entre navegaciones; no vuelve a consultar
 * Firestore en cada cambio de sección. `refresh()` fuerza una recarga.
 */
export const usePersonalDashboardData = () => {
  const status = usePersonalDataStore((state) => state.status);
  const data = usePersonalDataStore((state) => state.data);
  const error = usePersonalDataStore((state) => state.error);
  const refresh = usePersonalDataStore((state) => state.refresh);

  const totalBalance = useMemo(
    () => data.accounts.reduce((sum, account) => sum + account.balance, 0),
    [data.accounts],
  );

  const totalNoPropioPendiente = data.totalNoPropioPendiente;
  const hasThirdPartyInconsistency = data.hasThirdPartyInconsistency;

  const dineroPropio = useMemo(
    () => totalBalance - totalNoPropioPendiente,
    [totalBalance, totalNoPropioPendiente],
  );

  return {
    status,
    data,
    error,
    totalBalance,
    totalNoPropioPendiente,
    hasThirdPartyInconsistency,
    dineroPropio,
    refresh,
  };
};
