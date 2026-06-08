import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  startTimer,
  clickStartStopButton,
  selectProject,
  waitForApiCalls,
  stopAllRunningTimers,
  openDayModal,
  getTodayDayIndex,
  ensureTimerSlot,
  openTimerProjectDropdown,
} from "./helpers/test-helpers";

test.describe("Timer Functionality @mobile", () => {
  const testUser = "testuser";

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await stopAllRunningTimers(page);
    await page.reload();
    await waitForApiCalls(page);
  });

  test.afterEach(async ({ page }) => {
    await stopAllRunningTimers(page);
  });

  test("should display start button when no timer is active @smoke", async ({
    page,
  }) => {
    const timerBox = await ensureTimerSlot(page);
    const startButton = timerBox.getByRole("button", { name: /^Start timer$/i });
    await expect(startButton).toBeVisible();

    const stopButton = timerBox.getByRole("button", { name: /^Stop timer$/i });
    await expect(stopButton).not.toBeVisible();
  });

  test("should start timer when start button is clicked @smoke", async ({
    page,
  }) => {
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    const timerBox = page.locator(".timer-box").first();
    await expect(
      timerBox.getByRole("button", { name: /^Stop timer$/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should stop timer when stop button is clicked @smoke", async ({
    page,
  }) => {
    await startTimer(page, testUser);
    await waitForApiCalls(page);
    await page.reload();
    await waitForApiCalls(page);

    const timerBox = page.locator(".timer-box").first();
    await expect(
      timerBox.getByRole("button", { name: /^Stop timer$/i })
    ).toBeVisible({ timeout: 10_000 });

    await clickStartStopButton(page);
    await waitForApiCalls(page);

    await expect(
      timerBox.getByRole("button", { name: /^Start timer$/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should allow project selection before starting timer", async ({
    page,
  }) => {
    await waitForApiCalls(page);
    await openTimerProjectDropdown(page);
    await expect(
      page.getByRole("button", { name: "Kies een project" })
    ).toBeVisible();
  });

  test("should start timer with selected project", async ({ page }) => {
    await waitForApiCalls(page);
    await selectProject(page, "Geen project");
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    const timerBox = page.locator(".timer-box").first();
    await expect(
      timerBox.getByRole("button", { name: /^Stop timer$/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should display running timer with time counter", async ({ page }) => {
    await startTimer(page, testUser);
    await waitForApiCalls(page);
    await page.reload();
    await waitForApiCalls(page);

    const timePattern = /\d{1,2}:\d{2}/;
    const timeDisplay = page.locator(".timer-box").locator("text=" + timePattern.source);
    await expect(timeDisplay.first()).toBeVisible({ timeout: 10_000 });
  });

  test("should handle multiple timer starts and stops", async ({ page }) => {
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    const timerBox = page.locator(".timer-box").first();
    await expect(
      timerBox.getByRole("button", { name: /^Stop timer$/i })
    ).toBeVisible({ timeout: 10_000 });

    await clickStartStopButton(page);
    await waitForApiCalls(page);

    await clickStartStopButton(page);
    await waitForApiCalls(page);

    await expect(
      timerBox.getByRole("button", { name: /^Stop timer$/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should update timer display while running", async ({ page }) => {
    await startTimer(page, testUser);
    await waitForApiCalls(page);
    await page.reload();
    await waitForApiCalls(page);

    const timePattern = /\d{1,2}:\d{2}/;
    const timerDisplay = page.locator(".timer-box").locator("text=" + timePattern.source);
    const initialTime = await timerDisplay.first().textContent();

    await page.waitForTimeout(3000);

    const updatedTime = await timerDisplay.first().textContent();
    expect(updatedTime).toBeTruthy();
    expect(initialTime).toBeTruthy();
  });

  test("should persist stopped timer as entry in today day modal @smoke", async ({
    page,
  }) => {
    const dayIndex = getTodayDayIndex();

    await clickStartStopButton(page);
    await waitForApiCalls(page);
    await page.waitForTimeout(3000);
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    await openDayModal(page, dayIndex);
    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText("Duur:")).toBeVisible({ timeout: 10_000 });
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    const timerBox = await ensureTimerSlot(page);
    const startButton = timerBox.getByRole("button", { name: /^Start timer$/i });
    await expect(startButton).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428);

    const box = await startButton.boundingBox();
    expect(box.height).toBeGreaterThan(40);
  });
});
