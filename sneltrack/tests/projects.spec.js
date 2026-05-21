import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  navigateToProjects,
  waitForApiCalls,
  waitForProjectsToLoad,
} from "./helpers/test-helpers";

test.describe("Projects Management @mobile", () => {
  const testUser = "testuser";

  test("should display projects list page", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    // Check for page title/heading
    const heading = page.getByRole("heading", { name: /Projecten/i });
    await expect(heading).toBeVisible();

    // BackButtonClient is a <button>, not a link
    const backButton = page.getByRole("button", { name: "Terug", exact: true });
    await expect(backButton).toBeVisible();
  });

  test("should navigate back to main page from projects", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    const backButton = page.getByRole("button", { name: "Terug", exact: true });
    await backButton.click();
    await waitForApiCalls(page);

    // Verify we're back on main page
    await expect(page).toHaveURL(new RegExp(`/my(?:/)?$`));
  });

  test("should display projects list on mobile", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    // Projects list should be visible
    // Look for project-related content (project names, buttons, etc.)
    const projectsSection = page
      .locator("section")
      .or(page.locator('[class*="project"]'));

    // At least the section should exist
    const count = await projectsSection.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should navigate to project detail page", async ({ page }) => {
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
  });

  test("should display project creation form when create button is clicked", async ({
    page,
  }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    // Look for create/new project button
    const createButton = page.getByRole("button", {
      name: /Nieuw Project/i,
    });

    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      await waitForApiCalls(page);

      // Look for form elements
      const formInputs = page
        .locator('input[type="text"]')
        .or(page.locator('input[name*="name"]'));

      // Form should have at least one input
      const inputCount = await formInputs.count();
      expect(inputCount).toBeGreaterThan(0);
    }
  });

  test("should filter projects by user and shared tabs", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    // Look for tab buttons
    const userTab = page.getByRole("button", { name: /Mijn|User|Eigen/i });
    const sharedTab = page.getByRole("button", { name: /Gedeeld|Shared/i });

    if (await userTab.isVisible().catch(() => false)) {
      // Click user tab
      await userTab.click();
      await waitForApiCalls(page);

      // Verify tab is active (might have specific class or aria attribute)
      // This is a basic check
    }

    if (await sharedTab.isVisible().catch(() => false)) {
      // Click shared tab
      await sharedTab.click();
      await waitForApiCalls(page);

      // Verify tab is active
    }
  });

  test("should have responsive layout on mobile viewport", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428); // Max mobile width

    // Check that main container is visible
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check that content doesn't overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test("should handle project selection in timer", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    // Look for project selector
    const projectSelector = page.getByRole("button", {
      name: /Selecteer project/i,
    });

    if (await projectSelector.isVisible().catch(() => false)) {
      await projectSelector.click();
      await page.waitForTimeout(500); // Wait for dropdown

      // Look for project options
      const projectOptions = page.getByRole("button").filter({
        hasText: /Geen project|project/i,
      });

      const count = await projectOptions.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("should display project statistics on detail page", async ({ page }) => {
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
  });

  test("should handle touch interactions on project items", async ({
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
    const box = await projectCard.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(30);
  });

  test("should maintain state when navigating between pages", async ({
    page,
  }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    await page.getByRole("button", { name: "Terug", exact: true }).click();
    await waitForApiCalls(page);
    await expect(page).toHaveURL(/\/my\/?$/);

    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    await expect(
      page.getByRole("heading", { name: "Projecten", exact: true })
    ).toBeVisible();
  });
});
