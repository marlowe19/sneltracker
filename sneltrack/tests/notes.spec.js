import { test, expect } from "@playwright/test";
import {
  clickMainNavLink,
  waitForApiCalls,
  stopAllRunningTimers,
} from "./helpers/test-helpers";

test.describe("Notes @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my");
    await stopAllRunningTimers(page);
    await waitForApiCalls(page);
  });

  test("should create a note and open it", async ({ page }) => {
    await clickMainNavLink(page, "Notites");
    await expect(page).toHaveURL(/\/my\/notes/);

    const noteName = `E2E Note ${Date.now()}`;
    await page.getByPlaceholder("Nieuwe notitie...").fill(noteName);
    await page.getByRole("button", { name: "Toevoegen" }).click();
    await waitForApiCalls(page);

    const noteLink = page.getByRole("link", { name: noteName });
    await expect(noteLink).toBeVisible({ timeout: 10_000 });
    await noteLink.click();
    await waitForApiCalls(page);

    await expect(page).toHaveURL(/\/my\/notes\/[^/]+$/);
    await expect(page.getByText(noteName)).toBeVisible();
  });

  test("should navigate back to notes list", async ({ page }) => {
    await clickMainNavLink(page, "Notites");

    const noteName = `E2E Note ${Date.now()}`;
    await page.getByPlaceholder("Nieuwe notitie...").fill(noteName);
    await page.getByRole("button", { name: "Toevoegen" }).click();
    await waitForApiCalls(page);

    await page.getByRole("link", { name: noteName }).click();
    await waitForApiCalls(page);

    await page.getByRole("link", { name: /Terug/ }).click();
    await waitForApiCalls(page);
    await expect(page).toHaveURL(/\/my\/notes\/?$/);
    await expect(page.getByRole("link", { name: noteName })).toBeVisible();
  });
});
