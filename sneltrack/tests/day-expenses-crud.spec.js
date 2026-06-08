import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  openDayModal,
  closeDayModal,
  createExpenseInModal,
  deleteFirstExpenseInModal,
  ensureHasProject,
  getTodayDayIndex,
  stopAllRunningTimers,
  waitForApiCalls,
  switchDayTab,
} from "./helpers/test-helpers";

test.describe("Day Expense CRUD @mobile @smoke", () => {
  let project;
  const expenseName = () => `E2E Expense ${Date.now()}`;

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

  test("should create a day expense", async ({ page }) => {
    const name = expenseName();
    await openDayModal(page, getTodayDayIndex());
    await switchDayTab(page, "expenses");

    await createExpenseInModal(page, {
      name,
      price: "12.50",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText(name)).toBeVisible();
    await expect(modal.getByText("12,50").or(modal.getByText("12.50"))).toBeVisible();
  });

  test("should show expense total in day summary", async ({ page }) => {
    const name = expenseName();
    await openDayModal(page, getTodayDayIndex());
    await createExpenseInModal(page, {
      name,
      price: "25",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText("€25.00").or(modal.getByText("€25,00"))).toBeVisible();
  });

  test("should delete a day expense", async ({ page }) => {
    const name = expenseName();
    await openDayModal(page, getTodayDayIndex());
    await createExpenseInModal(page, {
      name,
      price: "10",
      projectName: project.name,
      projectId: project.id,
    });

    const modal = page.getByTestId("day-modal");
    await expect(modal.getByText(name)).toBeVisible();
    await deleteFirstExpenseInModal(page);
    await expect(modal.getByText(name)).not.toBeVisible();
  });

  test("should reflect expenses on week row after closing modal", async ({
    page,
  }) => {
    const name = expenseName();
    const dayIndex = getTodayDayIndex();

    await openDayModal(page, dayIndex);
    await createExpenseInModal(page, {
      name,
      price: "15",
      projectName: project.name,
      projectId: project.id,
    });
    await closeDayModal(page);
    await waitForApiCalls(page);

    const dayCell = page.locator(`[data-day-index="${dayIndex}"]`);
    const expenseEl = dayCell.locator(".day-expenses");
    await expect(expenseEl).toBeVisible();
    const expenseText = await expenseEl.textContent();
    expect(expenseText?.trim()).not.toBe("");
    expect(expenseText).not.toBe("\u200B");

    await openDayModal(page, dayIndex);
    await switchDayTab(page, "expenses");
    await deleteFirstExpenseInModal(page);
  });
});
