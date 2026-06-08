/**
 * Waterfall: earnings → business costs → tax reserve (on profit) → net → private costs → free to spend.
 */

export function computeTaxReserve(profit, taxReservePct) {
  const p = Number(profit) || 0;
  const pct = Number(taxReservePct) || 0;
  if (p <= 0 || pct <= 0) return 0;
  return p * (pct / 100);
}

export function computeNetAfterTax(earnings, businessCostsMonthly, taxReservePct) {
  const profit = (Number(earnings) || 0) - (Number(businessCostsMonthly) || 0);
  const taxReserve = computeTaxReserve(profit, taxReservePct);
  return profit - taxReserve;
}

/**
 * @param {{
 *   earnings: number,
 *   businessCostsMonthly: number,
 *   privateCostsMonthly: number,
 *   taxReservePct?: number,
 * }} args
 */
export function computeMonthFinance({
  earnings,
  businessCostsMonthly,
  privateCostsMonthly,
  taxReservePct = 35,
}) {
  const e = Number(earnings) || 0;
  const business = Number(businessCostsMonthly) || 0;
  const priv = Number(privateCostsMonthly) || 0;
  const pct = Number(taxReservePct) || 0;

  const profit = e - business;
  const taxReserve = computeTaxReserve(profit, pct);
  const netAfterTax = profit - taxReserve;
  const freeToSpend = netAfterTax - priv;

  const expensePercentage = (() => {
    if (e <= 0) return 0;
    return Math.min(100, Math.round((business / e) * 100));
  })();

  return {
    profit,
    taxReserve,
    taxReservePct: pct,
    netAfterTax,
    freeToSpend,
    expensePercentage,
  };
}
