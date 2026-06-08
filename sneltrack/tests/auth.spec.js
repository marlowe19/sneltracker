import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  waitForApiCalls,
  stopAllRunningTimers,
} from "./helpers/test-helpers";

test.describe("Auth @mobile @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my");
    await stopAllRunningTimers(page);
  });

  test("should load /my when authenticated", async ({ page }) => {
    await navigateToUserPage(page);
    await expect(page).toHaveURL(/\/my/);
    await expect(
      page.getByRole("button", { name: "Timer toevoegen" })
    ).toBeVisible();
  });

  test("should show profile page with logout", async ({ page }) => {
    await page.goto("/my/profile");
    await waitForApiCalls(page);

    await expect(page.getByRole("heading", { name: "Profiel" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Uitloggen" })).toBeVisible();
    await expect(page.getByText("Instellingen")).toBeVisible();
  });

  test("should redirect unauthenticated users to login", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/my");
    await page.waitForURL(/\/auth\/login/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/auth\/login/);

    await context.close();
  });
});
