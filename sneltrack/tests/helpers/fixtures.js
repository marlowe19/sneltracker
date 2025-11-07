/**
 * Custom Playwright fixtures for the time tracking app
 */

import { test as base } from "@playwright/test";

/**
 * Custom fixtures that extend the base test
 */
export const test = base.extend({
  // Add custom fixtures here if needed
  // Example:
  // authenticatedPage: async ({ page }, use) => {
  //   // Setup authenticated state
  //   await use(page);
  // },
});

export { expect } from "@playwright/test";
