"use client";

import { useMemo } from "react";
import { Receipt, Time, Money } from "@carbon/icons-react";
import { computeBreakEvenTimeline } from "@/lib/finance/breakEvenTimeline";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function formatHoursOneDecimal(hours) {
  return (
    new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(hours ?? 0) + " uur"
  );
}

function WaterfallRow({ label, amount, variant = "default" }) {
  const isDeduction = variant === "deduction";
  const isHighlight = variant === "highlight";

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span
        className={
          isHighlight ? "font-semibold text-gray-900" : "text-gray-600"
        }
      >
        {label}
      </span>
      <span
        className={
          isHighlight
            ? "font-semibold text-gray-900"
            : isDeduction
              ? "text-gray-700"
              : "text-gray-900"
        }
      >
        {isDeduction ? `− ${formatMoney(amount)}` : formatMoney(amount)}
      </span>
    </div>
  );
}

function dayToPct(day, daysInMonth) {
  if (day == null || daysInMonth <= 1) return 0;
  return ((day - 1) / (daysInMonth - 1)) * 100;
}

function markerPositionStyle(pct, styleOffset = 0) {
  return {
    left: `${pct}%`,
    transform: `translate(calc(-50% + ${styleOffset}px), 0)`,
  };
}

function TimelineTargetMarker({
  pct,
  icon: Icon,
  lineClass,
  badgeClass,
  label,
  dateLabel,
  styleOffset = 0,
}) {
  return (
    <div
      className="absolute inset-y-0 z-10 w-0 pointer-events-none"
      style={markerPositionStyle(pct, styleOffset)}
      aria-label={`${label}, ${dateLabel}`}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md ${badgeClass}`}
        >
          <Icon size={12} className="text-white shrink-0" aria-hidden />
        </div>
      </div>
      <div
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full ${lineClass}`}
        aria-hidden
      />
    </div>
  );
}

function TimelineTargetLabel({
  pct,
  dateLabel,
  caption,
  colorClass,
  styleOffset = 0,
}) {
  return (
    <div
      className="absolute top-0 flex w-16 flex-col items-center text-center leading-tight"
      style={markerPositionStyle(pct, styleOffset)}
    >
      <span className={`text-[10px] font-semibold ${colorClass}`}>
        {dateLabel}
      </span>
      <span className="text-[9px] text-gray-500">{caption}</span>
    </div>
  );
}

