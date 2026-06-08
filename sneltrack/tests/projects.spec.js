import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  navigateToProjects,
  waitForApiCalls,
  waitForProjectsToLoad,
  openTimerProjectDropdown,
  createProjectFromList,
  openProjectDetail,
  openProjectSettingsTab,
  fillProjectSettings,
  saveProjectSettings,
  deleteProjectById,
} from "./helpers/test-helpers";

test.describe("Projects Management @mobile", () => {
  const testUser = "testuser";

  test("should display projects list page @smoke", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    const heading = page.getByRole("heading", { name: /Projecten/i });
    await expect(heading).toBeVisible();

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

    await expect(page).toHaveURL(new RegExp(`/my(?:/)?$`));
  });

  test("should display projects list on mobile", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    await expect(
      page.getByRole("heading", { name: "Projecten", exact: true })
    ).toBeVisible();
  });

  test("should navigate to project detail page @smoke", async ({ page }) => {
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

  test("should display project creation form when create button is clicked @smoke", async ({
    page,
  }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    const createButton = page.getByRole("button", {
      name: /Nieuw Project/i,
    });
    await expect(createButton).toBeVisible();
    await createButton.click();
    await waitForApiCalls(page);

    await expect(page.getByLabel("Projectnaam *")).toBeVisible();
  });

  test("should create a new project and save full settings", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    const projectName = `E2E Project ${Date.now()}`;
    const settings = {
      name: projectName,
      budgetAmount: "1500.50",
      hourlyRate: "95.00",
      budgetHours: "120",
      capacity: "32.5",
      priority: "4",
      zipCode: "1234AB",
      deadline: "2026-12-31",
      startDate: "2026-01-15",
    };

    let projectId;
    try {
      const created = await createProjectFromList(page, projectName);
      projectId = created.id;

      await expect(
        page.getByRole("heading", { name: projectName, level: 3 })
      ).toBeVisible({ timeout: 10_000 });

      await openProjectDetail(page, projectName);
      await openProjectSettingsTab(page);
      await fillProjectSettings(page, settings);
      await saveProjectSettings(page);

      await page.reload();
      await waitForApiCalls(page);
      await openProjectSettingsTab(page);

      await expect(page.locator("#projectName")).toHaveValue(projectName);
      await expect(page.locator("#budgetAmount")).toHaveValue("1500.5");
      await expect(page.locator("#hourlyRate")).toHaveValue("95");
      await expect(page.locator("#budgetHours")).toHaveValue("120");
      await expect(page.locator("#capacity")).toHaveValue("32.5");
      await expect(page.locator("#priority")).toHaveValue("4");
      await expect(page.locator("#zipCode")).toHaveValue("1234AB");
      await expect(page.locator("#deadline")).toHaveValue("2026-12-31");
      await expect(page.locator("#startDate")).toHaveValue("2026-01-15");
    } finally {
      await deleteProjectById(page, projectId);
    }
  });

  test("should filter projects by user and shared tabs", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    const userTab = page.getByRole("button", { name: /Mijn|User|Eigen/i });
    const sharedTab = page.getByRole("button", { name: /Gedeeld|Shared/i });

    await expect(userTab).toBeVisible();
    await userTab.click();
    await waitForApiCalls(page);

    await expect(sharedTab).toBeVisible();
    await sharedTab.click();
    await waitForApiCalls(page);
  });

  test("should have responsive layout on mobile viewport", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);

    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test("should handle project selection in timer", async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    await openTimerProjectDropdown(page);
    await expect(
      page.getByRole("button", { name: "Kies een project" })
    ).toBeVisible();
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

  test("should render project detail tabs", async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);

    const projectCard = page
      .locator("div.cursor-pointer")
      .filter({ has: page.getByRole("heading", { level: 3 }) })
      .first();
    await projectCard.click();
    await waitForApiCalls(page);

    const tabs = [
      "Tijdregistraties",
      "Uitgaven",
      "Activiteiten",
      "Instellingen",
    ];

    for (const tabName of tabs) {
      const tab = page.getByRole("button", { name: new RegExp(`^${tabName}`) });
      await expect(tab).toBeVisible();
      await tab.click();
      await waitForApiCalls(page);
    }
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
