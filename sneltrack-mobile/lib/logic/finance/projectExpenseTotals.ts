// lib/logic/finance/projectExpenseTotals.ts
// Ported 1:1 from sneltrack/lib/finance/projectExpenseTotals.js
// Expenses already invoiced/collected from client — not a net cost for the user.

const RECOVERED_BILLING_STATUSES = new Set(["billed", "paid"]);

export interface ProjectExpenseLike {
  billing_status?: string | null;
  user_name?: string;
  price?: number | string;
}

export function isCountableProjectExpense(expense: ProjectExpenseLike | null | undefined): boolean {
  const status = expense?.billing_status ?? "draft";
  return !RECOVERED_BILLING_STATUSES.has(status);
}

/**
 * Sum own project expenses that still count as out-of-pocket business cost.
 */
export function sumOwnProjectExpenses(
  expenses: ProjectExpenseLike[] | null | undefined,
  userName: string
): number {
  let total = 0;
  for (const e of expenses ?? []) {
    if (e.user_name !== userName) continue;
    if (!isCountableProjectExpense(e)) continue;
    total += Number(e.price) || 0;
  }
  return total;
}

export function hasOwnCountableProjectExpenses(
  expenses: ProjectExpenseLike[] | null | undefined,
  userName: string
): boolean {
  return (expenses ?? []).some((e) => e.user_name === userName && isCountableProjectExpense(e));
}
