export const PREDEFINED_EXPENSE_TYPES = [
  { value: "huur", label: "Huur", suggestedCategory: "private" },
  { value: "wegenbelasting", label: "Wegenbelasting", suggestedCategory: "private" },
  { value: "verzekering", label: "Verzekering", suggestedCategory: "private" },
  { value: "vervoer", label: "Vervoer", suggestedCategory: "business" },
  { value: "materialen", label: "Materialen", suggestedCategory: "business" },
  { value: "overige", label: "Overige", suggestedCategory: "business" },
  { value: "__custom__", label: "Anders..." },
];

export const EXPENSE_CATEGORIES = [
  { value: "business", label: "Zakelijk" },
  { value: "private", label: "Privé" },
];

export function getSuggestedCategoryForExpenseType(typeValue) {
  const predefined = PREDEFINED_EXPENSE_TYPES.find((p) => p.value === typeValue);
  return predefined?.suggestedCategory ?? "business";
}

export function getCategoryLabel(category) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category
  );
}

/** Icon key per expense type (Huur=Home, Vervoer/Wegenbelasting=Car, etc.) */
export const EXPENSE_ICON_MAP = {
  huur: "Home",
  wegenbelasting: "Car",
  verzekering: "Security",
  vervoer: "Car",
  materialen: "ShoppingCart",
  overige: "Receipt",
};

export function getExpenseIconKey(name) {
  if (!name || typeof name !== "string") return "Receipt";
  const n = name.toLowerCase().trim();
  const predefined = PREDEFINED_EXPENSE_TYPES.find(
    (p) => p.value !== "__custom__" && p.label.toLowerCase() === n,
  );
  if (predefined && EXPENSE_ICON_MAP[predefined.value])
    return EXPENSE_ICON_MAP[predefined.value];
  if (n.includes("huur") || n.includes("huis") || n.includes("woning"))
    return "Home";
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

export const PERIOD_OPTIONS = [
  { value: "month", label: "Per maand" },
  { value: "quarter", label: "Per kwartaal" },
  { value: "year", label: "Per jaar" },
];
