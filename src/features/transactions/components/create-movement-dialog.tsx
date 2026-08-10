"use client";

import { useState } from "react";

import { FinanceDialog } from "@/components/finance/finance-dialog";
import { DiscardConfirmDialog } from "@/components/finance/discard-confirm-dialog";
import { CreateExpenseCard } from "./create-expense-card";
import { CreateIncomeCard } from "./create-income-card";
import { CreateTransferCard } from "./create-transfer-card";
import { EditTransactionCard } from "./edit-transaction-card";
import {
  OPERATION_CONTEXT_LINE,
  OperationSelector,
  type OperationKind,
} from "./composer/operation-selector";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";

export function CreateMovementDialog() {
  const { user } = useAuthBootstrap();
  const personalData = usePersonalDashboardData();

  const panelKind = useTransactionPanelStore((state) => state.kind);
  const panelTransaction = useTransactionPanelStore((state) => state.transaction);
  const defaultAccountId = useTransactionPanelStore((state) => state.defaultAccountId);
  const defaultPocketId = useTransactionPanelStore((state) => state.defaultPocketId);
  const openCreate = useTransactionPanelStore((state) => state.openCreate);
  const closePanel = useTransactionPanelStore((state) => state.close);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isEditMode = panelKind === "edit";
  const activeTab = (isEditMode && panelTransaction ? panelTransaction.type : panelKind) as OperationKind;
  const isOpen = panelKind === "expense" || panelKind === "income" || panelKind === "transfer" || (isEditMode && Boolean(panelTransaction));

  if (!isOpen) {
    return null;
  }

  const handleCreated = async () => {
    await personalData.refresh();
    closePanel();
  };

  // Alcance: solo los composers de creación (gasto/ingreso/transferencia)
  // piden confirmación antes de perder lo escrito. Editar sigue cerrando
  // directo, como antes.
  const handleRequestClose = () => {
    if (isEditMode) {
      closePanel();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const handleOperationChange = (next: OperationKind) => {
    if (isEditMode) {
      return;
    }
    if (next === "transfer") {
      openCreate("transfer", defaultAccountId, defaultPocketId);
      return;
    }
    openCreate(next, defaultAccountId);
  };

  return (
    <>
    <FinanceDialog
      open={isOpen}
      onClose={handleRequestClose}
      size="composer"
      subtitle={isEditMode ? "Editar el movimiento registrado" : OPERATION_CONTEXT_LINE[activeTab]}
      title={
        <OperationSelector
          value={activeTab}
          onChange={handleOperationChange}
          locked={isEditMode}
        />
      }
    >
      {/*
        La estructura exterior del diálogo no cambia al alternar operación:
        solo el contenido se reemplaza con una transición corta (`key`).
      */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
        {panelKind === "edit" && panelTransaction && (
          <EditTransactionCard
            accounts={personalData.data.accounts}
            pockets={personalData.data.pockets}
            categories={personalData.data.categories}
            movement={panelTransaction}
            onCancel={closePanel}
            onUpdated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
          />
        )}

        {panelKind === "expense" && (
          <CreateExpenseCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            defaultAccountId={defaultAccountId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={handleRequestClose}
          />
        )}

        {panelKind === "income" && (
          <CreateIncomeCard
            accounts={personalData.data.accounts}
            pockets={personalData.data.pockets}
            categories={personalData.data.categories}
            defaultAccountId={defaultAccountId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={handleRequestClose}
          />
        )}

        {panelKind === "transfer" && (
          <CreateTransferCard
            accounts={personalData.data.accounts}
            pockets={personalData.data.pockets}
            defaultAccountId={defaultAccountId || undefined}
            defaultPocketId={defaultPocketId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={handleRequestClose}
          />
        )}
      </div>
    </FinanceDialog>
    <DiscardConfirmDialog
      open={showDiscardConfirm}
      onKeepEditing={() => setShowDiscardConfirm(false)}
      onDiscard={() => {
        setShowDiscardConfirm(false);
        closePanel();
      }}
    />
    </>
  );
}
