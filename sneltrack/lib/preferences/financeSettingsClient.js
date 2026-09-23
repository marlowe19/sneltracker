import { resolveFinanceSettings } from "@/lib/preferences/resolveFinanceSettings";

export async function fetchResolvedFinanceSettings() {
  const res = await fetch("/my/api/finance-settings", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Kon financiële instellingen niet ophalen");
  }
  const data = await res.json();
  return resolveFinanceSettings(data.settings);
}

export async function patchFinanceSettings(updates) {
  const res = await fetch("/my/api/finance-settings", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Kon instellingen niet opslaan");
  }
  const data = await res.json();
  return data.settings;
}
