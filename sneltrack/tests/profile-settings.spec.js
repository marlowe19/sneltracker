import { test, expect } from "@playwright/test";
import {
  waitForApiCalls,
  stopAllRunningTimers,
} from "./helpers/test-helpers";

test.describe("Profile Settings @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my/profile");
    await stopAllRunningTimers(page);
    await waitForApiCalls(page);
  });

  test("should open Activiteiten settings modal", async ({ page }) => {
    await page.getByRole("button", { name: "Activiteiten" }).click();
    await expect(page.getByRole("heading", { name: "Activiteiten" })).toBeVisible();
    await page.getByRole("button", { name: "Terug" }).click();
    await expect(page.getByRole("heading", { name: "Profiel" })).toBeVisible();
  });

  test("should open Onkosten settings modal", async ({ page }) => {
    await page.getByRole("button", { name: "Onkosten" }).click();
    await expect(page.getByRole("heading", { name: "Onkosten" })).toBeVisible();
    await expect(page.getByText("Prognose instellingen")).toBeVisible();
    await expect(page.getByText("Uurtarief (€/uur)")).toBeVisible();
    await expect(page.getByText("Uren per week")).toBeVisible();
    await expect(
      page.getByText("Belastingreserve (% van winst)"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Toevoegen" }).click();
    await expect(page.getByText("Categorie *")).toBeVisible();
    await page.getByRole("button", { name: "Terug" }).click();
    await expect(page.getByRole("heading", { name: "Profiel" })).toBeVisible();
  });
});
