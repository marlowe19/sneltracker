/** Expenses already invoiced/collected from client — not a net cost for the user. */
const RECOVERED_BILLING_STATUSES = new Set(["billed", "paid"]);

export function isCountableProjectExpense(expense) {
  const status = expense?.billing_status ?? "draft";
  return !RECOVERED_BILLING_STATUSES.has(status);
}

/**
 * Sum own project expenses that still count as out-of-pocket business cost.
 */
export function sumOwnProjectExpenses(expenses, userName) {
  let total = 0;
  for (const e of expenses ?? []) {
    if (e.user_name !== userName) continue;
    if (!isCountableProjectExpense(e)) continue;
    total += Number(e.price) || 0;
  }
  return total;
}

export function hasOwnCountableProjectExpenses(expenses, userName) {
  return (expenses ?? []).some(
    (e) => e.user_name === userName && isCountableProjectExpense(e),
  );
}
