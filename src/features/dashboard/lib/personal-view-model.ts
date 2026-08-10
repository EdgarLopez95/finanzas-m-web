import { buildTransactionFallbackTitle } from "@/features/transactions/services/read-personal-transactions";
import { isTechnicalTransaction } from "@/features/transactions/lib/technical-transactions";
import { formatPersonalMovementDateEs } from "@/lib/format/date";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";

export type ExpenseCategoryBreakdownItem = {
  categoryId: string;
  name: string;
  icon: string;
  amount: number;
  share: number;
  color?: string;
  iconKey?: string;
};

export type PersonalMovementRow = {
  id: string;
  title: string;
  subtitle: string;
  metadata: string;
  amount: number;
  type: Transaction["type"];
  dateLabel: string;
  groupLabel: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIconKey?: string;
  accountName?: string;
  accountColor?: string;
  accountIconKey?: string;
  accountIconType?: string;
  accountType?: string;
  pocketName?: string | null;
  targetAccountName?: string | null;
  targetPocketName?: string | null;
  accountId?: string;
  categoryId?: string;
  pocketId?: string | null;
  countsAsRealIncome: boolean;
  isHousehold: boolean;
};

const getComparableDate = (value: Date | null | undefined): Date | null => {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }

  return value;
};

const startOfDay = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

export const formatMovementGroupLabelEs = (
  value: Date | null | undefined,
  reference = new Date(),
): string => {
  const safeValue = getComparableDate(value);
  if (!safeValue) {
    return "Sin fecha";
  }

  const dayDifference = Math.round((startOfDay(reference) - startOfDay(safeValue)) / 86400000);
  if (dayDifference === 0) {
    return "Hoy";
  }

  if (dayDifference === 1) {
    return "Ayer";
  }

  return formatPersonalMovementDateEs(safeValue);
};

/**
 * Paridad Android: `HomeRepository.kt` (`sumMonthlyExpensesNetOfReimbursements`)
 * solo descuenta un movimiento `reimbursement` con `reimbursementDirection ===
 * "incoming"` y `relatedDebtId` no vacío. Reembolsos salientes, ingresos,
 * transferencias y reembolsos sin deuda vinculada nunca reducen el gasto.
 */
export const isIncomingDebtReimbursement = (transaction: Transaction): boolean =>
  transaction.type === "reimbursement" &&
  transaction.reimbursementDirection === "incoming" &&
  !!transaction.relatedDebtId;



/**
 * Paridad Android: `TransactionRepository.kt` `isTechnicalBalanceMovement(description)`
 * compara la descripción (en Web, `title`, que es el campo equivalente ya
 * usado por el precedente WA-PER-003 en `personal-views.tsx`) recortada
 * (`trim`) contra las 2 etiquetas canónicas exactas — sin plegar mayúsculas,
 * igual que Android. "Saldo inicial", "Ajuste manual de saldo" y "Cierre de bolsillo"
 * mueven el saldo de una cuenta pero no son gasto de consumo real.
 */
export const isTechnicalBalanceMovement = (transaction: Transaction): boolean => {
  return isTechnicalTransaction(transaction.title);
};

/**
 * Paridad Android: `TransactionRepository.kt` `isCountableMonthlyExpense()`.
 * Un gasto solo cuenta para métricas mensuales (KPI y desglose por
 * categoría) si es `expense` Y no es un ajuste técnico de saldo.
 */
export const isCountableMonthlyExpense = (transaction: Transaction): boolean =>
  transaction.type === "expense" && !isTechnicalBalanceMovement(transaction);

/**
 * Gasto personal neto del período (paridad Android
 * `sumMonthlyExpensesNetOfReimbursements`): gastos personales CONTABLES
 * (excluye ajustes técnicos de saldo) menos reembolsos entrantes vinculados
 * a una deuda del Hogar. El caso canónico Gerson/Familia: $120.000 de gasto
 * - $60.000 de reembolso entrante = $60.000. El resultado nunca es
 * negativo. `transactions` debe venir ya acotado al período (mes) que se
 * quiere medir — esta función no filtra por fecha.
 */
export const computeNetPersonalExpenses = (transactions: Transaction[]): number => {
  const grossExpenses = transactions
    .filter(isCountableMonthlyExpense)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const incomingDebtReimbursements = transactions
    .filter(isIncomingDebtReimbursement)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return Math.max(0, grossExpenses - incomingDebtReimbursements);
};

