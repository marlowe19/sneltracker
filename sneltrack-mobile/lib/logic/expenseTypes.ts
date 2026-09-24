// lib/logic/expenseTypes.ts
// Ported 1:1 from sneltrack/lib/expenseTypes.js

export interface ExpenseTypeOption {
  value: string;
  label: string;
  suggestedCategory?: "private" | "business";
}

export const PREDEFINED_EXPENSE_TYPES: ExpenseTypeOption[] = [
  { value: "huur", label: "Huur", suggestedCategory: "private" },
  { value: "wegenbelasting", label: "Wegenbelasting", suggestedCategory: "private" },
  { value: "verzekering", label: "Verzekering", suggestedCategory: "private" },
  { value: "vervoer", label: "Vervoer", suggestedCategory: "business" },
  { value: "materialen", label: "Materialen", suggestedCategory: "business" },
  { value: "overige", label: "Overige", suggestedCategory: "business" },
  { value: "__custom__", label: "Anders..." },
];

export interface ExpenseCategoryOption {
  value: "business" | "private";
  label: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryOption[] = [
  { value: "business", label: "Zakelijk" },
  { value: "private", label: "Privé" },
];

export function getSuggestedCategoryForExpenseType(typeValue: string): "private" | "business" {
  const predefined = PREDEFINED_EXPENSE_TYPES.find((p) => p.value === typeValue);
  return predefined?.suggestedCategory ?? "business";
}

export function getCategoryLabel(category: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Icon key per expense type (Huur=Home, Vervoer/Wegenbelasting=Car, etc.) */
export const EXPENSE_ICON_MAP: Record<string, string> = {
  huur: "Home",
  wegenbelasting: "Car",
  verzekering: "Security",
  vervoer: "Car",
  materialen: "ShoppingCart",
  overige: "Receipt",
};

export function getExpenseIconKey(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "Receipt";
  const n = name.toLowerCase().trim();
  const predefined = PREDEFINED_EXPENSE_TYPES.find(
    (p) => p.value !== "__custom__" && p.label.toLowerCase() === n
  );
  if (predefined && EXPENSE_ICON_MAP[predefined.value]) return EXPENSE_ICON_MAP[predefined.value];
  if (n.includes("huur") || n.includes("huis") || n.includes("woning")) return "Home";
  if (
    n.includes("wegenbelasting") ||
    n.includes("vervoer") ||
    n.includes("auto") ||
    n.includes("benzine") ||
    n.includes("parkeren")
  )
    return "Car";
  if (n.includes("verzekering")) return "Security";
  if (n.includes("materiaal")) return "ShoppingCart";
  return "Receipt";
}

export interface PeriodOption {
  value: "month" | "quarter" | "year";
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "month", label: "Per maand" },
  { value: "quarter", label: "Per kwartaal" },
  { value: "year", label: "Per jaar" },
];
