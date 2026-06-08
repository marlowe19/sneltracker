import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  openDayModal,
  closeDayModal,
  createManualEntry,
  deleteFirstEntryInModal,
  ensureHasProject,
  getEntryForm,
  getTodayDayIndex,
  stopAllRunningTimers,
  waitForApiCalls,
  switchDayTab,
} from "./helpers/test-helpers";

test.describe("Day Entry CRUD @mobile @smoke", () => {
  let project;

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page);
    await stopAllRunningTimers(page);
    project = await ensureHasProject(page);
    await page.reload();
    await waitForApiCalls(page);
  });

  test.afterEach(async ({ page }) => {
    await stopAllRunningTimers(page);
  });

  test("should create a manual time entry", async ({ page }) => {
    await openDayModal(page, getTodayDayIndex());
    await expect(page.getByTestId("day-tab-entries")).toBeVisible();

    await createManualEntry(page, {
      duration: "1:00",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText(project.name)).toBeVisible();
    await expect(modal.getByText("1:00")).toBeVisible();
  });

  test("should edit an existing time entry", async ({ page }) => {
    await openDayModal(page, getTodayDayIndex());
    await createManualEntry(page, {
      duration: "1:00",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    const card = modal.locator(".rounded-lg.border").filter({ hasText: project.name }).first();
    await card.getByRole("button", { name: "Bewerken" }).click();
    await getEntryForm(card).duration.fill("2:00");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/my/entries/") &&
        response.request().method() === "PATCH" &&
        response.status() === 200
    );

    await page.getByTestId("save-entry").click();
    await responsePromise;
    await waitForApiCalls(page);

    await expect(modal.getByText("2:00")).toBeVisible();
  });

  test("should delete a time entry", async ({ page }) => {
    await openDayModal(page, getTodayDayIndex());
    await createManualEntry(page, {
      duration: "0:30",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText("0:30")).toBeVisible();

    await deleteFirstEntryInModal(page);

    await expect(modal.getByText("0:30")).not.toBeVisible();
  });

  test("should persist entry after closing and reopening modal", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());
    await createManualEntry(page, {
      duration: "1:15",
      projectName: project.name,
      projectId: project.id,
    });
    await closeDayModal(page);

    await openDayModal(page, getTodayDayIndex());
    await switchDayTab(page, "entries");
    await expect(page.getByTestId("day-modal").getByText("1:15")).toBeVisible();

    await deleteFirstEntryInModal(page);
  });
});
