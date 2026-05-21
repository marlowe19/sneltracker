/**
 * Test helper utilities for Playwright tests
 */

/**
 * Navigate to a user's page
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
export async function navigateToUserPage(page, username) {
  await page.goto(`/my`);
  // Wait for the page to be fully loaded
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
 * Start a timer for a user
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} projectId - Optional project ID
 */
export async function startTimer(page, username, projectId = null) {
  const url = new URL(`/my/start`, page.url());
  if (projectId) {
    url.searchParams.set("project", projectId);
  }

  // Wait for the start request to complete
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/start") && response.status() === 200
  );

  await page.request.post(url.toString());
  await responsePromise;

  // Wait for page refresh/navigation
  await page.waitForLoadState("networkidle");
}

/**
 * Stop a timer for a user
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
export async function stopTimer(page, username) {
  const url = new URL(`/my/stop`, page.url());

  // Wait for the stop request to complete
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/stop") && response.status() === 200
  );

  await page.request.post(url.toString());
  await responsePromise;

  // Wait for page refresh/navigation
  await page.waitForLoadState("networkidle");
}

/**
 * Stop all running timers for the authenticated user (no entryId = stop all).
 * Use in test setup to avoid leftover timers from parallel runs on the same account.
 * @param {import('@playwright/test').Page} page
 */
export async function stopAllRunningTimers(page) {
  const url = new URL(`/my/stop`, page.url()).toString();
  try {
    await page.request.post(url, {
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
 * Click the start/stop button in the UI
 * @param {import('@playwright/test').Page} page
 */
export async function clickStartStopButton(page) {
  const startButton = page.getByRole("button", { name: /^Start timer$/i });
  const stopButton = page.getByRole("button", { name: /^Stop timer$/i });
  if (await stopButton.isVisible().catch(() => false)) {
    await stopButton.click();
  } else {
    await startButton.click();
  }
  await waitForApiCalls(page);
}

/**
 * Select a project from the project dropdown
 * @param {import('@playwright/test').Page} page
 * @param {string} projectName
 */
export async function selectProject(page, projectName) {
  // Click to open project selector
  const selectorButton = page.getByRole("button", {
    name: /Selecteer project|Geen project/,
  });
  await selectorButton.click();

  // Wait for dropdown to appear and select project
  await page.getByRole("button", { name: projectName }).click();
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
 * Click on a day in the week entries to open the day modal
 * @param {import('@playwright/test').Page} page
 * @param {number} dayIndex - Day index (0-6, where 0 is Monday)
 */
export async function clickDayEntry(page, dayIndex) {
  // Find the day clickable element (assuming it's clickable)
  const dayElements = page
    .locator("[data-day-index]")
    .or(page.locator("button, a").filter({ hasText: /Ma|Di|Wo|Do|Vr|Za|Zo/ }));
  await dayElements.nth(dayIndex).click();
  await waitForApiCalls(page);
}

/**
 * Wait for timer to be visible and running
 * @param {import('@playwright/test').Page} page
 */
export async function waitForActiveTimer(page) {
  // Wait for timer display to appear (could be running clock or timer section)
  await page
    .waitForSelector('[data-testid="timer"]', { timeout: 5000 })
    .catch(() => {
      // Fallback: wait for any timer-related element
      return page.waitForSelector("text=/\\d{1,2}:\\d{2}/", { timeout: 5000 });
    });
}

/**
 * Get the current timer display text
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getTimerDisplay(page) {
  // Try to find timer display - this may need adjustment based on actual implementation
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
  // Wait for project-related elements to appear
  await page.waitForSelector("text=/Projecten|Selecteer project/", {
    timeout: 5000,
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
