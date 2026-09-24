# SnelTracker — Phase 1 Analysis Report

Scope: analysis only. No implementation code. All conclusions below are derived from files actually present in the repo (paths cited), not assumptions.

## 1. Repo structure

The repo root is **not** the app itself — it's a wrapper containing:

```
/ (repo root)
├── IMPLEMENTATION-SUMMARY.md   # notes from a past Firestore→Supabase migration
├── scripts/                    # top-level scripts (not inspected in depth)
├── .github/, .cursor/, .vscode/
└── sneltrack/                  # the actual Next.js application
    ├── app/                    # Next.js App Router — pages, API routes, client components
    ├── lib/                    # business logic, auth, DB clients, integrations
    ├── stores/useStore.js      # single Zustand store (client state)
    ├── supabase-migrations/    # 57 SQL migration files (schema history)
    ├── tests/                  # Playwright e2e specs + plain-Node unit tests
    ├── public/                 # PWA manifest, icons, static assets
    ├── package.json, next.config.mjs, jsconfig.json, postcss.config.mjs
```

- **Core logic**: `sneltrack/lib/` (auth, data access, business calculations).
- **Screens**: `sneltrack/app/**/page.js` (Next.js App Router file-based routing) plus a large number of co-located `"use client"` components (e.g. `app/my/*Client.js`) that hold most of the actual UI/interaction logic — pages themselves are often thin server components that fetch data and delegate to a client component.
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss"` in `app/globals.css`) with a small set of custom utility classes and CSS variables; no CSS-in-JS, no CSS Modules.

## 2. Tech stack — verified conclusions

| Layer | Verified from | Conclusion |
|---|---|---|
| Framework/bundler | `sneltrack/package.json` scripts (`next dev`/`next build`/`next start`), `next.config.mjs` | **Next.js 16 (App Router)**, not Vite. `reactCompiler: true` enabled. React 19.2. |
| Routing | `app/**/page.js` file structure | Next.js file-based routing (server + client components mixed), not React Router. |
| State management | `stores/useStore.js` | **Zustand** (single global store) is the primary client-side state layer for the authenticated `/my` area; server components hydrate initial data, Zustand actions then call `/my/api/*` REST routes for CRUD with optimistic updates (temp IDs). |
| Styling | `app/globals.css`, `postcss.config.mjs`, `tailwindcss` devDependency | **Tailwind CSS v4**, utility-class driven. A few hand-written CSS classes exist (`.btn`, `.timer-box`, blink/fade keyframes) for things Tailwind doesn't conveniently express. **No InOrbyt Foundation design tokens are present in this repo** — colors found are ad hoc hex values (`#008eff`, `#60a5fa`, `#e6e6e6`) with no reference to `#80C3FF` or a shared token file. This is a gap, not evidence against porting the design system — it means Phase 2/3 will need to **introduce** InOrbyt Foundation tokens rather than reuse existing ones. |
| Auth | `lib/auth/auth0.js` | **Auth0** (`@auth0/nextjs-auth0`) is the identity/session provider, independent of Supabase auth. Confirmed by an explicit comment in `lib/supabase.js`: *"We don't use Supabase auth, we use username-based auth."* |
| Primary database | `lib/supabase.js`, `lib/supabaseServer.js`, `supabase-migrations/` (57 files), `IMPLEMENTATION-SUMMARY.md` | **Supabase (Postgres)** is the primary/target data store, used with the service-role key server-side (`supabaseServer.js`, lazily initialized via Proxy) and anon key client-side. |
| Legacy database | `lib/dbFirestore.js` (2143 lines), `lib/firebaseAdmin.js`, README's "Time tracking setup (Firestore)" section | **Firebase/Firestore** is legacy but still load-bearing: per `IMPLEMENTATION-SUMMARY.md`, *reads* (project listing/detail, reports) were migrated to Supabase for performance (1 query vs 7–9, 150–400ms vs 1–3s), but *writes* (create/update/delete project, member management) **still go through Firestore**, with "fire-and-forget sync" to Supabase. This is a live migration-in-progress, not a clean single-database system. |
| Dead code | `lib/db.js` (`@vercel/postgres`) | Zero importers found anywhere in `app/` or `lib/` — appears to be an abandoned earlier prototype. Should be ignored for porting purposes; flag for the user to confirm/delete rather than assuming intent. |
| Other integrations | `process.env` grep across `lib/`, `app/*/api` | Google Calendar OAuth (`GOOGLE_CLIENT_ID/SECRET`, `googleapis`), Apple/CalDAV calendar (`ts-caldav`, `lib/appleCalendar.js`), OpenAI (`OPENAI_API_KEY`/`OPENAI_MODEL` — present but no direct usage site found in the modules inspected; worth a follow-up question, likely an AI-assist feature), NL holiday calendar (`date-holidays`). |
| Testing | `tests/` + `package.json` scripts | Playwright for e2e (device-emulated: iPhone 13/13 Pro/14 Pro, iPad Pro, Pixel 5, Galaxy S21/Tab S4 — confirms **mobile-first intent already**), plus 5 plain-Node unit test files that map 1:1 to `lib/finance/*` modules. |
| PWA | `public/manifest.json` | Already configured as an installable PWA (`display: standalone`, portrait-locked, iOS icon set) named "Snel tracker" — reinforces that this is already conceived as a mobile-usage-pattern app, just delivered via web/PWA rather than native. |

