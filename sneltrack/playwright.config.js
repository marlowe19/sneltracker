import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const authFile = "playwright/.auth/user.json";

const allMobileProjects = [
  { name: "iPhone 13", device: devices["iPhone 13"] },
  { name: "iPhone 13 Pro", device: devices["iPhone 13 Pro"] },
  { name: "iPhone 14 Pro", device: devices["iPhone 14 Pro"] },
  { name: "iPad Pro", device: devices["iPad Pro"] },
  { name: "Galaxy S21", device: devices["Galaxy S21"] },
];

// One device locally avoids N× duplicate runs on the same Auth0 user (shared timers DB).
const mobileProjects =
  process.env.E2E_ALL_DEVICES === "1" ? allMobileProjects : [allMobileProjects[0]];

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: !!process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.js/,
    },
    ...mobileProjects.map(({ name, device }) => ({
      name,
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.js/,
      use: {
        ...device,
        storageState: authFile,
      },
    })),
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
