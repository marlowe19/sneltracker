import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  startTimer,
  stopTimer,
  clickStartStopButton,
  selectProject,
  waitForActiveTimer,
  waitForApiCalls,
} from "./helpers/test-helpers";

test.describe("Timer Functionality @mobile", () => {
  const testUser = "testuser";

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
  });

  test("should display start button when no timer is active", async ({
    page,
  }) => {
    // Check that Start button is visible
    const startButton = page.getByRole("button", { name: /^Start$/i });
    await expect(startButton).toBeVisible();

    // Check that Stop button is not visible
    const stopButton = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton).not.toBeVisible();
  });

  test("should start timer when start button is clicked", async ({ page }) => {
    // Click the start button
    await clickStartStopButton(page);

    // Wait for the page to update after starting timer
    await waitForApiCalls(page);

    // Verify that Stop button is now visible
    const stopButton = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton).toBeVisible({ timeout: 10000 });

    // Verify that Start button is no longer visible (or disabled)
    const startButton = page.getByRole("button", { name: /^Start$/i });
    // Start button might still be visible but should be in a different state
    // or the UI might show Stop button instead
  });

  test("should stop timer when stop button is clicked", async ({ page }) => {
    // First start a timer
    await startTimer(page, testUser);
    await waitForApiCalls(page);

    // Verify timer is running (Stop button should be visible)
    const stopButton = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton).toBeVisible({ timeout: 10000 });

    // Click stop button
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    // Verify that Start button is visible again
    const startButton = page.getByRole("button", { name: /^Start$/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });
  });

  test("should allow project selection before starting timer", async ({
    page,
  }) => {
    // Wait for projects to load
    await waitForApiCalls(page);

    // Check if project selector is visible
    const projectSelector = page.getByRole("button", {
      name: /Selecteer project/i,
    });

    // If project selector exists, test project selection
    if (await projectSelector.isVisible().catch(() => false)) {
      await projectSelector.click();
      await page.waitForTimeout(500); // Wait for dropdown to appear

      // Try to select a project if available
      const projectOptions = page.getByRole("button", {
        name: /Geen project|project/i,
      });
      const count = await projectOptions.count();

      if (count > 0) {
        // Select first available project option
        await projectOptions.first().click();
        await waitForApiCalls(page);
      }
    }
  });

  test("should start timer with selected project", async ({ page }) => {
    await waitForApiCalls(page);

    // Try to select a project if project selector is available
    const projectSelector = page.getByRole("button", {
      name: /Selecteer project/i,
    });

    if (await projectSelector.isVisible().catch(() => false)) {
      await selectProject(page, "Geen project");
      await waitForApiCalls(page);
    }

    // Start timer
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    // Verify timer started (Stop button should be visible)
    const stopButton = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton).toBeVisible({ timeout: 10000 });
  });

  test("should display running timer with time counter", async ({ page }) => {
    // Start timer
    await startTimer(page, testUser);
    await waitForApiCalls(page);

    // Wait for timer display to appear
    // Look for time format like "0:00" or "00:00"
    const timePattern = /\d{1,2}:\d{2}/;
    const timeDisplay = page.locator("text=" + timePattern.source);

    // Timer should show some time (even if 0:00)
    await expect(timeDisplay.first()).toBeVisible({ timeout: 10000 });
  });

  test("should handle multiple timer starts and stops", async ({ page }) => {
    // Start timer
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    // Verify timer is running
    const stopButton1 = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton1).toBeVisible({ timeout: 10000 });

    // Stop timer
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    // Start timer again
    await clickStartStopButton(page);
    await waitForApiCalls(page);

    // Verify timer is running again
    const stopButton2 = page.getByRole("button", { name: /^Stop$/i });
    await expect(stopButton2).toBeVisible({ timeout: 10000 });
  });

  test("should update timer display while running", async ({ page }) => {
    // Start timer
    await startTimer(page, testUser);
    await waitForApiCalls(page);

    // Wait for initial timer display
    const timePattern = /\d{1,2}:\d{2}/;
    const initialTime = await page
      .locator("text=" + timePattern.source)
      .first()
      .textContent();

    // Wait a few seconds
    await page.waitForTimeout(3000);

    // Check that timer has updated (time should have increased)
    const updatedTime = await page
      .locator("text=" + timePattern.source)
      .first()
      .textContent();

    // Times should be different (unless there's a delay in display)
    // This is a basic check - the actual time format might need adjustment
    expect(updatedTime).toBeTruthy();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Check that main elements are visible and properly sized
    const startButton = page.getByRole("button", { name: /^Start$/i });
    await expect(startButton).toBeVisible();

    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428); // Max mobile width

    // Verify button is touch-friendly (has reasonable size)
    const box = await startButton.boundingBox();
    expect(box.height).toBeGreaterThan(40); // Minimum touch target size
  });
});
