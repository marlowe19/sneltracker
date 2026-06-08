/**
 * Normalize fixed expense price to monthly amount.
 */
export function toMonthlyPrice(price, period) {
  const p = Number(price);
  if (!p || Number.isNaN(p)) return 0;
  if (period === "month") return p;
  if (period === "quarter") return p / 3;
  if (period === "year") return p / 12;
  return 0;
}

/**
 * @param {Array<{ price: number, period: string, category?: string }>} expenses
 * @returns {{ businessMonthly: number, privateMonthly: number }}
 */
export function sumFixedExpensesByCategory(expenses) {
  let businessMonthly = 0;
  let privateMonthly = 0;

  for (const e of expenses ?? []) {
    const monthly = toMonthlyPrice(e.price, e.period);
    if (e.category === "private") {
      privateMonthly += monthly;
    } else {
      businessMonthly += monthly;
    }
  }

  return { businessMonthly, privateMonthly };
}
