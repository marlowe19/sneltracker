"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Add,
  Home,
  Car,
  Security,
  ShoppingCart,
} from "@carbon/icons-react";
import {
  PREDEFINED_EXPENSE_TYPES,
  PERIOD_OPTIONS,
  EXPENSE_CATEGORIES,
  getExpenseIconKey,
  getCategoryLabel,
  getSuggestedCategoryForExpenseType,
} from "@/lib/expenseTypes";
import { formatDateForAPI } from "@/lib/dateRangeUtils";
import MonthFinanceSummaryCard from "@/app/my/components/MonthFinanceSummaryCard";
import {
  DEFAULT_FORECAST_HOURLY_RATE,
  DEFAULT_FORECAST_WEEKLY_HOURS,
  DEFAULT_TAX_RESERVE_PCT,
  getForecastHourlyRate,
  getForecastWeeklyHours,
  getIncludeTeamEarnings,
  getIncludeProjectExpenses,
  getTaxReservePct,
  setForecastHourlyRate,
  setForecastWeeklyHours,
  setIncludeTeamEarnings,
  setIncludeProjectExpenses,
  setTaxReservePct,
} from "@/lib/preferences/forecastSettings";
import {
  canIncludeTeamEarnings,
  computeBillableTotals,
} from "@/lib/finance/earningsTotals";
import { sumFixedExpensesByCategory } from "@/lib/finance/fixedExpenseTotals";
import { computeMonthFinance } from "@/lib/finance/monthFinance";

const EXPENSE_REVIEW_DISMISSED_KEY = "sneltrack:expenseCategoryReviewDismissed";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function getPeriodLabel(period) {
  return PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;
}

const EXPENSE_ICONS = {
  Home,
  Car,
  Security,
  ShoppingCart,
  Receipt,
};

function ExpenseIcon({ name, size = 18, className }) {
  const key = getExpenseIconKey(name);
  const Icon = EXPENSE_ICONS[key] ?? Receipt;
  return <Icon size={size} className={className} />;
}

