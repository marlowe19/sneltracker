export const PREDEFINED_EXPENSE_TYPES = [
  { value: "huur", label: "Huur" },
  { value: "wegenbelasting", label: "Wegenbelasting" },
  { value: "verzekering", label: "Verzekering" },
  { value: "vervoer", label: "Vervoer" },
  { value: "materialen", label: "Materialen" },
  { value: "overige", label: "Overige" },
  { value: "__custom__", label: "Anders..." },
];

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
