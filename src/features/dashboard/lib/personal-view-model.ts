import { buildTransactionFallbackTitle } from "@/features/transactions/services/read-personal-transactions";
import { formatPersonalMovementDateEs } from "@/lib/format/date";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

export type ExpenseCategoryBreakdownItem = {
  categoryId: string;
  name: string;
  icon: string;
  amount: number;
  share: number;
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

export const buildExpenseCategoryBreakdown = (
  transactions: Transaction[],
  categories: Category[],
): ExpenseCategoryBreakdownItem[] => {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const totalsByCategoryId = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !transaction.categoryId) {
      continue;
    }

    totalsByCategoryId.set(
      transaction.categoryId,
      (totalsByCategoryId.get(transaction.categoryId) ?? 0) + transaction.amount,
    );
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
      } satisfies ExpenseCategoryBreakdownItem;
    })
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount);
};

export const buildPersonalMovementRows = (
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  referenceDate = new Date(),
): PersonalMovementRow[] => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return transactions.map((transaction) => {
    const movementDate = getComparableDate(transaction.date ?? transaction.createdAt);
    const category = categoriesById.get(transaction.categoryId);
    const accountName = accountsById.get(transaction.accountId)?.name ?? "Cuenta";
    const targetAccountName = transaction.targetAccountId
      ? accountsById.get(transaction.targetAccountId)?.name ?? "Cuenta destino"
      : null;

    const metadata =
      transaction.type === "transfer"
        ? `Destino: ${targetAccountName ?? "Cuenta destino"}`
        : category?.name ?? "Sin categoria";

    const subtitle =
      transaction.notes.trim().length > 0
        ? transaction.notes
        : transaction.type === "transfer"
          ? `Transferencia - ${accountName}`
          : `${category?.name ?? "Sin categoria"} - ${accountName}`;

    return {
      id: transaction.id,
      title: buildTransactionFallbackTitle(transaction.title, transaction.type, category?.name),
      subtitle,
      metadata,
      amount: transaction.amount,
      type: transaction.type,
      dateLabel: movementDate ? formatPersonalMovementDateEs(movementDate) : "Sin fecha",
      groupLabel: formatMovementGroupLabelEs(movementDate, referenceDate),
    } satisfies PersonalMovementRow;
  });
};