export default function FixedExpensesClient({ userId }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [earningsThisMonth, setEarningsThisMonth] = useState(null);
  const [hoursThisMonth, setHoursThisMonth] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [reportProjects, setReportProjects] = useState([]);
  const [includeTeamEarnings, setIncludeTeamEarningsState] = useState(false);
  const [includeProjectExpenses, setIncludeProjectExpensesState] =
    useState(false);
  const [projectExpensesMonthly, setProjectExpensesMonthly] = useState(0);
  const [showReviewBanner, setShowReviewBanner] = useState(false);

  const [forecastHourlyRate, setForecastHourlyRateState] = useState(
    DEFAULT_FORECAST_HOURLY_RATE,
  );
  const [forecastWeeklyHours, setForecastWeeklyHoursState] = useState(
    DEFAULT_FORECAST_WEEKLY_HOURS,
  );
  const [taxReservePct, setTaxReservePctState] = useState(
    DEFAULT_TAX_RESERVE_PCT,
  );

  // Form state
  const [nameType, setNameType] = useState("");
  const [customName, setCustomName] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState("month");
  const [category, setCategory] = useState("business");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPeriod, setEditPeriod] = useState("month");
  const [editCategory, setEditCategory] = useState("business");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [managingId, setManagingId] = useState(null);

  const { businessMonthly, privateMonthly } = useMemo(
    () => sumFixedExpensesByCategory(expenses),
    [expenses],
  );

  const businessCostsTotal = useMemo(() => {
    return (
      businessMonthly +
      (includeProjectExpenses ? projectExpensesMonthly : 0)
    );
  }, [businessMonthly, includeProjectExpenses, projectExpensesMonthly]);

  const monthFinance = useMemo(() => {
    if (earningsThisMonth === null) return null;
    return computeMonthFinance({
      earnings: earningsThisMonth ?? 0,
      businessCostsMonthly: businessCostsTotal,
      privateCostsMonthly: privateMonthly,
      taxReservePct,
    });
  }, [
    earningsThisMonth,
    businessCostsTotal,
    privateMonthly,
    taxReservePct,
  ]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    fetchEarningsThisMonth();
    fetchProjectExpensesThisMonth();
  }, []);

  useEffect(() => {
    setForecastHourlyRateState(getForecastHourlyRate());
    setForecastWeeklyHoursState(getForecastWeeklyHours());
    setIncludeTeamEarningsState(getIncludeTeamEarnings());
    setIncludeProjectExpensesState(getIncludeProjectExpenses());
    setTaxReservePctState(getTaxReservePct());
    try {
      setShowReviewBanner(
        localStorage.getItem(EXPENSE_REVIEW_DISMISSED_KEY) !== "true",
      );
    } catch {
      setShowReviewBanner(true);
    }
  }, []);

  const showTeamEarningsToggle = useMemo(
    () => canIncludeTeamEarnings(reportProjects),
    [reportProjects],
  );

  const showProjectExpensesToggle = projectExpensesMonthly > 0;

  useEffect(() => {
    if (reportProjects.length === 0) return;
    const totals = computeBillableTotals(
      reportProjects,
      userId,
      includeTeamEarnings,
    );
    setEarningsThisMonth(totals.totalBillableAmount);
    setHoursThisMonth(totals.totalBillableHours);
  }, [reportProjects, includeTeamEarnings, userId]);

  async function fetchProjectExpensesThisMonth() {
    try {
      const refDate = formatDateForAPI(new Date());
      const res = await fetch(
        `/my/api/project-expenses?rangeType=month&referenceDate=${refDate}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setProjectExpensesMonthly(data.totalCountable ?? 0);
      } else {
        setProjectExpensesMonthly(0);
      }
    } catch {
      setProjectExpensesMonthly(0);
    }
  }

  async function fetchEarningsThisMonth() {
    try {
      setEarningsLoading(true);
      const refDate = formatDateForAPI(new Date());
      const res = await fetch(
        `/my/reports/api?rangeType=month&referenceDate=${refDate}&billableFilter=billable`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setReportProjects(data.projects ?? []);
      } else {
        setReportProjects([]);
        setEarningsThisMonth(0);
        setHoursThisMonth(0);
      }
    } catch {
      setReportProjects([]);
      setEarningsThisMonth(0);
      setHoursThisMonth(0);
    } finally {
      setEarningsLoading(false);
    }
  }

  async function fetchExpenses() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/my/api/fixed-expenses", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Kon onkosten niet ophalen");
      const data = await res.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getDisplayName() {
    if (nameType === "__custom__") return customName.trim();
    const predefined = PREDEFINED_EXPENSE_TYPES.find(
      (p) => p.value === nameType,
    );
    return predefined?.label ?? "";
  }

  function validateForm() {
    const displayName = getDisplayName();
    if (!displayName) return "Selecteer of vul een onkosten in";
    if (displayName.length > 100) return "Naam mag maximaal 100 tekens zijn";
    const priceNum = parseFloat(price);
    if (price === "" || isNaN(priceNum) || priceNum < 0)
      return "Voer een geldig bedrag in";
    if (!period) return "Selecteer een periode";
    return null;
  }

  async function handleAdd() {
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const displayName = getDisplayName();
      const res = await fetch("/my/api/fixed-expenses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          price: parseFloat(price),
          period,
          category,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet toevoegen");
      }

      const data = await res.json();
      setExpenses((prev) => [...prev, data.expense]);
      setNameType("");
      setCustomName("");
      setPrice("");
      setPeriod("month");
      setCategory("business");
      setShowAddForm(false);
      setSuccessMessage("Onkosten toegevoegd");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(expense) {
    setEditingId(expense.id);
    setEditName(expense.name);
    setEditPrice(String(expense.price ?? ""));
    setEditPeriod(expense.period ?? "month");
    setEditCategory(expense.category ?? "business");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditPeriod("month");
    setEditCategory("business");
    setManagingId(null);
  }

  function dismissReviewBanner() {
    setShowReviewBanner(false);
    try {
      localStorage.setItem(EXPENSE_REVIEW_DISMISSED_KEY, "true");
    } catch {
      // ignore
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    const priceNum = parseFloat(editPrice);
    if (!editName.trim()) {
      setError("Vul een naam in");
      return;
    }
    if (editName.trim().length > 100) {
      setError("Naam mag maximaal 100 tekens zijn");
      return;
    }
    if (editPrice === "" || isNaN(priceNum) || priceNum < 0) {
      setError("Voer een geldig bedrag in");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch(`/my/api/fixed-expenses/${editingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          price: priceNum,
          period: editPeriod,
          category: editCategory,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet bijwerken");
      }

      const data = await res.json();
      setExpenses((prev) =>
        prev.map((e) => (e.id === editingId ? data.expense : e)),
      );
      cancelEdit();
      setSuccessMessage("Onkosten bijgewerkt");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/my/api/fixed-expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet verwijderen");
      }

      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) cancelEdit();
      if (managingId === id) setManagingId(null);
      setSuccessMessage("Onkosten verwijderd");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {showReviewBanner && expenses.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start justify-between gap-3">
          <p>
            Controleer of je bestaande onkosten privé of zakelijk zijn voor een
            juist financieel beeld.
          </p>
          <button
            type="button"
            onClick={dismissReviewBanner}
            className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-950"
          >
            Sluiten
          </button>
        </div>
      )}

      <MonthFinanceSummaryCard
        earnings={earningsThisMonth ?? 0}
        hours={hoursThisMonth}
        businessCostsMonthly={businessCostsTotal}
        fixedBusinessCostsMonthly={businessMonthly}
        projectExpensesMonthly={projectExpensesMonthly}
        privateCostsMonthly={privateMonthly}
        businessCostsYearly={businessCostsTotal * 12}
        taxReserve={monthFinance?.taxReserve ?? 0}
        taxReservePct={taxReservePct}
        netAfterTax={monthFinance?.netAfterTax ?? 0}
        freeToSpend={monthFinance?.freeToSpend ?? 0}
        expensePercentage={monthFinance?.expensePercentage ?? 0}
        earningsLoading={earningsLoading}
        hourlyRateForecast={forecastHourlyRate}
        weeklyHoursForecast={forecastWeeklyHours}
        showForecastSettings
        showTeamEarningsToggle={showTeamEarningsToggle}
        includeTeamEarnings={includeTeamEarnings}
        onIncludeTeamEarningsChange={(include) => {
          setIncludeTeamEarningsState(include);
          setIncludeTeamEarnings(include);
        }}
        showProjectExpensesToggle={showProjectExpensesToggle}
        includeProjectExpenses={includeProjectExpenses}
        onIncludeProjectExpensesChange={(include) => {
          setIncludeProjectExpensesState(include);
          setIncludeProjectExpenses(include);
        }}
        onHourlyRateChange={(rate) => {
          setForecastHourlyRateState(rate);
          setForecastHourlyRate(rate);
        }}
        onWeeklyHoursChange={(hours) => {
          setForecastWeeklyHoursState(hours);
          setForecastWeeklyHours(hours);
        }}
        onTaxReservePctChange={(pct) => {
          setTaxReservePctState(pct);
          setTaxReservePct(pct);
        }}
      />

      <div className="space-y-4">
        {showAddForm ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Nieuwe vaste onkosten toevoegen
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sluiten
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naam *
                </label>
                <select
                  value={nameType}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNameType(value);
                    if (value && value !== "__custom__") {
                      setCategory(getSuggestedCategoryForExpenseType(value));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                >
                  <option value="">Selecteer een type</option>
                  {PREDEFINED_EXPENSE_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              {nameType === "__custom__" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom naam *
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Vul uw onkosten in"
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorie *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prijs (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periode *
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                  >
                    {PERIOD_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isSaving}
                className="w-full px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? "Toevoegen..." : "Toevoegen"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm font-medium text-[#008eff] hover:text-[#0066b3]"
          >
            <Add size={16} />
            Toevoegen
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Jou vaste onkosten
        </h3>
        {expenses.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">
            Geen vaste onkosten. Voeg hierboven een nieuwe toe.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                {editingId === expense.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Naam"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Prijs"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                      />
                      <select
                        value={editPeriod}
                        onChange={(e) => setEditPeriod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                      >
                        {PERIOD_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleUpdate}
                        disabled={isSaving}
                        className="px-3 py-1.5 bg-[#008eff] text-white rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        Opslaan
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ExpenseIcon name={expense.name} className="text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">
                        {expense.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatMoney(expense.price)} ·{" "}
                        {getPeriodLabel(expense.period)} ·{" "}
                        {getCategoryLabel(expense.category ?? "business")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {managingId === expense.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(expense)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-sm text-[#008eff] hover:bg-[#008eff]/10 rounded disabled:opacity-50"
                          >
                            Bewerken
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            Verwijderen
                          </button>
                          <button
                            type="button"
                            onClick={() => setManagingId(null)}
                            className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded"
                          >
                            Sluiten
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setManagingId(expense.id)}
                          className="text-sm font-medium text-[#008eff] hover:text-[#0066b3]"
                        >
                          Beheren
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