function BreakEvenTimeline({
  earnings,
  businessBreakEvenDate,
  businessCostsMonthly,
  breakEvenDate,
  freeToSpend,
  projectedFreeToSpendEnd,
  formatAmount = formatMoney,
}) {
  const referenceDate = new Date();
  const monthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const monthEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  );
  const daysInMonth = monthEnd.getDate();
  const monthShort = monthStart.toLocaleDateString("nl-NL", { month: "short" });
  const todayDay = referenceDate.getDate();
  const todayPct = dayToPct(todayDay, daysInMonth);
  const businessDay = businessBreakEvenDate?.getDate() ?? null;
  const privateDay = breakEvenDate?.getDate() ?? null;
  const businessPct = dayToPct(businessDay, daysInMonth);
  const privatePct = dayToPct(privateDay, daysInMonth);
  const showBusinessMarker =
    businessCostsMonthly > 0 && businessBreakEvenDate != null;

  const markerOffsets = (() => {
    const positions = [
      ...(showBusinessMarker
        ? [{ key: "business", pct: businessPct, offset: 0 }]
        : []),
      ...(breakEvenDate
        ? [{ key: "private", pct: privatePct, offset: 0 }]
        : []),
    ].sort((a, b) => a.pct - b.pct);

    for (let i = 1; i < positions.length; i++) {
      if (Math.abs(positions[i].pct - positions[i - 1].pct) < 8) {
        positions[i].offset = positions[i - 1].offset === 0 ? 14 : -14;
      }
    }

    return Object.fromEntries(positions.map((p) => [p.key, p.offset]));
  })();

  const businessCoveredNow =
    businessCostsMonthly <= 0 || earnings >= businessCostsMonthly;
  const privateCoveredNow = freeToSpend >= 0;

  const progressBarClass = privateCoveredNow
    ? "bg-green-500"
    : businessCoveredNow
      ? "bg-orange-500"
      : "bg-red-500";

  const todayLabel = referenceDate.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
  const formatTargetDate = (date) =>
    date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

  return (
    <div className="px-4 pb-4">
      <div className="relative pt-10">
        <div className="relative h-3.5">
          <div className="absolute inset-0 rounded-full bg-gray-200" />
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full ${progressBarClass}`}
            style={{ width: `${todayPct}%` }}
          />
          {showBusinessMarker && (
            <TimelineTargetMarker
              pct={businessPct}
              icon={Receipt}
              badgeClass="bg-orange-500"
              lineClass="bg-orange-500"
              label="Zakelijke kosten gedekt"
              dateLabel={formatTargetDate(businessBreakEvenDate)}
              styleOffset={markerOffsets.business ?? 0}
            />
          )}
          {breakEvenDate && (
            <TimelineTargetMarker
              pct={privatePct}
              icon={Money}
              badgeClass="bg-green-600"
              lineClass="bg-green-600"
              label="Privé kosten gedekt"
              dateLabel={formatTargetDate(breakEvenDate)}
              styleOffset={markerOffsets.private ?? 0}
            />
          )}
          <span
            className="absolute top-1/2 z-20 text-[9px] font-semibold text-white whitespace-nowrap pointer-events-none leading-none"
            style={
              todayPct < 14
                ? { left: "8px", transform: "translateY(-50%)" }
                : {
                    left: `${todayPct}%`,
                    transform: "translate(calc(-100% - 4px), -50%)",
                  }
            }
            aria-label={`Vandaag, ${todayLabel}`}
          >
            {todayLabel}
          </span>
        </div>
      </div>

      <div className="relative mt-2 h-9 text-[10px] text-gray-500">
        <span className="absolute left-0 top-0">
          {monthStart.getDate()} {monthShort}
        </span>
        {showBusinessMarker && businessBreakEvenDate && (
          <TimelineTargetLabel
            pct={businessPct}
            dateLabel={formatTargetDate(businessBreakEvenDate)}
            caption="Zakelijk"
            colorClass="text-orange-600"
            styleOffset={markerOffsets.business ?? 0}
          />
        )}
        {breakEvenDate && (
          <TimelineTargetLabel
            pct={privatePct}
            dateLabel={formatTargetDate(breakEvenDate)}
            caption="Privé"
            colorClass="text-green-700"
            styleOffset={markerOffsets.private ?? 0}
          />
        )}
        <span className="absolute right-0 top-0">
          {monthEnd.getDate()} {monthShort}
        </span>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-gray-600">
        {showBusinessMarker && businessBreakEvenDate && (
          <div>
            {businessCoveredNow ? (
              <span>Zakelijke kosten gedekt</span>
            ) : (
              <span>
                Zakelijke kosten gedekt rond{" "}
                {businessBreakEvenDate.toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        )}
        {breakEvenDate ? (
          <div>
            {privateCoveredNow ? (
              <span>Privé kosten gedekt</span>
            ) : (
              <span>
                Privé kosten gedekt rond{" "}
                {breakEvenDate.toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        ) : projectedFreeToSpendEnd != null ? (
          <div>
            Niet op tijd uit de kosten. Prognose vrij besteedbaar einde maand:{" "}
            {formatAmount(projectedFreeToSpendEnd)}
          </div>
        ) : (
          <div>Nog onvoldoende data voor prognose</div>
        )}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   earnings: number,
 *   hours?: number|null,
 *   businessCostsMonthly: number,
 *   privateCostsMonthly?: number,
 *   businessCostsYearly: number,
 *   taxReserve: number,
 *   taxReservePct: number,
 *   netAfterTax: number,
 *   freeToSpend: number,
 *   expensePercentage: number,
 *   earningsLoading?: boolean,
 *   hourlyRateForecast: number,
 *   weeklyHoursForecast: number,
 *   showForecastSettings?: boolean,
 *   onHourlyRateChange?: (rate: number) => void,
 *   onWeeklyHoursChange?: (hours: number) => void,
 *   onTaxReservePctChange?: (pct: number) => void,
 *   showTeamEarningsToggle?: boolean,
 *   includeTeamEarnings?: boolean,
 *   onIncludeTeamEarningsChange?: (include: boolean) => void,
 *   showWaterfallBreakdown?: boolean,
 *   showBusinessCostsSummary?: boolean,
 *   fixedBusinessCostsMonthly?: number,
 *   projectExpensesMonthly?: number,
 *   showProjectExpensesToggle?: boolean,
 *   includeProjectExpenses?: boolean,
 *   onIncludeProjectExpensesChange?: (include: boolean) => void,
 * }} props
 */
export default function MonthFinanceSummaryCard({
  earnings,
  hours = null,
  businessCostsMonthly,
  fixedBusinessCostsMonthly,
  projectExpensesMonthly = 0,
  privateCostsMonthly = 0,
  businessCostsYearly,
  taxReserve,
  taxReservePct,
  netAfterTax,
  freeToSpend,
  expensePercentage,
  earningsLoading = false,
  hourlyRateForecast,
  weeklyHoursForecast,
  showForecastSettings = false,
  onHourlyRateChange,
  onWeeklyHoursChange,
  onTaxReservePctChange,
  showTeamEarningsToggle = false,
  includeTeamEarnings = false,
  onIncludeTeamEarningsChange,
  showWaterfallBreakdown = true,
  showBusinessCostsSummary = true,
  showProjectExpensesToggle = false,
  includeProjectExpenses = false,
  onIncludeProjectExpensesChange,
}) {
  const isProfit = freeToSpend >= 0;
  const fixedBusiness = fixedBusinessCostsMonthly ?? businessCostsMonthly;
  const projectExpensesIncluded = includeProjectExpenses
    ? projectExpensesMonthly
    : 0;
  const costsWithTaxReserve = businessCostsMonthly + taxReserve;
  const totalMonthlyCosts = costsWithTaxReserve + privateCostsMonthly;

  const { businessBreakEvenDate, breakEvenDate, projectedFreeToSpendEnd } =
    useMemo(() => {
      if (earningsLoading) {
        return {
          businessBreakEvenDate: null,
          breakEvenDate: null,
          projectedFreeToSpendEnd: null,
        };
      }
      return computeBreakEvenTimeline({
        businessCostsMonthly,
        privateCostsMonthly,
        taxReservePct,
        earningsThisMonth: earnings,
        hourlyRateForecast,
        weeklyHoursForecast,
        referenceDate: new Date(),
      });
    }, [
      earnings,
      businessCostsMonthly,
      privateCostsMonthly,
      taxReservePct,
      hourlyRateForecast,
      weeklyHoursForecast,
      earningsLoading,
    ]);

  return (
    <div className="rounded-lg border border-gray-200 bg-[#f5f5f5] overflow-hidden">
      <div className="p-4">
        <div className="text-sm font-medium text-gray-500 mb-1.5">
          Verdiensten vs kosten deze maand
        </div>
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 text-lg font-semibold ${
              !earningsLoading && !showBusinessCostsSummary
                ? isProfit
                  ? "text-green-700"
                  : "text-red-700"
                : "text-gray-900"
            }`}
          >
            {earningsLoading ? (
              <span className="animate-pulse">...</span>
            ) : !showBusinessCostsSummary ? (
              <span>
                {formatMoney(earnings)}
                <span className="text-sm font-normal text-gray-500">
                  {" "}
                  / {formatMoney(totalMonthlyCosts)}
                </span>
              </span>
            ) : (
              formatMoney(earnings)
            )}
          </div>
          {!earningsLoading && (
            <span
              className={`shrink-0 px-2.5 py-1 rounded-md text-sm font-medium transition-colors duration-300 ${
                isProfit
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
              title="Vrij besteedbaar na belasting en privé kosten"
            >
              {isProfit
                ? `+ ${formatMoney(freeToSpend)}`
                : `− ${formatMoney(Math.abs(freeToSpend))}`}
            </span>
          )}
        </div>
      </div>

      {showWaterfallBreakdown && !earningsLoading && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-gray-200 pt-3">
          <WaterfallRow
            label="Zakelijke vaste kosten"
            amount={fixedBusiness}
            variant="deduction"
          />
          {projectExpensesIncluded > 0 && (
            <WaterfallRow
              label="Projectonkosten"
              amount={projectExpensesIncluded}
              variant="deduction"
            />
          )}
          {taxReserve > 0 && (
            <WaterfallRow
              label={`Belastingreserve (${taxReservePct}%)`}
              amount={taxReserve}
              variant="deduction"
            />
          )}
          <WaterfallRow
            label="Netto"
            amount={netAfterTax}
            variant="highlight"
          />
          {privateCostsMonthly > 0 && (
            <WaterfallRow
              label="Privé vaste kosten"
              amount={privateCostsMonthly}
              variant="deduction"
            />
          )}
        </div>
      )}

      {showBusinessCostsSummary && (
        <>
          <div className="flex items-center justify-between gap-3 px-4 pb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Receipt size={20} className="text-gray-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Zakelijke kosten
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatMoney(businessCostsMonthly)}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#008eff] transition-all duration-300"
                style={{ width: `${expensePercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pb-3 text-xs text-gray-500">
            <span>{expensePercentage}% van je inkomen</span>
            <span>Zakelijk per jaar: {formatMoney(businessCostsYearly)}</span>
          </div>
        </>
      )}

      {showTeamEarningsToggle && (
        <div className="px-4 pb-3 border-t border-gray-200 pt-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTeamEarnings}
              onChange={(e) => onIncludeTeamEarningsChange?.(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#008eff] focus:ring-[#008eff]"
              aria-label="Teamleden meerekenen in verdiensten"
            />
            <span className="text-sm text-gray-700">
              Teamleden meerekenen in verdiensten
            </span>
          </label>
        </div>
      )}

      {showProjectExpensesToggle && (
        <div className="px-4 pb-3 border-t border-gray-200 pt-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeProjectExpenses}
              onChange={(e) =>
                onIncludeProjectExpensesChange?.(e.target.checked)
              }
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#008eff] focus:ring-[#008eff]"
              aria-label="Projectonkosten meerekenen in zakelijke kosten"
            />
            <span className="text-sm text-gray-700">
              Projectonkosten meerekenen in zakelijke kosten
            </span>
          </label>
          <p className="mt-1.5 text-[11px] text-gray-500 pl-7">
            Alleen jouw onkosten, exclusief al gefactureerd of betaald (
            {formatMoney(projectExpensesMonthly)} deze maand)
          </p>
        </div>
      )}

      {showForecastSettings && (
        <div className="px-4 pb-3 border-t border-gray-200 pt-3">
          <div className="text-xs font-medium text-gray-600 mb-3">
            Prognose instellingen
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-[11px] text-gray-500">
                Uurtarief (€/uur)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={hourlyRateForecast}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && onHourlyRateChange) {
                    onHourlyRateChange(v);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base bg-white"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-gray-500">
                Uren per week
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={weeklyHoursForecast}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && onWeeklyHoursChange) {
                    onWeeklyHoursChange(v);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base bg-white"
              />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="block text-[11px] text-gray-500">
                Belastingreserve (% van winst)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={taxReservePct}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && onTaxReservePctChange) {
                    onTaxReservePctChange(v);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base bg-white"
              />
            </label>
          </div>
        </div>
      )}

      {!earningsLoading && (
        <div
          className={
            !showWaterfallBreakdown && !showBusinessCostsSummary
              ? "border-t border-gray-200"
              : ""
          }
        >
          <BreakEvenTimeline
            earnings={earnings}
            businessBreakEvenDate={businessBreakEvenDate}
            businessCostsMonthly={businessCostsMonthly}
            breakEvenDate={breakEvenDate}
            freeToSpend={freeToSpend}
            projectedFreeToSpendEnd={projectedFreeToSpendEnd}
          />
        </div>
      )}
    </div>
  );
}