export const buildExpenseCategoryBreakdown = (
  transactions: Transaction[],
  categories: Category[],
): ExpenseCategoryBreakdownItem[] => {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const totalsByCategoryId = new Map<string, number>();

  for (const transaction of transactions) {
    if (!isCountableMonthlyExpense(transaction) || !transaction.categoryId) {
      continue;
    }

    totalsByCategoryId.set(
      transaction.categoryId,
      (totalsByCategoryId.get(transaction.categoryId) ?? 0) + transaction.amount,
    );
  }

  // Paridad Android: descontar por categoría los reembolsos entrantes
  // vinculados a deuda que resuelvan la misma categoría del gasto origen. Un
  // reembolso sin categoría reduce el KPI total (fuera de este desglose) pero
  // nunca inventa ni descuenta una categoría arbitraria aquí.
  for (const transaction of transactions) {
    if (!isIncomingDebtReimbursement(transaction) || !transaction.categoryId) {
      continue;
    }
    const current = totalsByCategoryId.get(transaction.categoryId);
    if (current === undefined) {
      continue;
    }
    totalsByCategoryId.set(transaction.categoryId, Math.max(0, current - transaction.amount));
  }

  const totalExpense = Array.from(totalsByCategoryId.values()).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  return expenseCategories
    .map((category) => {
      const amount = totalsByCategoryId.get(category.id) ?? 0;

      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon,
        amount,
        share: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color: category.color,
        iconKey: category.iconKey,
      } satisfies ExpenseCategoryBreakdownItem;
    })
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount);
};

export const buildPersonalMovementRows = (
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  pockets: Pocket[] = [],
  referenceDate = new Date(),
): PersonalMovementRow[] => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const pocketsById = new Map(pockets.map((pocket) => [pocket.id, pocket]));

  return transactions.map((transaction) => {
    const movementDate = getComparableDate(transaction.date ?? transaction.createdAt);
    const category = categoriesById.get(transaction.categoryId);
    const account = accountsById.get(transaction.accountId);
    // Paso 2 (2.6.5): una transacción cuya cuenta ya no existe (eliminada, no
    // solo cerrada) debe degradar honestamente a "Cuenta eliminada" — nunca
    // sustituir por otra cuenta ni lanzar. Cuentas cerradas (archived=true)
    // siguen existiendo como documento y resuelven normalmente por su nombre.
    const accountName = account?.name ?? "Cuenta eliminada";
    const pocketName = transaction.pocketId
      ? pocketsById.get(transaction.pocketId)?.name ?? "Bolsillo eliminado"
      : null;
    const targetAccountName = transaction.targetAccountId
      ? accountsById.get(transaction.targetAccountId)?.name ?? "Cuenta destino"
      : null;
    const targetPocketName = transaction.targetPocketId
      ? pocketsById.get(transaction.targetPocketId)?.name ?? "Bolsillo eliminado"
      : null;

    const metadata =
      transaction.type === "transfer"
        ? `Destino: ${targetAccountName ?? "Cuenta destino"}${targetPocketName ? ` / ${targetPocketName}` : ""}`
        : pocketName
          ? `Bolsillo: ${pocketName}`
        : category?.name ?? "Sin categoría";

    const subtitle =
      transaction.notes.trim().length > 0
        ? transaction.notes
        : transaction.type === "transfer"
          ? `Transferencia - ${accountName}${pocketName ? ` / ${pocketName}` : ""}`
          : pocketName
            ? `${category?.name ?? "Sin categoría"} - ${accountName} / ${pocketName}`
          : `${category?.name ?? "Sin categoría"} - ${accountName}`;

    return {
      id: transaction.id,
      title: buildTransactionFallbackTitle(transaction.title, transaction.type, category?.name),
      subtitle,
      metadata,
      amount: transaction.amount,
      type: transaction.type,
      dateLabel: movementDate ? formatPersonalMovementDateEs(movementDate) : "Sin fecha",
      groupLabel: formatMovementGroupLabelEs(movementDate, referenceDate),
      categoryName: category?.name,
      categoryColor: category?.color,
      categoryIconKey: category?.iconKey,
      accountName,
      accountColor: account?.color,
      accountIconKey: account?.iconKey,
      accountIconType: account?.iconType,
      accountType: account?.type,
      pocketName,
      targetAccountName,
      targetPocketName,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId || undefined,
      pocketId: transaction.pocketId,
      countsAsRealIncome: transaction.countsAsRealIncome !== false,
      isHousehold: transaction.isHousehold === true,
    } satisfies PersonalMovementRow;
  });
};
