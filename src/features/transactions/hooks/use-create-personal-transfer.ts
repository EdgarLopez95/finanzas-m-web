import { useRef, useState } from "react";

import { createPersonalTransfer } from "@/features/transactions/services/create-personal-transfer";
import { createThirdPartyLocationTransfer } from "@/features/transactions/services/create-third-party-location-transfer";
import { ensureThirdPartyLocationLedger } from "@/features/transactions/services/ensure-third-party-location-ledger";
import { createSingleFlightSubmitGuard } from "@/features/transactions/lib/single-flight-submit-guard";
import type { CreateTransferInput } from "@/types/transaction";

type CreateTransferState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateTransferState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreatePersonalTransfer = () => {
  const [state, setState] = useState<CreateTransferState>(initialState);
  const guardRef = useRef(createSingleFlightSubmitGuard());

  const submitTransfer = async (payload: CreateTransferInput): Promise<boolean> => {
    if (!guardRef.current.tryAcquire()) return false;

    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      if (payload.movesThirdPartyFunds === true) {
        // Rama OCC: bootstrap del ledger + transferencia atómica con atribución
        await ensureThirdPartyLocationLedger(payload.ownerId);
        await createThirdPartyLocationTransfer({
          ownerId: payload.ownerId,
          operationId: crypto.randomUUID(),
          amount: payload.amount,
          fromAccountId: payload.accountId,
          fromPocketId: payload.pocketId ?? null,
          toAccountId: payload.targetAccountId,
          toPocketId: payload.targetPocketId ?? null,
          date: payload.date,
          description: payload.description,
        });
      } else {
        // Rama normal: transferencia sin atribución de dinero no propio
        await createPersonalTransfer(payload);
      }

      setState({
        isSubmitting: false,
        error: null,
        successMessage: "Transferencia creada correctamente.",
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear la transferencia.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    } finally {
      guardRef.current.release();
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitTransfer,
    resetFeedback,
  };
};