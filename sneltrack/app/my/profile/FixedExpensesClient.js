"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CurrencyEuro,
  Receipt,
  Add,
  Home,
  Car,
  Security,
  ShoppingCart,
  Time,
} from "@carbon/icons-react";
import {
  PREDEFINED_EXPENSE_TYPES,
  PERIOD_OPTIONS,
  getExpenseIconKey,
} from "@/lib/expenseTypes";
import { formatDateForAPI } from "@/lib/dateRangeUtils";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function formatHours(hours) {
  return (
    new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(hours ?? 0) + " uur"
  );
}

function toMonthlyPrice(price, period) {
  if (!price || isNaN(price)) return 0;
  if (period === "month") return price;
  if (period === "quarter") return price / 3;
  if (period === "year") return price / 12;
  return 0;
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

  // Form state
  const [nameType, setNameType] = useState("");
  const [customName, setCustomName] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState("month");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPeriod, setEditPeriod] = useState("month");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [managingId, setManagingId] = useState(null);

  const totalPerMonth = useMemo(() => {
    return expenses.reduce(
      (sum, e) => sum + toMonthlyPrice(e.price, e.period),
      0,
    );
  }, [expenses]);

  const totalPerYear = useMemo(() => totalPerMonth * 12, [totalPerMonth]);

  const remaining = useMemo(() => {
    if (earningsThisMonth === null) return null;
    return (earningsThisMonth ?? 0) - totalPerMonth;
  }, [earningsThisMonth, totalPerMonth]);

  const isProfit = remaining !== null && remaining >= 0;

  const expensePercentage = useMemo(() => {
    const earnings = earningsThisMonth ?? 0;
    if (earnings <= 0) return 0;
    return Math.min(100, Math.round((totalPerMonth / earnings) * 100));
  }, [earningsThisMonth, totalPerMonth]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    fetchEarningsThisMonth();
  }, []);

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
        setEarningsThisMonth(data.totals?.totalBillableAmount ?? 0);
        setHoursThisMonth(data.totals?.totalBillableHours ?? 0);
      } else {
        setEarningsThisMonth(0);
        setHoursThisMonth(0);
      }
    } catch {
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
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditPeriod("month");
    setManagingId(null);
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

      {/* Financiële widget – light theme */}
      <div className="rounded-lg border border-gray-200 bg-[#f5f5f5] overflow-hidden ">
        {/* Top: Verdiensten + netto-badge */}
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 min-w-0 shrink">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CurrencyEuro size={20} className="text-[#008eff]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-500 whitespace-nowrap">
                Verdiensten deze maand
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {earningsLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatMoney(earningsThisMonth ?? 0)
                )}
              </div>
              {hoursThisMonth !== null && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  <Time size={14} className="text-gray-500" />
                  {formatHours(hoursThisMonth)}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {remaining !== null && (
              <span
                className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors duration-300 ${
                  isProfit
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isProfit
                  ? `+ ${formatMoney(remaining)}`
                  : `- ${formatMoney(Math.abs(remaining))}`}
              </span>
            )}
          </div>
        </div>

        {/* Midden: VASTE KOSTEN */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Receipt size={20} className="text-gray-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Vaste kosten
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatMoney(totalPerMonth)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#008eff] transition-all duration-300"
              style={{ width: `${expensePercentage}%` }}
            />
          </div>
        </div>

        {/* Onder de bar: X% van inkomen | Totaal per jaar */}
        <div className="flex items-center justify-between px-4 pb-4 text-xs text-gray-500">
          <span>{expensePercentage}% van je inkomen</span>
          <span>Totaal per jaar: {formatMoney(totalPerYear)}</span>
        </div>
      </div>

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
                  onChange={(e) => setNameType(e.target.value)}
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
                        {getPeriodLabel(expense.period)}
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
