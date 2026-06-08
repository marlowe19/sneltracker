import { test, expect } from "@playwright/test";
import {
  clickMainNavLink,
  waitForApiCalls,
  stopAllRunningTimers,
} from "./helpers/test-helpers";

test.describe("Reports @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my");
    await stopAllRunningTimers(page);
    await waitForApiCalls(page);
  });

  test("should load reports page and fetch data", async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/my/reports/api") && response.status() === 200
    );

    await clickMainNavLink(page, "Reports");
    await expect(page).toHaveURL(/\/my\/reports/);
    await responsePromise;

    await expect(
      page.getByRole("button", { name: "Huidig Rapport" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Opgeslagen Rapporten" })
    ).toBeVisible();
  });

  test("should save a report and show it in stored tab", async ({ page }) => {
    await clickMainNavLink(page, "Reports");
    await waitForApiCalls(page);

    await page.waitForResponse(
      (response) =>
        response.url().includes("/my/reports/api") && response.status() === 200
    );

    const reportName = `E2E Report ${Date.now()}`;
    await expect(
      page.getByRole("button", { name: "Rapport opslaan" })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Rapport opslaan" }).click();
    await page.locator("#report-name").fill(reportName);

    const savePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/my/reports/stored/api") &&
        response.request().method() === "POST" &&
        response.status() === 200
    );

    await page.getByRole("button", { name: "Opslaan", exact: true }).click();
    await savePromise;
    await waitForApiCalls(page);

    await expect(
      page.getByRole("button", { name: "Opgeslagen Rapporten" })
    ).toBeVisible();
    await expect(page.getByText(reportName)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Bekijken" }).first().click();
    await waitForApiCalls(page);
    await expect(page).toHaveURL(/\/my\/reports\/stored\//);
    await expect(
      page.getByRole("heading", { name: "Opgeslagen Rapport" })
    ).toBeVisible();
  });
});
