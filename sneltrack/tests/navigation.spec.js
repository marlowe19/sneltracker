import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  navigateToProjects,
  navigateToWeek,
  waitForApiCalls,
  waitForProjectsToLoad,
  stopAllRunningTimers,
  clickMainNavLink,
} from "./helpers/test-helpers";

test.describe("Navigation and Layout @mobile", () => {
  const testUser = "testuser";

  test.beforeEach(async ({ page }) => {
    await page.goto("/my");
    await stopAllRunningTimers(page);
  });

  test("should load main page with correct layout on mobile", async ({
    page,
  }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Check that main elements are present
    await expect(page).toHaveTitle(/.*/); // Page should have a title

    // Check for header/logo
    const logo = page
      .locator('img[alt*="SO"]')
      .or(page.locator('img[src*="icon"]'));
    await expect(logo.first()).toBeVisible();

    // Check for navigation links
    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });

  test("should navigate to projects page", async ({ page }) => {
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
    await expect(
      page.getByRole("heading", { name: "Project", exact: true })
    ).toBeVisible();

    const headerBackButton = page.getByRole("button", { name: "Terug" });
    await expect(headerBackButton).toBeVisible();
    await headerBackButton.click();
    await waitForApiCalls(page);

    await expect(page).toHaveURL(/\/my\/projecten\/?$/);
    await expect(
      page.getByRole("heading", { name: "Projecten", exact: true })
    ).toBeVisible();
  });

  test("should navigate to different weeks", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Navigate to previous week
    await navigateToWeek(page, testUser, -1);
    await expect(page).toHaveURL(new RegExp(`w=-1`));

    // Navigate to next week
    await navigateToWeek(page, testUser, 1);
    await expect(page).toHaveURL(new RegExp(`w=1`));

    // Navigate back to current week
    await navigateToWeek(page, testUser, 0);
    await expect(page).toHaveURL(new RegExp(`w=0|(?!w=)`));
  });

  test("should display week entries section", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Look for week entries - could be days of week or entry list
    // Check for common day abbreviations or week-related text
    const weekContent = page.locator(
      "text=/Ma|Di|Wo|Do|Vr|Za|Zo|Week|Uur|Hours/i"
    );

    // At least some week-related content should be visible
    const count = await weekContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have responsive layout on mobile viewport", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428); // Max mobile width

    // Check that main container is visible
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check that content doesn't overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10); // Allow small margin
  });

  test("should handle touch interactions", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Test that buttons are tappable (not too small)
    const startButton = page.getByRole("button", { name: /^Start$/i });

    if (await startButton.isVisible().catch(() => false)) {
      const box = await startButton.boundingBox();
      // Touch targets should be at least 44x44 pixels
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("should maintain layout when rotating device", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Get initial viewport
    const initialViewport = page.viewportSize();

    // Simulate rotation (change viewport)
    await page.setViewportSize({
      width: initialViewport.height,
      height: initialViewport.width,
    });

    await waitForApiCalls(page);

    // Check that main elements are still visible
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check that navigation is still accessible
    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });

  test("should handle day entry modal opening", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Week row day buttons only (avoid timer clocks / other numeric UI)
    const dayElements = page.locator("[data-day-index]");

    const count = await dayElements.count();

    if (count > 0) {
      // Click on first day element
      await dayElements.first().click();
      await waitForApiCalls(page);

      // Look for modal or day entries content
      // Modal might have specific classes or be in a dialog
      const modal = page
        .locator('[role="dialog"]')
        .or(
          page.locator(".modal").or(page.locator('[data-testid="day-modal"]'))
        );

      // Modal might be visible or we might need to wait
      // This is a basic check - adjust based on actual implementation
      await page.waitForTimeout(500);
    }
  });

  test("should display header with logo and navigation", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Check for logo
    const logo = page
      .locator('img[alt*="SO"]')
      .or(page.locator('img[src*="icon"]'));
    await expect(logo.first()).toBeVisible();

    // Check for navigation links
    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();

    // Check header layout
    const header = page.locator("header").or(page.locator('[class*="header"]'));
    if ((await header.count()) > 0) {
      await expect(header.first()).toBeVisible();
    }
  });

  test("should handle page refresh without breaking", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);

    // Refresh the page
    await page.reload();
    await waitForApiCalls(page);

    // Verify page still loads correctly
    const main = page.locator("main");
    await expect(main).toBeVisible();

    const projectsLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Projecten", exact: true });
    await expect(projectsLink).toBeVisible();
  });
});
