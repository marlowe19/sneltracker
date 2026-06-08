# Playwright E2E tests

## Setup

1. Copy credentials into `.env.local`:
   - `E2E_AUTH0_EMAIL`
   - `E2E_AUTH0_PASSWORD`
2. Run auth setup once (or let the test runner do it):
   ```bash
   npm run test:auth-setup
   ```
3. Run tests:
   ```bash
   npm test              # full suite
   npm run test:smoke    # @smoke only (CI gate)
   npm run test:mobile   # @mobile tagged tests
   ```

## Test data contract

- Tests use a **single shared Auth0 user** (see `playwright.config.js` worker count).
- The user should have **at least one active project**, or tests will create one named `E2E Seed …` via API.
- Tests that mutate data prefix resources with `E2E` and clean up in `afterEach` where possible.
- Always call `stopAllRunningTimers()` in setup/teardown for timer-related specs.

## Tags

| Tag | Purpose |
|-----|---------|
| `@smoke` | Fast critical-path tests for PR / pre-deploy |
| `@mobile` | Full mobile viewport coverage |

## CI

GitHub Actions runs `npm run test:smoke` on push/PR when Auth0 secrets are configured.
