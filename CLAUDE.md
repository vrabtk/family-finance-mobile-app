# CLAUDE.md

Guidance for Claude Code when working in `family-finance-mobile`.

## Status

Expo / React Native client for the shared backend (`../family-finance-backend`). Light "clean fintech" theme (white cards on `#F6F8FA`, teal `#0F766E` accent). Screens: sign in / sign up, Home dashboard (net worth hero with count-up and hide toggle, this-month ring, 6-month income vs spending chart, spending by category, needs-attention list of unpaid bills and insurance dues, glance tiles; tapping anything opens the right screen/month), Expenses (complete: years and months incl. rename/archive/restore/delete, people and salaries per period, other income, expenses with add/edit/paid toggle/archive/restore/delete, search and filters, per-person breakdown), Loans, Banks, Investments, Insurance, Monthly overview, Workspace & members (switch workspace, invite). Not on mobile yet: the legacy single-file JSON import, editing a person's name/colour (only per-period salary), permanent person delete. Not yet tested on a physical device or emulator; layouts were checked on the web build at 390x844.

## Stack

Expo SDK 54, React 19.1, React Native 0.81, TypeScript (`strict`), `expo-secure-store`, `expo-linear-gradient`, `@expo/vector-icons` (Feather), `react-native-svg` (ring chart only). No navigation, state, lint or test libraries on purpose.

## Commands

- `npm start` - Expo dev server (Expo Go)
- `npm run android:usb` - phone/emulator over USB: starts Expo (`--host localhost --clear`, no Wi-Fi/firewall setup) and keeps `adb reverse tcp:5051 tcp:5051` applied every 4s (Expo and adb restarts drop it), so `.env` can stay `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5051/api/v1`. Port override: `API_PORT`. `npm run usb:forward` applies the forward once; check with `adb reverse --list` (must list tcp:5051).
- `npm run android` / `npm run ios` - native builds (`android/` is committed)
- `npm run web` - react-native-web (handy for checking layout; session uses browser storage there)
- Type-check: `npx tsc --noEmit` (must stay clean)
- Tests: `npm test` (Jest + jest-expo + React Native Testing Library; `jest.setup.js` stubs icons, safe-area, svg, gradient and motion). Must stay green.

## Configuration

- `EXPO_PUBLIC_API_BASE_URL` in `.env`: full API base including `/api/v1`, using the machine's **LAN IP** on a physical device, e.g. `http://192.168.x.x:5051/api/v1` (backend port is 5051). Restart Expo after editing. If it is missing the app shows a setup screen.
- `app.json` sets `usesCleartextTraffic: true` so plain-HTTP LAN dev works on Android. Remove it and use HTTPS for production builds.
- Android package: `com.harikrishna108.familyfinancemobile`.

## Layout

```
index.ts, App.tsx        root: providers, boot routing, bottom tab bar, Android back handling
src/theme.ts             colors, space, radius, type, shadow (the only place for style constants)
src/format.ts            inr / inrCompact (Indian grouping, L / Cr), toNumber, date helpers
src/api.ts               fetch client + one function per endpoint; bindAuth() adds token + auto-refresh
src/session.tsx          SessionProvider/useSession (status, workspace, role, signIn/Up/Out, switchWorkspace)
src/storage.ts           session persistence: SecureStore on native, browser storage on web
src/hooks.ts             useAsync (load / pull-to-refresh / error)
src/ui.tsx               shared components: Screen, Card, Button, Field, Chips, Sheet, ConfirmSheet, Fab, Stat, Badge, ...
src/navigation.ts        tab and "More" route keys, plus `Go(tab, {more?, focus?})`: the one navigation call; `focus` opens Expenses on a given year/month
src/home/                logic.ts (net worth, current-month pick, trend window, category breakdown, attention items), useHome.ts (parallel loads; one failing section never blanks the screen)
src/motion.tsx           useReveal (0->1 count-up/ring/bars), Reveal (staggered entrance), Pulse (skeleton). Tests replace it with instant versions.
src/expenses/            Expenses module brain: logic.ts (pure rules: scope, totals, filters, form parsing), useExpenses.ts (state + every action)
src/screens/             AuthScreen, HomeScreen (+ home/parts.tsx),  ExpensesScreen (+ expenses/sheets.tsx), BanksScreen, MoreScreen (+Settings), ResourceScreen, resources
__tests__/ folders      logic.test.ts (rules), api.test.ts (client + token refresh), ExpensesScreen.test.tsx (whole module vs a stateful fake API)
```

## Conventions

- **Auth:** screens never handle tokens. `api.ts` reads the current session through `bindAuth` (set by `SessionProvider`), attaches the Bearer token, and on `401` + `code: 'TOKEN_EXPIRED'` refreshes once (shared by concurrent calls) and retries; a failed refresh signs out. Session is saved only via `commit()` in `session.tsx`. Never log tokens or put them in URLs.
- **Roles:** `useSession()` gives `canWrite` (member/admin) and `isAdmin`. Hide write controls for viewers and delete controls for non-admins, matching the backend rules.
- **New list screen (loans-style):** add a `ResourceConfig` in `src/screens/resources.tsx` (fields, summary tiles, row view) plus a `crud(...)` entry in `api.ts`. `ResourceScreen` supplies list, filter chips, add/edit sheet, validation and delete.
- **New custom screen:** build it from `ui.tsx` components inside `<Screen>`; load data with `useAsync`; add the tab or More entry in `navigation.ts` and `App.tsx`.
- Style only through `theme.ts` tokens; no hard-coded colors in screens.
- Money from the API can be a string (Prisma Decimal): always go through `toNumber` / `inr`.
- The `__other_income__` expense category marks "Other income" rows (shared with the web app); keep it out of spending totals.
- Keep `strict` TypeScript clean.


