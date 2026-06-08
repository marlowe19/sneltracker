import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  navigateToProjects,
  navigateToWeek,
  waitForApiCalls,
  waitForProjectsToLoad,
  stopAllRunningTimers,
  clickMainNavLink,
  openDayModal,
  getTodayDayIndex,
  ensureTimerSlot,
} from "./helpers/test-helpers";

test.describe("Navigation and Layout @mobile", () => {
  const testUser = "testuser";

  test.beforeEach(async ({ page }) => {
    await page.goto("/my");
    await stopAllRunningTimers(page);
  });

  test("should load main page with correct layout on mobile @smoke", async ({
    page,
  }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    await expect(page).toHaveTitle(/.*/);

    const logo = page
      .locator('img[alt*="SO"]')
      .or(page.locator('img[src*="icon"]'));
    await expect(logo.first()).toBeVisible();

    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });

  test("should navigate to projects page @smoke", async ({ page }) => {
    await waitForApiCalls(page);

    await clickMainNavLink(page, "Projecten");

    await expect(page).toHaveURL(/\/my\/projecten/);
    await expect(
      page.getByRole("heading", { name: "Projecten", exact: true })
    ).toBeVisible();
  });

  test("should navigate back to projects list from project detail via header", async ({
    page,
  }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    const projectCard = page
      .locator("div.cursor-pointer")
      .filter({ has: page.getByRole("heading", { level: 3 }) })
      .first();
    await expect(projectCard).toBeVisible({ timeout: 10_000 });
    await projectCard.click();
    await waitForApiCalls(page);

    await expect(page).toHaveURL(/\/my\/projecten\/[^/]+$/);

    const headerBackButton = page.getByRole("button", { name: "Terug" });
    await expect(headerBackButton).toBeVisible();
    await headerBackButton.click();
    await waitForApiCalls(page);

    await expect(page).toHaveURL(/\/my\/projecten\/?$/);
  });

  test("should navigate to different weeks", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    await navigateToWeek(page, testUser, -1);
    await expect(page).toHaveURL(new RegExp(`w=-1`));

    await navigateToWeek(page, testUser, 1);
    await expect(page).toHaveURL(new RegExp(`w=1`));

    await navigateToWeek(page, testUser, 0);
    await expect(page).toHaveURL(new RegExp(`w=0|(?!w=)`));
  });

  test("should display week entries section", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    await expect(page.locator("[data-day-index]").first()).toBeVisible();
  });

  test("should have responsive layout on mobile viewport", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test("should handle touch interactions", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    const timerBox = await ensureTimerSlot(page);
    const startButton = timerBox.getByRole("button", { name: /^Start timer$/i });
    await expect(startButton).toBeVisible();

    const box = await startButton.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("should maintain layout when rotating device", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    const initialViewport = page.viewportSize();

    await page.setViewportSize({
      width: initialViewport.height,
      height: initialViewport.width,
    });

    await waitForApiCalls(page);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });

  test("should handle day entry modal opening", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    await openDayModal(page, getTodayDayIndex());
    await expect(page.getByTestId("day-modal")).toBeVisible();
  });

  test("should display header with logo and navigation", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    const logo = page
      .locator('img[alt*="SO"]')
      .or(page.locator('img[src*="icon"]'));
    await expect(logo.first()).toBeVisible();

    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });

  test("should handle page refresh without breaking @smoke", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    await page.reload();
    await waitForApiCalls(page);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });
});
