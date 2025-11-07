This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Time tracking setup (Firestore)

1. Create a Firebase project and a service account with Firestore access.
2. Download the service account JSON and base64-encode it:
   ```bash
   base64 -i serviceAccount.json | tr -d '\n'
   ```
3. Add to `.env.local`:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_JSON="<BASE64_OF_SERVICE_ACCOUNT_JSON>"
   ```
   On Vercel, add the same env var in Project Settings → Environment Variables.
4. First run will create documents in the `time_entries` collection. No SQL database is required.
5. Use URLs like `/kevin/start` to start and `/kevin/stop` to stop. After starting or stopping you'll be redirected to `/<user>` where the timer and weekly overview are shown.
6. If Firestore prompts for composite indexes, accept the suggestions. For active-entry queries, create an index on: `user_name ASC`, `end_time ASC`, `start_time DESC`.

## Testing

This project uses [Playwright](https://playwright.dev) for end-to-end UI testing with a focus on mobile device emulation (iOS and Android).

### Setup

1. Install Playwright and browsers:
   ```bash
   npm install
   npx playwright install
   ```

2. Ensure the development server is running (tests will start it automatically if not running):
   ```bash
   npm run dev
   ```

### Running Tests

- **Run all tests:**
  ```bash
  npm test
  ```

- **Run tests with UI mode (interactive):**
  ```bash
  npm run test:ui
  ```

- **Run only mobile device tests:**
  ```bash
  npm run test:mobile
  ```

- **Run tests in debug mode:**
  ```bash
  npm run test:debug
  ```

### Device Emulation

Tests run on multiple mobile device emulations:

**iOS Devices:**
- iPhone 13
- iPhone 13 Pro
- iPhone 14 Pro
- iPad Pro

**Android Devices:**
- Pixel 5
- Galaxy S21
- Galaxy Tab S4

Tests are tagged with `@mobile` to allow filtering mobile-specific tests.

### Test Structure

Tests are organized in the `tests/` directory:

- `tests/timer.spec.js` - Timer start/stop functionality
- `tests/navigation.spec.js` - Navigation and layout tests
- `tests/projects.spec.js` - Project management tests
- `tests/week-entries.spec.js` - Week entries and day modal tests
- `tests/helpers/test-helpers.js` - Common test utilities
- `tests/helpers/fixtures.js` - Custom Playwright fixtures

### Test Helpers

The test helpers provide utilities for:
- Navigating to user pages
- Starting/stopping timers
- Selecting projects
- Waiting for API calls to complete
- Interacting with week navigation
- Opening/closing day modals

### Configuration

Playwright configuration is in `playwright.config.js`. The configuration:
- Sets base URL to `http://localhost:3000`
- Configures device emulation for iOS and Android
- Sets up automatic screenshot/video capture on failure
- Configures the dev server to start automatically

### Writing New Tests

When writing new tests:
1. Use the `@mobile` tag for mobile-specific tests
2. Import helpers from `tests/helpers/test-helpers.js`
3. Use `navigateToUserPage()` to set up test context
4. Wait for API calls using `waitForApiCalls()` after actions
5. Test touch interactions and mobile viewport sizes

Example:
```javascript
import { test, expect } from '@playwright/test';
import { navigateToUserPage, clickStartStopButton } from './helpers/test-helpers';

test('my test @mobile', async ({ page }) => {
  await navigateToUserPage(page, 'testuser');
  await clickStartStopButton(page);
  // ... assertions
});
```

