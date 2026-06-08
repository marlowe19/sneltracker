/**
 * Test helper utilities for Playwright tests
 */

import { expect } from "@playwright/test";

/**
 * Navigate to a user's page
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
export async function navigateToUserPage(page, username) {
  await page.goto(`/my`);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for API calls to complete by waiting for network idle
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForApiCalls(page, timeout = 5000) {
  await page.waitForLoadState("networkidle", { timeout });
}

/**
 * Monday-based day index (0 = Monday, 6 = Sunday)
 */
export function getTodayDayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

/**
 * Start a timer for a user
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} projectId - Optional project ID
 */
export async function startTimer(page, username, projectId = null) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/start") && response.status() === 200
  );

  const body = projectId ? { project: projectId } : {};
  await page.request.post("/my/start", {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  await responsePromise;
  await page.waitForLoadState("networkidle");
}

/**
 * Stop a timer for a user
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
export async function stopTimer(page, username) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/stop") && response.status() === 200
  );

  await page.request.post("/my/stop", {
    data: {},
    headers: { "Content-Type": "application/json" },
  });
  await responsePromise;
  await page.waitForLoadState("networkidle");
}

/**
 * Stop all running timers for the authenticated user (no entryId = stop all).
 * @param {import('@playwright/test').Page} page
 */
export async function stopAllRunningTimers(page) {
  try {
    await page.request.post("/my/stop", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Click a bottom navigation link (Timers, Projecten, etc.)
 * @param {import('@playwright/test').Page} page
 * @param {string} label - Exact nav label, e.g. "Projecten"
 */
export async function clickMainNavLink(page, label) {
  const link = page
    .getByRole("navigation")
    .getByRole("link", { name: label, exact: true });
  await link.click();
  await waitForApiCalls(page);
}

/**
 * Ensure at least one timer row exists (project picker lives inside it).
 * @param {import('@playwright/test').Page} page
 */
export async function ensureTimerSlot(page) {
  const timerBox = page.locator(".timer-box").first();
  if (await timerBox.isVisible().catch(() => false)) {
    return timerBox;
  }

  await page.getByRole("button", { name: "Timer toevoegen" }).click();
  await expect(timerBox).toBeVisible({ timeout: 10_000 });
  return timerBox;
}

/**
 * Open the project dropdown on the first timer row.
 * @param {import('@playwright/test').Page} page
 */
export async function openTimerProjectDropdown(page) {
  const timerBox = await ensureTimerSlot(page);
  await timerBox.getByRole("button").first().click();
  await expect(
    page.getByRole("button", { name: "Kies een project" })
  ).toBeVisible();
}

/**
 * Click the start/stop button in the UI
 * @param {import('@playwright/test').Page} page
 */
export async function clickStartStopButton(page) {
  const timerBox = await ensureTimerSlot(page);
  const stopButton = timerBox.getByRole("button", { name: /^Stop timer$/i });
  const startButton = timerBox.getByRole("button", { name: /^Start timer$/i });

  if (await stopButton.isVisible().catch(() => false)) {
    await stopButton.click();
  } else {
    await startButton.click();
  }
  await waitForApiCalls(page);
}

/**
 * Select a project from the timer project dropdown
 * @param {import('@playwright/test').Page} page
 * @param {string} projectName
 */
export async function selectProject(page, projectName) {
  await openTimerProjectDropdown(page);

  if (projectName === "Geen project") {
    await page.getByRole("button", { name: "Kies een project" }).click();
  } else {
    await page.getByRole("button", { name: projectName, exact: true }).click();
  }
  await waitForApiCalls(page);
}

/**
 * Navigate to projects page
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
export async function navigateToProjects(page, username) {
  await page.goto(`/my/projecten`);
  await waitForApiCalls(page);
}

/**
 * Navigate to a specific week using week offset
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {number} weekOffset - Week offset (0 = current week, -1 = previous week, 1 = next week)
 */
export async function navigateToWeek(page, username, weekOffset) {
  await page.goto(`/my?w=${weekOffset}`);
  await waitForApiCalls(page);
}

/**
 * Open the day modal for a given day index (0 = Monday)
 * @param {import('@playwright/test').Page} page
 * @param {number} [dayIndex]
 */
export async function openDayModal(page, dayIndex = getTodayDayIndex()) {
  await page.locator(`[data-day-index="${dayIndex}"]`).click();
  await waitForApiCalls(page);
  await expect(page.getByTestId("day-modal")).toBeVisible({ timeout: 10_000 });
}

/**
 * Close the day modal via the Terug button
 * @param {import('@playwright/test').Page} page
 */
export async function closeDayModal(page) {
  await page.getByTestId("day-modal").getByRole("button", { name: "Terug" }).click();
  await waitForApiCalls(page);
  await expect(page.getByTestId("day-modal")).not.toBeVisible({ timeout: 10_000 });
}

/**
 * Switch between entries/expenses tabs in the day modal
 * @param {import('@playwright/test').Page} page
 * @param {"entries"|"expenses"} tab
 */
export async function switchDayTab(page, tab) {
  const testId = tab === "expenses" ? "day-tab-expenses" : "day-tab-entries";
  await page.getByTestId(testId).click();
  await waitForApiCalls(page);
}

/**
 * Click on a day in the week entries to open the day modal
 * @param {import('@playwright/test').Page} page
 * @param {number} dayIndex - Day index (0-6, where 0 is Monday)
 */
export async function clickDayEntry(page, dayIndex) {
  await openDayModal(page, dayIndex);
}

/**
 * Accept the next browser confirm dialog
 * @param {import('@playwright/test').Page} page
 */
export async function acceptNextConfirm(page) {
  page.once("dialog", (dialog) => dialog.accept());
}

/**
 * Fetch active projects via API
 * @param {import('@playwright/test').Page} page
 */
export async function fetchActiveProjects(page) {
  const res = await page.request.get("/my/projecten/api");
  if (!res.ok()) {
    throw new Error(`Failed to fetch projects (${res.status()})`);
  }
  const data = await res.json();
  return (data.projects || []).filter(
    (p) => p.status !== "archived" && p.archived !== true
  );
}

/**
 * Ensure the E2E user has at least one project; create one if needed
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ name: string, id?: string }>}
 */
export async function ensureHasProject(page) {
  const projects = await fetchActiveProjects(page);
  if (projects.length > 0) {
    return { name: projects[0].name, id: projects[0].id };
  }

  const projectName = `E2E Seed ${Date.now()}`;
  const res = await page.request.post("/my/projecten/api", {
    data: { name: projectName },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`Failed to seed project (${res.status()})`);
  }
  const data = await res.json();
  return { name: projectName, id: data.project?.id };
}

/**
 * Create a manual time entry in the open day modal
 * @param {import('@playwright/test').Page} page
 * @param {{ duration: string, projectName: string, projectId?: string }} options
 */
export async function createManualEntry(page, { duration, projectName, projectId }) {
  await switchDayTab(page, "entries");
  const card = await addNewEntryCard(page);
  const form = getEntryForm(card);
  await form.duration.fill(duration);

  const modal = page.getByTestId("day-modal");
  const projectSelect = form.project;
  if (projectId) {
    await projectSelect.selectOption(projectId);
  } else {
    await projectSelect.selectOption({ label: projectName });
  }

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/my/entries") &&
      response.request().method() === "POST" &&
      response.status() === 200
  );

  await modal.getByTestId("save-entry").click();
  await responsePromise;
  await waitForApiCalls(page);
}

/**
 * Expand the first entry in the day modal and click Verwijderen
 * @param {import('@playwright/test').Page} page
 */
export async function deleteFirstEntryInModal(page) {
  const modal = page.getByTestId("day-modal");
  await modal.getByRole("button", { name: "Bewerken" }).first().click();
  acceptNextConfirm(page);
  await modal.getByRole("button", { name: "Verwijderen" }).first().click();
  await waitForApiCalls(page);
}

/**
 * Format a date as YYYY-MM-DD in local timezone
 * @param {Date} [date]
 */
export function formatDayDateLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse U:MM duration string to milliseconds
 * @param {string} duration
 */
export function parseDurationString(duration) {
  const [hours, minutes] = duration.split(":").map((part) => parseInt(part, 10) || 0);
  return (hours * 60 + minutes) * 60 * 1000;
}

/**
 * Format milliseconds as U:MM
 * @param {number} ms
 */
export function durationMsToString(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Build an ISO timestamp for a local time on the given day
 * @param {number} hours
 * @param {number} minutes
 * @param {Date} [day]
 */
export function localDayDateTimeIso(hours, minutes, day = new Date()) {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Assert duration_ms matches the difference between start_time and end_time
 * @param {object} entry
 */
export function expectEntryTimesConsistent(entry) {
  const start = new Date(entry.start_time).getTime();
  const end = new Date(entry.end_time).getTime();
  expect(entry.duration_ms).toBe(end - start);
}

/**
 * Create a time entry via API (simulates a stopped timer with explicit times)
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 */
export async function createEntryViaApi(
  page,
  { startTime, endTime, durationMs = null, projectId = null, hourlyRate = null }
) {
  const dayAnchor = new Date();
  dayAnchor.setHours(12, 0, 0, 0);

  const res = await page.request.post("/my/entries", {
    data: {
      dayDate: dayAnchor.toISOString(),
      start_time: startTime,
      end_time: endTime,
      duration_ms: durationMs,
      project_id: projectId,
      hourly_rate: hourlyRate,
    },
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Failed to create entry via API (${res.status()}): ${body}`);
  }

  const data = await res.json();
  return data.entry;
}

/**
 * Delete a time entry via API (test cleanup)
 * @param {import('@playwright/test').Page} page
 * @param {string} entryId
 */
export async function deleteEntryViaApi(page, entryId) {
  if (!entryId) return;
  try {
    await page.request.delete(`/my/entries/${entryId}`);
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Fetch day entries for a given date
 * @param {import('@playwright/test').Page} page
 * @param {string} dayDateStr - YYYY-MM-DD
 */
export async function fetchDayEntries(page, dayDateStr) {
  const res = await page.request.get(`/my/api/day-entries?dayDate=${dayDateStr}`);
  if (!res.ok()) {
    throw new Error(`Failed to fetch day entries (${res.status()})`);
  }
  const data = await res.json();
  return data.entries || [];
}

/**
 * Create a dedicated E2E project via API (isolated from shared team entries)
 * @param {import('@playwright/test').Page} page
 */
export async function createE2eProject(page) {
  const projectName = `E2E Duration ${Date.now()}`;
  const res = await page.request.post("/my/projecten/api", {
    data: { name: projectName },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create E2E project (${res.status()})`);
  }
  const data = await res.json();
  return { name: projectName, id: data.project?.id };
}

/**
 * Find an entry card in the day modal by project name and optional collapsed labels
 * @param {import('@playwright/test').Page} page
 * @param {{ projectName: string, start?: string, end?: string, duration?: string }} matchers
 */
export function findEntryCard(page, { projectName, start, end, duration }) {
  const modal = page.getByTestId("day-modal");
  let card = modal
    .locator(".rounded-lg.border")
    .filter({ hasText: projectName });

  if (start) card = card.filter({ hasText: start });
  if (end) card = card.filter({ hasText: end });
  if (duration) card = card.filter({ hasText: duration });

  return card.first();
}

/**
 * Expand a specific entry card in the day modal
 * @param {import('@playwright/test').Page} page
 * @param {{ projectName: string, start?: string, end?: string, duration?: string }} matchers
 */
export async function expandEntryCard(page, matchers) {
  const card = findEntryCard(page, matchers);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole("button", { name: "Bewerken" }).click();
  await expect(getEntryForm(card).duration).toBeVisible({ timeout: 10_000 });
  return card;
}

/**
 * Labels in DayEntriesListClient are siblings of inputs (no htmlFor), so getByLabel
 * is unreliable — scope fields via their label container instead.
 * @param {import('playwright').Locator} card
 * @param {string} labelText
 */
function getFieldByLabel(card, labelText) {
  return card
    .locator("div")
    .filter({ has: card.locator("label", { hasText: labelText }) })
    .locator("input, select")
    .first();
}

/**
 * Locators for the entry form scoped to a card (expanded or new temp entry)
 * @param {import('playwright').Locator} card
 */
export function getEntryForm(card) {
  return {
    duration: getFieldByLabel(card, "Duur (U:MM)"),
    startTime: getFieldByLabel(card, "Starttijd"),
    endTime: getFieldByLabel(card, "Eindtijd"),
    hourlyRate: getFieldByLabel(card, "Uurtarief (€)"),
    project: getFieldByLabel(card, "Projectnaam"),
  };
}

/**
 * Add a new temp entry and return its card (auto-expanded)
 * @param {import('@playwright/test').Page} page
 */
export async function addNewEntryCard(page) {
  const modal = page.getByTestId("day-modal");
  const addButton = modal.getByTestId("add-entry");
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();

  // Footer switches from "add-entry" to "save-entry" when a temp entry is expanded
  await expect(modal.getByTestId("save-entry")).toBeVisible({ timeout: 10_000 });

  const card = modal
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("button", { name: "Sluiten" }) })
    .first();

  await expect(getEntryForm(card).duration).toBeVisible({ timeout: 10_000 });
  return card;
}

/**
 * Save the expanded entry and wait for PATCH
 * @param {import('@playwright/test').Page} page
 */
export async function saveExpandedEntry(page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/my/entries/") &&
      response.request().method() === "PATCH" &&
      response.status() === 200
  );

  const modal = page.getByTestId("day-modal");
  await modal.getByTestId("save-entry").click();
  const response = await responsePromise;
  await waitForApiCalls(page);

  const data = await response.json();
  return {
    entry: data.entry,
    patchBody: response.request().postDataJSON(),
  };
}

/**
 * Read collapsed duration text for a specific entry card
 * @param {import('playwright').Locator} card
 */
export async function getCollapsedDurationText(card) {
  const duurLabel = card.locator("span").filter({ hasText: /^Duur:$/ }).first();
  const row = duurLabel.locator("xpath=ancestor::div[contains(@class, 'flex')][1]");
  return (await row.locator("span.font-medium").textContent())?.trim() ?? "";
}

/**
 * Create an expense in the open day modal
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, price: string, projectName: string, projectId?: string }} options
 */
export async function createExpenseInModal(page, { name, price, projectName, projectId }) {
  await switchDayTab(page, "expenses");
  await page.getByTestId("add-expense").click();

  const modal = page.getByTestId("day-modal");
  const projectSelect = modal.getByLabel("Projectnaam *");
  if (projectId) {
    await projectSelect.selectOption(projectId);
  } else {
    await projectSelect.selectOption({ label: projectName });
  }

  await modal.getByPlaceholder("Bijv. Materialen, Lunch, etc.").fill(name);
  await modal.getByLabel("Prijs (€) *").fill(price);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/my/expenses") &&
      response.request().method() === "POST" &&
      response.status() === 200
  );

  await page.getByTestId("save-expense").click();
  await responsePromise;
  await waitForApiCalls(page);
}

/**
 * Delete the first saved expense in the day modal
 * @param {import('@playwright/test').Page} page
 */
export async function deleteFirstExpenseInModal(page) {
  const modal = page.getByTestId("day-modal");
  await modal.getByRole("button", { name: "Bewerken" }).first().click();
  acceptNextConfirm(page);
  await modal.getByRole("button", { name: "Verwijderen" }).first().click();
  await waitForApiCalls(page);
}

/**
 * Get hours text from a week day cell
 * @param {import('@playwright/test').Page} page
 * @param {number} dayIndex
 */
export async function getDayHoursText(page, dayIndex) {
  const dayCell = page.locator(`[data-day-index="${dayIndex}"]`);
  return dayCell.locator(".day-hours").textContent();
}

/**
 * Wait for timer to be visible and running
 * @param {import('@playwright/test').Page} page
 */
export async function waitForActiveTimer(page) {
  await page
    .waitForSelector('[data-testid="timer"]', { timeout: 5000 })
    .catch(() => {
      return page.waitForSelector("text=/\\d{1,2}:\\d{2}/", { timeout: 5000 });
    });
}

/**
 * Get the current timer display text
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getTimerDisplay(page) {
  const timerElement = page
    .locator('[data-testid="timer"]')
    .or(page.locator("text=/\\d{1,2}:\\d{2}/").first());
  return await timerElement.textContent();
}

/**
 * Wait for projects to load
 * @param {import('@playwright/test').Page} page
 */
export async function waitForProjectsToLoad(page) {
  await page
    .waitForResponse(
      (response) =>
        response.url().includes("/my/projecten/api") && response.ok(),
      { timeout: 10_000 }
    )
    .catch(async () => {
      await page.waitForLoadState("networkidle");
    });
}

/**
 * Check if a button is disabled
 * @param {import('@playwright/test').Page} page
 * @param {string} buttonText
 * @returns {Promise<boolean>}
 */
export async function isButtonDisabled(page, buttonText) {
  const button = page.getByRole("button", { name: buttonText });
  return await button.isDisabled();
}

/**
 * Create a project from the projects list modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} projectName
 * @returns {Promise<{ name: string, id?: string }>}
 */
export async function createProjectFromList(page, projectName) {
  await page.getByRole("button", { name: /Nieuw Project/i }).click();
  await page.locator("#name").fill(projectName);

  const createPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/my/projecten/api") &&
      response.request().method() === "POST" &&
      response.status() === 201
  );

  await page.getByRole("button", { name: "Aanmaken" }).click();
  const response = await createPromise;
  await waitForApiCalls(page);

  const data = await response.json();
  return { name: projectName, id: data.project?.id };
}