## Features added after the first release (keep in mind when editing)

- **Keyboard:** `App.tsx` wraps the app in a padded `KeyboardAvoidingView` (Android is edge to edge, so the OS no longer resizes) and hides the tab bar while the keyboard is open; `Sheet` and `AuthScreen` use `behavior="padding"` on both platforms.
- **Bottom bar:** Home + three user-pinned screens + More. Pure rules in `navigation.ts` (`PINNABLE`, `cleanPins`, `togglePin`, `movePin`, `activeBarKey`); pins are stored on the device with `storage.ts` `loadPrefs/savePrefs`. `MoreScreen` lists every pinnable screen that is not pinned. New screens: add to `PINNABLE` (and `MoreKey`) and route them in `App.tsx`.
- **Choices are dynamic** (`src/options.tsx`): expense categories and loan/investment/insurance types come from `GET /workspaces/:id/options`. Use `<OptionSelect kind=... />` or a `kind: 'option'` field in `resources.tsx`; never hard-code a list. Overview category and the two frequency lists stay fixed on purpose (the totals depend on them).
- **Expenses layout:** period chips (year row, month row, each ending in an "Add" chip), the summary card, then three views chosen by a segment control: Bills (search, filters, list split into To pay / Paid / Archived by `expenses/view.ts` `groupByStatus`), People, Other income. The add button follows the view.
- **Members** (`screens/Members.tsx`), **profile and password** (`ProfileScreen.tsx`), **forgot password** (`ForgotFlow` in `AuthScreen.tsx`), **analytics** (`analytics/logic.ts` + `AnalyticsScreen.tsx`), **export/import** (`backup.ts` + `DataScreen.tsx`; needs `expo-document-picker`, `expo-sharing`, `expo-file-system`, so it needs a new native build), years/months **reorder** (up/down in the Manage sheet, `moveId` in `expenses/logic.ts`).
- `session.tsx` has `patchSession` for changing the stored user or tokens (profile edits, password change).
- The server address is never shown in the UI.

## Secrets guard (read before committing)

- A pre-commit hook in `.githooks/pre-commit` blocks secret files (`.env*` except `.env.example`, keys, certificates, keystores, `ff-key*`, personal data exports) and secret-looking content (private keys, JWT/Supabase keys, cloud/API tokens, database URLs with a real password). It never prints the values.
- Turn it on once per clone: `git config core.hooksPath .githooks` (already set in this working copy; the hook script is pinned to LF by `.gitattributes`).
- A harmless example line can carry the text `allow-secret`. Do not use `--no-verify` to get past it.
- Real values live only in `.env` (git-ignored). Never paste keys or database URLs into code, docs, tests or Jira.
- This repo is **public** on GitHub: assume everything committed is world-readable. `EXPO_PUBLIC_*` values are bundled into the app and are not secret either, so never put real keys in them.
- `npm audit` lists findings in the Expo/Metro build tooling (fix needs an Expo SDK major upgrade); the app itself ships only the JS bundle. Apply `npm audit fix` (non-breaking) now and then, and plan the Expo upgrade.

## Expenses module rules (keep in sync with the web app)

- A person belongs to a year/month only if they have a salary entry for it; "Remove from month" deletes that entry, not the person.
- `__other_income__` rows are income, never spending or items to pay. Archived rows never count in totals.
- Expenses are created with `groupId: null` in flat years (no months). Members archive; only admins delete or archive/restore years and months.
- Change totals logic only in `src/expenses/logic.ts` and cover it in `logic.test.ts`.

## Release builds (Google Play)

- `app.json` holds the static config; `app.config.js` sets `android.usesCleartextTraffic` to true only when `EXPO_PUBLIC_API_BASE_URL` starts with `http://` (local development). A release build must use an `https://` address.
- `eas.json` has two profiles, both pointing at `https://ffbackendapi.duckdns.org/api/v1` (the address is baked into the build; `.env` is git-ignored and not uploaded): `preview` (APK for your own phone) and `production` (AAB for Play, version code auto-increments).
- Build: `npx eas-cli login`, then `npx eas-cli build --platform android --profile preview` (first) and `--profile production`. The Android package name `com.harikrishna108.familyfinancemobile` cannot change after the first Play upload.
- Icons are generated placeholders (teal coin with an F) in `assets/`; `assets/store/` has the 512 px Play icon and a placeholder feature graphic. Replace with real artwork when available.

## Account deletion

More > Delete account asks for the password and calls `POST /auth/delete-account`, then signs out locally. A shared workspace with no other admin is refused by the server (409); the screen shows that message as is. Google Play also needs a public web page and privacy policy (not in this repo).

## Home dashboard rules

- The "current month" is chosen in `home/logic.ts` `pickCurrentPeriod` (period named after today's month and year, else the latest period with activity). Home passes it to Expenses via `go('expenses', { focus })`, so both screens show the same month.
- Net worth = bank balances + investment current value - outstanding debt. The hide toggle masks only the net-worth card.
- Visual-only code (rings, bars, animation) stays in `screens/home/parts.tsx` and `motion.tsx`; every number comes from `home/logic.ts` and is unit-tested. Use `accessibilityLabel` for the final value of animated numbers.
- Expenses data is tagged with the month it belongs to (`key` in `useExpenses`), so a screen never shows stale or zeroed numbers while another month loads.
