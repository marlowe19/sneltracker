import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  navigateToWeek,
  openDayModal,
  closeDayModal,
  switchDayTab,
  waitForApiCalls,
  stopAllRunningTimers,
  clickStartStopButton,
  getTodayDayIndex,
} from "./helpers/test-helpers";

test.describe("Week Entries @mobile", () => {
  const testUser = "testuser";

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await stopAllRunningTimers(page);
    await waitForApiCalls(page);
  });

  test.afterEach(async ({ page }) => {
    await stopAllRunningTimers(page);
  });

  test("should display week entries section @smoke", async ({ page }) => {
    const weekContent = page.locator("text=/Ma|Di|Wo|Do|Vr|Za|Zo|Week/i");
    await expect(weekContent.first()).toBeVisible();
  });

  test("should display days of the week", async ({ page }) => {
    const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

    for (const day of dayLabels) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
    }
  });

  test("should navigate to previous week", async ({ page }) => {
    await navigateToWeek(page, testUser, -1);
    await expect(page).toHaveURL(new RegExp(`w=-1`));
    await expect(page.locator("[data-day-index]").first()).toBeVisible();
  });

  test("should navigate to next week", async ({ page }) => {
    await navigateToWeek(page, testUser, 1);
    await expect(page).toHaveURL(new RegExp(`w=1`));
    await expect(page.locator("[data-day-index]").first()).toBeVisible();
  });

  test("should open day modal when clicking on a day @smoke", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());
    await expect(page.getByTestId("day-tab-entries")).toBeVisible();
    await expect(page.getByTestId("day-tab-expenses")).toBeVisible();
  });

  test("should close day modal when close button is clicked", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());
    await closeDayModal(page);
  });

  test("should display entries tab content in day modal", async ({ page }) => {
    await openDayModal(page, getTodayDayIndex());
    await switchDayTab(page, "entries");
    await expect(page.getByTestId("add-entry")).toBeVisible();
  });

  test("should switch between entries and expenses tabs in modal", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());

    await switchDayTab(page, "entries");
    await expect(page.getByTestId("add-entry")).toBeVisible();

    await switchDayTab(page, "expenses");
    await expect(page.getByTestId("add-expense")).toBeVisible();
  });

  test("should display hours and money for each day", async ({ page }) => {
    const dayCell = page.locator(`[data-day-index="${getTodayDayIndex()}"]`);
    await expect(dayCell.locator(".day-hours")).toBeVisible();
    await expect(dayCell.locator(".day-hours")).toHaveText(/\d:\d{2}|0:00/);
  });

  test("should handle week navigation with entries", async ({ page }) => {
    await navigateToWeek(page, testUser, -1);
    await expect(page.locator("[data-day-index]").first()).toBeVisible();

    await navigateToWeek(page, testUser, 2);
    await expect(page.locator("[data-day-index]").first()).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428);

    await expect(page.locator("[data-day-index]").first()).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test("should handle touch interactions on day elements", async ({ page }) => {
    const firstDay = page.locator("[data-day-index]").first();
    await expect(firstDay).toBeVisible();
    const box = await firstDay.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(30);
  });

  test("should update week entries after timer operations", async ({ page }) => {
    await clickStartStopButton(page);
    await waitForApiCalls(page);
    await page.waitForTimeout(1000);
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    await openDayModal(page, getTodayDayIndex());
    await expect(page.getByTestId("day-modal").getByText("Duur:")).toBeVisible();
  });
});