**Correction to the initial suspicion**: the brief guessed Vite. Evidence shows Next.js 16 App Router. No Vite config, no CRA config, anywhere in the repo.

## 3. Core functionality inventory

SnelTracker is a **time-tracking and freelance-finance app** for the same target user as SnelOfferte (Dutch zzp'er/vakman), but positioned downstream: SnelOfferte helps quote/win the job; SnelTracker helps **track hours worked, project profitability, and personal finances against that work**. Concretely, screens/flows found:

- **Timer** — start/stop work timers, both an authenticated version (`/my`, via Supabase/Zustand) and a **standalone anonymous/local version** (`/timer`, backed entirely by `localStorage` via `lib/localStorage/localTimerService.js`) with a sync-on-login flow (`SyncOnLoginClient.js`) that migrates local timer data into the account once a user logs in.
- **Dashboard** (`/my`) — active timers, week entries overview, project selector, dashboard widgets (togglable, preference persisted).
- **Agenda** (`/my/agenda`) — calendar-style planning view, color-coded per project, integrates Google/Apple calendar free-busy data, plus an **AI auto-planning feature**: `app/my/api/agenda/route.js` calls OpenAI (`gpt-4o-mini` by default, model overridable via `OPENAI_MODEL`) with a Dutch system prompt instructing it to act as a work planner for a construction/painting-trade freelancer — generating a week schedule from projects, deadlines, priorities, travel time, and working-hour preferences, returned as structured JSON.
- **Projects** (`/my/projecten`) — list with progress bars/budget status, detail view with member hours chart and statistics (Recharts), project activities, permission model (owner vs member).
- **Expenses** — day expenses and fixed (recurring) expenses, split business vs. private, feeding into the finance calculations below.
- **Finance/forecasting** — break-even timeline, monthly "waterfall" finance model (earnings → costs → tax reserve → net → private costs → free-to-spend), hourly-rate breakdown, project-completion forecasting (bounded to 60 workdays ahead, NL-holiday-aware).
- **Reports** (`/my/reports`) — charts (Recharts, PieChartCarousel via react-slick), stored/saved reports with shareable date ranges.
- **Notes** (`/my/notes`) — personal notes, plus a **public share-token view** (`/shared/notes/[shareToken]`) with dynamic OG metadata — no-auth-required public sharing is a distinct flow to account for.
- **Wrapped** (`/my/wrapped`) — "Spotify Wrapped"-style yearly/period recap with confetti animation — a delight/retention feature, not core utility.
- **XP/gamification** (`/my/profile`) — points system rewarding volume, consistency, growth (`lib/xp/*`), leaderboard API.
- **Profile/settings** — user profile, preferences, XP display.

## 4. Reusable business logic (UI-independent)

Verified via absence of React/Next.js imports — these are candidates for 1:1 portability into React Native:

- `lib/finance/monthFinance.js`, `breakEvenTimeline.js` + `breakEvenTimelineCore.js`, `earningsTotals.js`, `fixedExpenseTotals.js`, `projectExpenseTotals.js` — the entire finance calculation layer. **Best test coverage** of anything in the codebase (each has a matching `tests/*.test.mjs`).
- `lib/xp/config.js`, `engine.js`, `formulas.js` — XP/gamification scoring, pure functions, but **no unit tests exist** for this module — a gap to flag before porting.
- `lib/hourlyRateBreakdown.js` — static breakdown percentages (simple, portable).
- `lib/dateRangeUtils.js`, `lib/time.js`, `lib/holidays.js` — date/week/month/quarter/holiday utilities (date-fns based) — portable, though `date-holidays` and `@date-fns/utc` need verifying for RN/Metro bundler compatibility in Phase 2.
- `lib/projectPermissions.js` — owner/member permission check, pure logic.
- `lib/expenseTypes.js`, `lib/quotes.js` — static config/data, trivially portable.
- `lib/utils/entryMapper.js`, `lib/utils/projectProgress.js` — pure transform/calc helpers (progress %, remaining hours, over-budget status).
- `lib/forecastService.js` — **not purely portable as-is**: it directly imports `supabaseServer` and calendar aggregation; the forecasting *algorithm* (workday-bounded lookahead) is reusable, but it's currently coupled to server-side data fetching and would need its data-access seams separated from its math before reuse.

**Supabase client setup** (`lib/supabase.js` client-side anon-key client) is a candidate for direct reuse in RN via `@supabase/supabase-js`, which has React Native support — but the server-only client (`lib/supabaseServer.js`, service-role key) must **never** ship into a mobile bundle; it needs to stay server-side (API routes / Next.js backend that the RN app calls), not become client code in the app.

## 5. Risks and blockers for React Native conversion

- **`localStorage` dependency for a whole feature, not just prefs.** The anonymous timer (`/timer`, `lib/localStorage/localTimerService.js`) and dashboard/forecast preferences (`lib/preferences/dashboardWidgets.js`, `forecastSettings.js`) are built directly on `window.localStorage`. In RN there is no `localStorage`; these need `AsyncStorage`/`expo-secure-store` equivalents, and the anonymous-timer-then-sync-on-login flow (`SyncOnLoginClient.js`) needs a redesigned local-storage strategy, not a drop-in swap.
- **`window.`/`navigator.` usage across ~17+ client components** (charts, calendar, timer sections, project detail, notes, reports) — not yet individually triaged; likely includes `window.innerWidth`-based responsive logic (irrelevant in RN, replace with `Dimensions`/`useWindowDimensions`) and possibly `navigator.clipboard` (needs `expo-clipboard`). Each of these files needs a line-level pass in Phase 2/3, not a blanket assumption.
- **`react-slick`/`slick-carousel`** (used only in `PieChartCarousel.js`) — a DOM-based carousel library, **no RN equivalent**; must be replaced (e.g. a native `FlatList` paging carousel or `react-native-reanimated-carousel`).
- **`recharts`** (project stats, reports, stored report detail) — SVG/DOM chart library, **no direct RN equivalent**; needs replacement with an RN charting library (e.g. `victory-native`, `react-native-svg`-based charts) — charts will need to be rebuilt, not ported.
- **`canvas-confetti`** (Wrapped feature) — browser Canvas API, needs an RN equivalent (e.g. `react-native-confetti-cannon`) or can be deprioritized as a nice-to-have for MVP.
- **No InOrbyt Foundation design tokens exist yet in this codebase** (see §2) — Phase 2/3 will be introducing the shared design language fresh into this app, not migrating existing token usage. This should shape how "redesign for mobile" is scoped — it's not just layout, it's also the first real application of the shared tokens here.
- **No dual-screen/desktop-only layout pattern was found** — grep for wide grid columns, "dual-screen", "foldable" found nothing; the widest grid is `grid-cols-8` (a date-range selector) and `grid-cols-7` (calendar week view). Combined with Playwright's mobile-device-emulation test matrix and the existing PWA manifest (portrait-locked, standalone), **this app is already mobile-first/single-column**, unlike the SnelOfferte dual-screen concern flagged in the brief. This meaningfully reduces one class of expected conversion risk — layouts likely translate more directly than they would for SnelOfferte.
- **Public share-token route with dynamic OG metadata** (`/shared/notes/[shareToken]`) — this is inherently a *web* concept (link previews for messaging apps). It either needs to stay a web-accessible URL (hybrid: RN app + a thin web page for shared links) or be explicitly scoped out of the native app and left as-is on the existing Next.js deployment.
- **Two live databases, one in transition.** Any RN client talking to the backend must go through API routes that already encapsulate the Firestore/Supabase split (writes still hit Firestore for projects) — the RN app should **not** embed direct Firestore or dual-write logic; it should call the same `/my/api/*` REST endpoints the current web client uses, at least for MVP, to avoid re-deriving migration-sensitive write paths. This is a deliberate design recommendation for Phase 2, not an implementation decision made now.
- **`app/my/entries/*` and `app/my/expenses/*` have API routes but no page.js** — their UI lives embedded in modals/components within `app/my/page.js`. When inventorying "screens" for Phase 2 prioritization, don't rely on route count alone — some screens are modals, not routes.
- **Stale README**: `sneltrack/README.md`'s Firestore section still describes a `[user]`-based URL pattern (`/kevin/start`) that has since been superseded by `/my/start`, `/my/stop`. Don't take repo docs at face value where they conflict with actual route files — this analysis relied on the file tree and `IMPLEMENTATION-SUMMARY.md`, not the README's setup section.
- **AI auto-planning is a server-side-only concern for porting purposes.** `app/my/api/agenda/route.js` is the sole consumer of `OPENAI_API_KEY`/`OPENAI_MODEL`; it stays a backend API route regardless of client platform — the RN app just needs to call this endpoint, no OpenAI SDK or key ever needs to live on-device.
