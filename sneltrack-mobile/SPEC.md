# SnelTracker Mobile — Build Spec (Expo / React Native, front-end only)

Backend stays untouched. The app talks to the existing Next.js backend (`https://sneltrack.vercel.app`, configurable) via its `/my/api/*` REST routes, authenticated with the existing Auth0 cookie session.

## Location & stack

- New directory at repo root: `sneltrack-mobile/`
- Expo SDK (latest stable), **TypeScript strict** (`"strict": true`), **expo-router** with native tabs + native stack
- State: **zustand** (mirrors the web store's shape where sensible)
- Dates: **date-fns** (same as web)
- Icons: **expo-symbols** (SF Symbols) for all navigational/system icons
- Font: **Plus Jakarta Sans** via `@expo-google-fonts/plus-jakarta-sans` + `expo-font`; system font fallback for dense numeric data
- Storage: `@react-native-async-storage/async-storage` for preferences (replaces web `localStorage`)
- WebView: `react-native-webview` for the login flow
- Safe areas: `react-native-safe-area-context`
- Haptics: `expo-haptics`
- Every code file starts with its file path as a comment.

## Auth flow (no backend changes)

1. App start → `GET {API_URL}/my/api/user` with `credentials: 'include'`. 200 → logged in; 401 → show login screen.
2. Login screen: button "Inloggen" opens a **WebView** (`sharedCookiesEnabled={true}`, iOS) at `{API_URL}/auth/login`. Auth0 Universal Login runs inside it.
3. Detect successful login via `onNavigationStateChange`: when the URL lands on `{API_URL}/my*`, the `appSession` cookie is in the shared native cookie jar → close WebView, re-fetch `/my/api/user`, enter the app.
4. Logout: fetch/WebView hit on `{API_URL}/auth/logout`, then clear local state.
5. `API_URL` from `process.env.EXPO_PUBLIC_API_URL`, default `https://sneltrack.vercel.app`.

All API calls go through one typed client (`lib/api/client.ts`) that: prefixes `API_URL`, sets `credentials: 'include'`, JSON-parses, and on 401 flips the auth store to logged-out.

## Design tokens — `theme/colors.ts` (InOrbyt Foundation)

Resolve via `useColorScheme()`; **no hardcoded hex outside this file**.

```ts
export const light = {
  bgMain: '#FFFFFF', bgSurface: '#F7F8FA', bgInput: '#F1F3F5',
  textMain: '#1A1A1A', textMuted: '#999999', borderMain: '#E6E6E6',
  primary: '#80C3FF',        // InOrbyt primary blue — buttons/CTAs (dark text on top)
  primaryDeep: '#008EFF',    // tinted text, links, selected tab (contrast-safe on white)
  primarySoft: '#E5F3FF',    // blue-10: selected/hover rows
  purple: '#8C1AFF',         // community, badges, verification
  orange: '#FFA540',         // warnings, unpriced (0.00) items
  success: '#40A69F', error: '#FF4E64', draft: '#FFC740',
};
export const dark = { /* mirrored: bgMain #121212-family, elevated surfaces lighter,
  same accent hues; success gets the semi-transparent green treatment for money surfaces */ };
```

Contrast rules: `primary` (#80C3FF) is light — use it as a **fill with dark text** (`textMain`), never as text on white. Tinted text/links/icons use `primaryDeep`. Amounts in lists: `fontVariant: ['tabular-nums']`.

Shape: cards radius 16, buttons 12, inputs 10. Flat design — no heavy shadows. Spacing rhythm 4/8/12/16/24.

## Navigation (expo-router)

```
app/
  _layout.tsx          # root: fonts, theme, auth gate, native stack
  login.tsx            # login screen + WebView flow
  (tabs)/
    _layout.tsx        # native bottom tabs, 5 tabs, SF Symbols + Dutch labels
    index.tsx          # Vandaag  (timer.circle.fill? use "timer")
    projecten.tsx      # Projecten ("folder")
    agenda.tsx         # Agenda   ("calendar")
    rapporten.tsx      # Rapporten ("chart.bar")
    profiel.tsx        # Profiel  ("person.circle")
  project/[id].tsx     # pushed detail (inline title, swipe-back free)
  entry-new.tsx        # formSheet: nieuwe registratie
  expense-new.tsx      # formSheet: nieuwe uitgave
```

- Root tab screens: `headerLargeTitle: true`. Pushed screens: inline titles. Never block swipe-back.
- Creation flows are **sheets** (`presentation: 'formSheet'`): grabber, "Annuleer" left, primary action right, disabled until valid.
- Tab labels always visible; selected tab tinted `primaryDeep`.

## Screens (MVP)

### 1. Vandaag (dashboard/timer) — the heart of the app
- Large title "Vandaag". Running-timer card at top: project name, big `HH:MM:SS` (tabular numerals, blinking colon optional), stop button (error red). If no timer: primary CTA "Start timer" (opens project/activity picker sheet with detents `[0.5, 1.0]`).
- Start/stop endpoints: `POST /my/start`, `POST /my/stop` — **verify exact route + payload against `sneltrack/app/my/start/route.js` and `stop/route.js` before coding**.
- Week overview below: 7-day bars (Mon–Sun, hours per day, current day highlighted), week total in hours + earnings (`€ 1.234,50` NL formatting). Data: `GET /my/api/week-entries?weekStart=&weekEnd=` (ISO dates; check the service for the exact param format).
- Tap a day → day-entries list (pushed screen or sheet) with entries: project, activity, duration, amount. Swipe-to-delete with red trailing action + confirmation action sheet ("Registratie verwijderen?" / button "Verwijder registratie").
- Pull-to-refresh. Skeleton loading states. Empty state: "Nog geen uren deze week" + "Start je eerste timer".
- Haptics: `notificationAsync(Success)` on timer stop, `impactAsync(Light)` on start.

### 2. Projecten
- Data: `GET /my/api/...` — **verify: web uses `getUserProjectsWithStats` served from a projects API route; find the actual route path in `sneltrack/app/my/` before coding.**
- Plain list, rows: color dot per project, name, client, progress bar (budget hours), trailing hours + chevron. Over-budget badge in `orange`.
- Port `lib/utils/projectProgress.js` logic to TS (`lib/logic/projectProgress.ts`).
- Detail (pushed): stats header (total hours, earnings, progress), members' hours, recent entries. Read-only in MVP (no project create/edit — those writes still ride the Firestore path on the backend; the API handles it, but keep mobile MVP read-only here).

### 3. Agenda
- Week list view (not a custom month grid in MVP): days as sections, planning items color-coded per project. Data from the agenda API route (verify path/shape in `sneltrack/app/my/api/agenda/` and `app/my/agenda/page.js` fetch calls).
- AI weekplanning button may be deferred; if included: primary button "Genereer weekplanning" that POSTs to the agenda route and shows a loading state ("Planning maken…").

### 4. Rapporten (MVP-light)
- Period segmented control: Week | Maand | Kwartaal (native segmented control).
- Totals cards: uren, omzet, kosten, netto — reuse ported finance logic (`monthFinance`, `earningsTotals`, `fixedExpenseTotals`) on data from the reports/dashboard-stats API.
- Simple bar chart with `react-native-svg` (hours per day/week) — no recharts port, no carousel.

### 5. Profiel
- User card (name, avatar/initials), XP level + points (port `lib/xp/*` to TS if the API doesn't return computed XP — check `GET /my/api/xp`).
- Settings rows (inset grouped list): dashboard-widget toggle (AsyncStorage), donker/licht follows system, "Uitloggen" (red, action sheet confirm "Uitloggen?").

## Ported business logic — `lib/logic/` (TS ports of web `sneltrack/lib/`)

Port 1:1, typed, pure (no fetch/React): `finance/monthFinance`, `finance/earningsTotals`, `finance/fixedExpenseTotals`, `finance/projectExpenseTotals`, `time` (duration helpers), `utils/projectProgress`, `utils/entryMapper`, `xp/config+formulas+engine`, `expenseTypes`. Copy the logic faithfully — the web unit tests in `sneltrack/tests/*.test.mjs` define expected behavior; port those tests too (plain node or vitest) and make them pass.

## UX copy (Dutch, je/jij — ux-writing rules)

- Verb-first buttons: "Start timer", "Stop timer", "Voeg registratie toe", "Uitloggen".
- Confirmations restate the action: title "Registratie verwijderen?" → button "Verwijder registratie", cancel "Annuleren".
- Errors: wat → waarom → wat nu: "Uren laden is niet gelukt. Controleer je verbinding en probeer het opnieuw." + "Probeer opnieuw".
- Numbers: `€ 1.234,50`, dates `3 juli 2026`, durations `6u 30m`.
- No anglicisms where Dutch is natural; sentence case everywhere.

## HIG guardrails (check every screen)

44pt touch targets · Dynamic Type on (`allowFontScaling`, cap only tab labels) · dark mode verified · safe areas via context · content scrolls under bars (`contentInsetAdjustmentBehavior="automatic"`) · VoiceOver labels on interactive elements, grouped rows read as one · Reduce Motion respected · empty/loading/error states on every screen · no Material patterns (no FAB, no toasts — use inline feedback).

## Verification requirement

Before coding each API integration, **read the corresponding route file** under `sneltrack/app/my/` to confirm exact path, method, params, and response shape — the web client components (`stores/useStore.js`, `app/my/*Client.js`) show real call sites. Do not invent endpoints.

`npx tsc --noEmit` must pass; ported logic tests must pass. App must start with `npx expo start` without runtime errors (verify bundling at minimum).
