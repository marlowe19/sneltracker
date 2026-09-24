// lib/logic/finance/fixedExpenseTotals.ts
// Ported 1:1 from sneltrack/lib/finance/fixedExpenseTotals.js
// Normalize fixed expense price to monthly amount.

export type ExpensePeriod = "month" | "quarter" | "year" | string;

export function toMonthlyPrice(price: number | string, period: ExpensePeriod): number {
  const p = Number(price);
  if (!p || Number.isNaN(p)) return 0;
  if (period === "month") return p;
  if (period === "quarter") return p / 3;
  if (period === "year") return p / 12;
  return 0;
}

export interface FixedExpenseLike {
  price: number | string;
  period: ExpensePeriod;
  category?: string;
}

export interface FixedExpenseCategoryTotals {
  businessMonthly: number;
  privateMonthly: number;
}

export function sumFixedExpensesByCategory(
  expenses: FixedExpenseLike[] | null | undefined
): FixedExpenseCategoryTotals {
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