/**
 * Open a project detail page by name from the list.
 * @param {import('@playwright/test').Page} page
 * @param {string} projectName
 */
export async function openProjectDetail(page, projectName) {
  const projectCard = page
    .locator("div.cursor-pointer")
    .filter({ has: page.getByRole("heading", { name: projectName, level: 3 }) });
  await expect(projectCard).toBeVisible({ timeout: 10_000 });
  await projectCard.click();
  await waitForApiCalls(page);
  await expect(page).toHaveURL(/\/my\/projecten\/[^/]+$/);
}

/**
 * Open the Instellingen tab on project detail.
 * @param {import('@playwright/test').Page} page
 */
export async function openProjectSettingsTab(page) {
  await page.getByRole("button", { name: /^Instellingen/i }).click();
  await waitForApiCalls(page);
  await expect(page.locator("#projectName")).toBeVisible();
}

/**
 * Fill project settings form on the detail Instellingen tab.
 * @param {import('@playwright/test').Page} page
 * @param {object} settings
 */
export async function fillProjectSettings(page, settings) {
  if (settings.name !== undefined) {
    await page.locator("#projectName").fill(settings.name);
  }
  if (settings.budgetAmount !== undefined) {
    await page.locator("#budgetAmount").fill(String(settings.budgetAmount));
  }
  if (settings.hourlyRate !== undefined) {
    await page.locator("#hourlyRate").fill(String(settings.hourlyRate));
  }
  if (settings.budgetHours !== undefined) {
    await page.locator("#budgetHours").fill(String(settings.budgetHours));
  }
  if (settings.capacity !== undefined) {
    await page.locator("#capacity").fill(String(settings.capacity));
  }
  if (settings.priority !== undefined) {
    await page.locator("#priority").selectOption(String(settings.priority));
  }
  if (settings.zipCode !== undefined) {
    await page.locator("#zipCode").fill(settings.zipCode);
  }
  if (settings.deadline !== undefined) {
    await page.locator("#deadline").fill(settings.deadline);
  }
  if (settings.startDate !== undefined) {
    await page.locator("#startDate").fill(settings.startDate);
  }
}

/**
 * Save project settings and wait for PATCH to succeed.
 * @param {import('@playwright/test').Page} page
 */
export async function saveProjectSettings(page) {
  const savePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/my/projecten/api") &&
      response.request().method() === "PATCH" &&
      response.status() === 200
  );

  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await savePromise;
  await waitForApiCalls(page);
  await expect(
    page.getByText("Instellingen succesvol opgeslagen")
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Delete a project via API (test cleanup).
 * @param {import('@playwright/test').Page} page
 * @param {string} projectId
 */
export async function deleteProjectById(page, projectId) {
  if (!projectId) return;
  try {
    await page.request.delete(`/my/projecten/api?id=${projectId}`);
  } catch {
    // Best-effort cleanup
  }
}
