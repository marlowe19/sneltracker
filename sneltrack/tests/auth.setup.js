import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const authFile = path.join(process.cwd(), "playwright/.auth/user.json");

setup("authenticate via Auth0", async ({ page }) => {
  const email = process.env.E2E_AUTH0_EMAIL;
  const password = process.env.E2E_AUTH0_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_AUTH0_EMAIL and E2E_AUTH0_PASSWORD must be set in .env.local (or the environment)."
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/auth/login");

  // Wait for Auth0 Universal Login or an immediate redirect back into the app
  await page.waitForURL(
    (url) =>
      url.hostname.includes("auth0.com") ||
      url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/my"),
    { timeout: 60_000 }
  );

  if (!page.url().includes("/my")) {
    await loginOnAuth0Page(page, email, password);
    await page.waitForURL(/\/my/, { timeout: 60_000 });
  }

  await expect(page).toHaveURL(/\/my/);

  // Clear any running timers so parallel / repeated test runs do not stack entries.
  await page.request.post(new URL("/my/stop", page.url()).toString(), {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  await page.context().storageState({ path: authFile });
});

/**
 * Auth0 Universal Login: email → Continue → password → Continue.
 * Use exact "Continue" so we do not click "Continue with a passkey".
 */
async function loginOnAuth0Page(page, email, password) {
  const emailInput = page
    .getByRole("textbox", { name: /email address/i })
    .or(
      page.locator(
        'input[type="email"], input[name="email"], input[name="username"], #username'
      )
    )
    .first();
  await emailInput.waitFor({ state: "visible", timeout: 30_000 });
  await emailInput.fill(email);

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const passwordInput = page
    .locator('input[type="password"], input[name="password"], #password')
    .first();
  await passwordInput.waitFor({ state: "visible", timeout: 30_000 });
  await passwordInput.fill(password);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
