# Credit Follow

A Hebrew (RTL) personal finance app. Users sign in with Google or Facebook, enter their average
monthly income, their own expense categories with monthly budgets, and a monthly savings goal.
They then record expenses and follow spending, remaining budgets and credit card charges per
**financial cycle**. The cycle can start on a fixed day, on the salary day, or on the credit card
deduction day, in the user's time zone.

## Status

| Area                                                   | State                                                                                                                                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo, API foundation, models                       | ✅ Phase 1                                                                                                                                                                                                |
| Google / Facebook sign-in (API verification, sessions) | ✅ Implemented and tested against locally signed tokens and a mocked Graph API. **Not yet tested with real Google/Facebook apps** (no credentials yet). See [Authentication setup](#authentication-setup) |
| Development-only login                                 | ✅ For Expo Go / web before OAuth is configured. Refused in production                                                                                                                                    |
| Onboarding: income → expenses → savings                | ✅                                                                                                                                                                                                        |
| Dashboard, categories, transactions, income, settings  | ✅                                                                                                                                                                                                        |
| Financial-cycle and budget calculations                | ✅ Pure functions in `packages/shared`, unit-tested                                                                                                                                                       |
| Mobile UI on a real device / simulator                 | ⚠️ Typechecked, linted and bundled for Android/iOS/web, but **not yet run on a device**                                                                                                                   |

## Features

- **Sign-in:** Google (native SDK, ID token verified by the API) and Facebook (classic access token
  on Android, Limited Login OpenID token on iOS). The API issues its own sessions.
- **Onboarding (4 steps, Hebrew RTL)**
  1. _Income:_ "מה ההכנסה החודשית הממוצעת שלך?" — average over the previous six months, with an
     optional six-month calculator.
  2. _Fixed expenses:_ custom name + monthly amount rows (add, edit, remove; optional). The total
     and **"ההכנסה שנותרה לאחר ההוצאות הקבועות"** update live; a warning appears if fixed
     expenses exceed income.
  3. _Variable budgets:_ custom categories with a planned monthly budget (at least one). **"הבא"**
     validates the current row and appends another, optional row; **"לשלב הבא"** continues.
  4. _Savings goal:_ shows the full plan (income − fixed − savings − variable = unallocated) and
     warns when variable budgets exceed what is available. **"לסיום"** submits everything.
     A name can be used only once across fixed expenses and variable budgets.
- **Dashboard:** **"נותר להוציא"** = variable budget − actual variable spending in the cycle, with
  a daily allowance; the monthly plan (8 figures: income, fixed expenses, income after fixed,
  savings goal, variable budget, actual variable spending, remaining, unallocated); per-category
  bars (budget, spent, remaining, %, status); the fixed expenses list; warnings for fixed >
  income, over-allocation and overspending. Buttons **"עריכת הוצאות קבועות"**,
  **"עריכת תקציב משתנות"** and **"עריכת הכנסות"**. Pending card charges, recent transactions
  with statuses (ממתין לחיוב / חויב / שולם), previous cycles.
- **Fixed expenses / variable budgets:** create, edit, archive and restore each, in separate
  screens. Record, edit and delete expenses (amount, category or fixed expense, date, payment
  method, description); list by cycle and category.
- **Income management:** update the average monthly income and the savings goal.
- **Financial cycle settings:** what the cycle follows (fixed day / salary / credit card), the
  start day, salary day, credit card deduction day and time zone, with a live preview. Sign out
  and delete account.

## Architecture

```
credit-follow/
├── apps/mobile/                 Expo SDK 57 + Expo Router + TypeScript + TanStack Query
│   ├── app.config.ts            Dynamic config: RTL, bundle ID, sign-in SDK plugins (env-driven)
│   └── src/
│       ├── app/                 Routes
│       │   ├── _layout.tsx      Providers + route guards (Stack.Protected)
│       │   ├── sign-in.tsx
│       │   ├── onboarding/      index (income), expenses, savings
│       │   └── (app)/           index (dashboard), expenses, income, settings,
│       │                        categories/{new,[id]}, transactions/{index,new,[id]}
│       ├── api/                 fetch client (token refresh, errors) + typed endpoints
│       ├── auth/                AuthProvider, native Google/Facebook sign-in, secure token storage
│       ├── components/          Screen, Button, fields, cards, steppers, forms, …
│       ├── hooks/api.ts         React Query hooks + cache invalidation
│       ├── i18n/                Hebrew strings, RTL helpers
│       └── onboarding/          Onboarding draft state
├── services/api/                Node.js + Express 5 + Mongoose 9 + TypeScript (ESM)
│   └── src/
│       ├── app.ts               App factory (helmet, CORS, routes, auth middleware, errors)
│       ├── config/              env validation (Zod), env → app options (identity verifiers)
│       ├── auth/                Google/Facebook verifiers, JWT access tokens, sessions, user linking
│       ├── middleware/          requireAuth, validate (Zod), error handler
│       ├── models/              User, Session, ExpenseCategory, ExpenseTransaction
│       ├── routes/              auth, me, onboarding, categories, transactions, dashboard, health
│       └── services/            finance (cycle queries, dashboard), DTO serializers
└── packages/shared/             Zod schemas, DTO types, and the financial calculations
    └── src/finance/             dates (Intl time zones), cycle, transactionStatus, budget, money
```

- **npm workspaces**, one root `package-lock.json`. `@credit-follow/shared` compiles to `dist/`.
  It is built on `npm install` (root `postinstall`) and by `npm run build`. Rebuild it after
  changing it: `npm run build -w @credit-follow/shared`.
- **Money** is always an integer number of agorot (`…Minor` fields), so all arithmetic is exact.
  User input is parsed from strings (`parseMoneyToMinor`), never through floating point.

### Authentication and sessions

```
App ──(native SDK)──► Google / Facebook ──► ID token / access token
App ──POST /auth/google|facebook──► API ──verifies with provider──► find/create user
API ──► { accessToken (JWT, 15 min), refreshToken (opaque, 30 days), user }
```

- **Google:** the API verifies the ID token's RS256 signature against Google's published keys. It
  also checks the issuer, the audience (`GOOGLE_CLIENT_IDS`) and expiry.
- **Facebook (Android):** `debug_token` with the app access token confirms that the token is valid
  and was issued to **our** app ID. Then `/me` is called with `appsecret_proof`.
- **Facebook (iOS Limited Login):** the OpenID token is verified against Facebook's keys (issuer
  `https://www.facebook.com`, audience = app ID), and its `nonce` must match the one the app
  generated.
- **Sessions:** the access token is an HS256 JWT signed with `JWT_SECRET`. Each request also
  checks that its session is active, so logout or revocation takes effect immediately.
- **Refresh tokens:** 256-bit random values. Only their SHA-256 hash is stored. They are
  **rotated on every refresh**. Presenting an already-rotated token is treated as theft and
  **revokes the whole session**.
- **Mobile storage:** the refresh token is kept in the Keychain / Keystore (`expo-secure-store`).
  The access token is kept only in memory. Concurrent refreshes share one request.
- **User IDs come only from the verified access token.** Request bodies are parsed with Zod
  schemas that drop unknown fields, and every query is scoped to the authenticated user.
- **Account linking:** only emails the provider marks as verified (Google `email_verified`) are
  stored or used to link accounts. Facebook does not report email verification, so Facebook
  emails are not stored.
- Rate limiting covers sign-in and refresh (20/min per IP). `DELETE /me` deletes the account and
  all its data.

### API endpoints

All endpoints except `/health` and `/auth/*` require `Authorization: Bearer <accessToken>`.
Errors look like `{ "error": { "code", "message", "details?" } }`, with Hebrew `message` values.

| Method & path                                   | Purpose                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                   | Liveness and database status                                                                                                                                                                                        |
| `GET /auth/providers`                           | Which sign-in methods the server has configured                                                                                                                                                                     |
| `POST /auth/google` `{ idToken }`               | Google sign-in                                                                                                                                                                                                      |
| `POST /auth/facebook` `{ kind, … }`             | Facebook sign-in (`access_token` or `limited` + `nonce`)                                                                                                                                                            |
| `POST /auth/dev` `{ displayName }`              | Development-only login (only when `AUTH_DEV_LOGIN_ENABLED=true`)                                                                                                                                                    |
| `POST /auth/refresh` / `POST /auth/logout`      | Rotate tokens / revoke the session (`{ refreshToken }`)                                                                                                                                                             |
| `GET /me`, `DELETE /me`                         | Current user / delete the account and all data                                                                                                                                                                      |
| `PUT /me/finance`                               | `{ averageMonthlyIncomeMinor?, monthlySavingsGoalMinor? }`                                                                                                                                                          |
| `PUT /me/financial-cycle`                       | `{ anchor, startDay, salaryDay, creditCardChargeDay, timeZone }`                                                                                                                                                    |
| `POST /onboarding`                              | `{ averageMonthlyIncomeMinor, fixedExpenses[{name, monthlyBudgetMinor}], variableExpenses[…], monthlySavingsGoalMinor }`                                                                                            |
| `GET/POST /categories`, `PATCH /categories/:id` | Fixed expenses and variable budgets, by `kind` (`fixed` / `variable`): list (`?kind=fixed&includeArchived=true`), create (`{ name, kind, monthlyBudgetMinor }`), edit / archive (`isArchived`). `kind` is immutable |
| `GET/POST /transactions`                        | List a cycle (`?cycleOffset=-1&categoryId=…`), record an expense                                                                                                                                                    |
| `GET/PATCH/DELETE /transactions/:id`            | Read, edit, delete                                                                                                                                                                                                  |
| `GET /dashboard?cycleOffset=0`                  | Cycle info, budget summary, pending charges, recent transactions                                                                                                                                                    |

### Financial rules (`packages/shared/src/finance`)

- **Cycle start day:** `startDay`, `salaryDay` or `creditCardChargeDay`, depending on `anchor`.
  When the day is past the end of a short month, the month's last day is used (31 → Feb 28/29).
  The cycle runs from local midnight on its start day until the next cycle starts, in the user's
  `timeZone` (DST-aware, using `Intl` only).
- **Expense dates** are entered as calendar days and stored at 12:00 local time on that day.
- **Credit card status:** a card purchase is charged on the first deduction day strictly after
  the purchase day. It is `pending` until then and `charged` afterwards. Other payment methods
  are `paid` immediately. Real card issuers use a billing cut-off a few days before the deduction
  day, so this is an approximation.
- **Monthly plan** (`buildBudgetSummary` / `computeBudgetPlan`):
  - `fixedExpenses = Σ active fixed monthly amounts`
  - `incomeAfterFixed = income − fixedExpenses`
  - `availableForVariable = incomeAfterFixed − savingsGoal`
  - `variableBudget = Σ active variable budgets`
  - `unallocated = incomeAfterFixed − savingsGoal − variableBudget` (negative = over-allocated)
- **Actual spending** (per financial cycle):
  - `variableSpent = Σ transactions in variable categories in the cycle` (archived variable
    categories included, each transaction counted once)
  - `remainingVariable = variableBudget − variableSpent` — the dashboard's **"נותר להוציא"**
    (negative when overspent, never clamped); `overspent = max(0, −remainingVariable)`
  - `dailyAllowance = ⌊max(0, remainingVariable) / days remaining⌋`
  - `projectedSavings = incomeAfterFixed − max(variableBudget, variableSpent)`
- **No double counting:** fixed expenses are deducted once, in the plan. A payment recorded
  against a fixed expense is shown (`fixedRecorded`) but never reduces the variable budget.
- **Per variable category:** `remaining = budget − spent`, `usedPercent = round(spent / budget ×
100)`; status `warning` at 80%, `over` above 100%, `unbudgeted` with spending but no budget.
  A category with no expenses shows its full budget as remaining.
- Plans are monthly; actual spending is aggregated by the configured financial cycle.

### Data model: fixed vs. variable

Fixed expenses and variable budgets are stored in the same `expensecategories` collection with a
`kind` field (`'fixed' | 'variable'`). This reuses the authenticated CRUD endpoints, ownership
checks and transactions, and the unique (user, name) index prevents planning the same expense in
both groups. `kind` is immutable after creation. Categories created before `kind` existed have
no value and are treated as `variable` everywhere; to make it explicit run
`npm run migrate:category-kind -w @credit-follow/api -- --execute` (idempotent, deletes nothing;
without `--execute` it only reports).

### Hebrew / RTL

- The `expo-localization` plugin sets `supportsRTL` and `forcesRTL` for native builds.
- Expo Go resets RTL preferences, so every screen root and modal also sets `direction: 'rtl'`.
- Full-width text and inputs use `rtlTextStyle`, which mirrors `textAlign` correctly whether or
  not native RTL is active.
- On web, `<html dir="rtl" lang="he">` is set at runtime. All UI strings are in
  `src/i18n/he.ts`, and API error messages are in Hebrew.

## Prerequisites

- **Node.js 22.12+** (Node 24 recommended, see `.nvmrc`) and **npm 10+**
- **MongoDB:** local MongoDB 7/8 or a MongoDB Atlas cluster
- **For Google/Facebook sign-in:** a development build of the app, because both SDKs contain
  native code and do not run in Expo Go:
  - Android Studio (Android), or Xcode on macOS (iOS), or EAS Build
- **Without credentials:** Expo Go or the web build, using the development login

## Installation

```bash
npm install          # installs all workspaces and builds packages/shared
cp services/api/.env.example services/api/.env
cp apps/mobile/.env.example  apps/mobile/.env
```

In `services/api/.env`, set at least `MONGODB_URI` and `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Add mobile dependencies with `npx expo install <pkg>` from `apps/mobile`.

## Environment variables

**services/api/.env**

| Variable                                             | Required     | Description                                                                     |
| ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `MONGODB_URI`                                        | yes          | `mongodb://…` or `mongodb+srv://…`                                              |
| `JWT_SECRET`                                         | yes          | ≥ 32 random characters; signs access tokens                                     |
| `PORT`, `NODE_ENV`, `CORS_ORIGINS`                   | no           | Defaults: `4000`, `development`, all origins                                    |
| `TRUST_PROXY`                                        | no           | `true` behind a load balancer (correct client IPs for rate limiting)            |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | no           | Defaults: 900 seconds, 30 days                                                  |
| `GOOGLE_CLIENT_IDS`                                  | for Google   | Comma-separated: the **Web** OAuth client ID, plus the **iOS** client ID        |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`             | for Facebook | Must be set together. The secret stays on the server                            |
| `FACEBOOK_GRAPH_API_VERSION`                         | no           | Default `v24.0`                                                                 |
| `AUTH_DEV_LOGIN_ENABLED`                             | no           | `true` enables `POST /auth/dev`. The API refuses to start with it in production |

**apps/mobile/.env.** Everything here ends up in the app or its native config, so never put
secrets in it.

| Variable                                   | Description                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`                      | API URL. Android emulator: `http://10.0.2.2:4000`. Device: `http://<LAN-IP>:4000` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`         | Web OAuth client ID (the ID token audience)                                       |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`         | iOS OAuth client ID                                                               |
| `EXPO_PUBLIC_FACEBOOK_ENABLED`             | `true` after configuring the Facebook SDK below                                   |
| `EXPO_PUBLIC_DEV_LOGIN`                    | `true` shows the development login (development builds only)                      |
| `APP_BUNDLE_ID`                            | iOS bundle ID / Android package (default `com.creditfollow.app`)                  |
| `GOOGLE_IOS_URL_SCHEME`                    | Reversed iOS client ID. Enables the Google config plugin                          |
| `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_TOKEN` | Enable the Facebook config plugin (client token, not the app secret)              |

## Authentication setup

The code for both providers is complete, but it needs your own OAuth apps. Until those exist,
use the development login.

### Google

1. In [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services →
   OAuth consent screen**. Configure the app with the `email` and `profile` scopes, and add test
   users while it is in testing mode.
2. Under **Credentials → Create credentials → OAuth client ID**, create three clients:
   - **Web application.** Its client ID goes in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) **and**
     `GOOGLE_CLIENT_IDS` (API).
   - **Android:** package `com.creditfollow.app` (or your `APP_BUNDLE_ID`) plus the SHA-1 of the
     signing certificate.
     - Local debug builds (run in `apps/mobile` after `npx expo prebuild`):

       ```bash
       keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
       ```

     - EAS: `npx eas-cli credentials`
     - Play: the Play Console app signing key
     - The code never references this client ID, but Google requires the client to exist.
   - **iOS:** bundle ID `com.creditfollow.app`. Put its client ID in
     `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and its reversed client ID
     (`com.googleusercontent.apps.…`) in `GOOGLE_IOS_URL_SCHEME`. **Also add the iOS client ID
     to `GOOGLE_CLIENT_IDS`** (comma-separated, after the web client ID). On iOS the ID token's
     audience may be the iOS client ID instead of the web client ID, and the API rejects any
     audience that isn't listed.
3. Rebuild the native app (see [Development build](#development-build)).

### Facebook

1. At [developers.facebook.com](https://developers.facebook.com/), create an app with the
   **Facebook Login** use case.
2. Get the IDs:
   - **App settings → Basic:** App ID → `FACEBOOK_APP_ID` (app and API). App secret →
     `FACEBOOK_APP_SECRET` (**API only**).
   - **App settings → Advanced → Client token** → `FACEBOOK_CLIENT_TOKEN` (app).
3. Add platforms:
   - **Android:** package `com.creditfollow.app`, class `com.creditfollow.app.MainActivity`, and
     key hashes (the Base64 SHA-1 of your signing certificates).
   - **iOS:** bundle ID `com.creditfollow.app`.
4. Set `EXPO_PUBLIC_FACEBOOK_ENABLED=true` and rebuild the native app.
5. Before going live, Facebook requires a privacy policy URL and a **data deletion** URL or
   instructions. In-app account deletion (`DELETE /me`) exists, but no public deletion page or
   callback has been created yet.

### Development build

```bash
cd apps/mobile
npx expo prebuild --clean     # generates android/ and ios/ with the configured plugins
npx expo run:android          # or: npx expo run:ios  (macOS)
# or in the cloud: npx eas-cli@latest build --profile development
```

Rebuild whenever `.env` values that `app.config.ts` reads, or plugins, change.

### Android build on Windows

React Native's autolinked C++ code produces object-file paths longer than 260 characters
(e.g. `react-native-gesture-handler`, about 370 characters). The default CMake 3.22.1 bundles
ninja 1.10.2, which fails with `Filename longer than 260 characters`.

The config plugin `apps/mobile/plugins/withAndroidCmakeVersion.js` therefore pins
**CMake 3.31.6**, which bundles ninja 1.12.1 with long-path support. One-time Windows setup:

1. **Enable long paths** (PowerShell **as Administrator**), then restart Windows:

   ```powershell
   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```

2. **Install CMake 3.31.6:** Android Studio → **Settings → Languages & Frameworks → Android
   SDK → SDK Tools**. Tick **Show Package Details**, then under **CMake** select **3.31.6** and
   click **Apply**. Gradle does not download non-default CMake versions automatically
   (`[CXX1300] CMake '3.31.6' was not found`).

## Running

### API

```bash
npm run dev:api                        # http://localhost:4000 (tsx watch)
curl http://localhost:4000/health      # "database": "connected" confirms MongoDB access
```

Production: `npm run build && npm run start:api`. In production, set real environment variables
rather than a `.env` file.

### Mobile app

```bash
npm run dev:mobile    # expo start → a (Android), i (iOS), w (web), or scan with Expo Go
```

**Trying the app without OAuth credentials:**

1. Set `AUTH_DEV_LOGIN_ENABLED=true` (API) and `EXPO_PUBLIC_DEV_LOGIN=true` (app).
2. Restart both.
3. Use the "כניסת פיתוח" card on the sign-in screen. The same name signs in as the same user.

The web build stores the refresh token in `localStorage` and is meant for development only.

### Resetting a test account (development only)

Resets ONE user so onboarding starts again from step 1. It deletes that user's fixed expenses,
variable budgets, transactions and sessions, and resets income, savings goal, financial cycle and
onboarding status. The user record and sign-in identity are kept. It refuses to run when
`NODE_ENV=production`, never touches other users, and changes nothing without `--execute`:

```bash
npm run dev:reset-user -w @credit-follow/api -- --email you@example.com              # dry run: shows what will be deleted
npm run dev:reset-user -w @credit-follow/api -- --email you@example.com --execute    # reset
# --user-id <id> instead of --email; --orphan-sessions also removes sessions of deleted users
```

Afterwards sign in again in the app (the old session is revoked).

## Deploying (API on Render + Android APK)

1. **API.** Push the repository to GitHub, then Render → **New → Blueprint** → select it. `render.yaml`
   builds the workspaces (`npm ci --include=dev && npm run build`) and runs `npm run start:api`
   with `NODE_ENV=production` (the development login is refused) and a generated `JWT_SECRET`.
   Enter `MONGODB_URI` and `GOOGLE_CLIENT_IDS` when asked. In MongoDB Atlas → **Network Access**,
   allow `0.0.0.0/0`: Render's free plan has no fixed outbound IP, so use a strong database
   password. Check `https://<service>.onrender.com/health`. The free plan sleeps when idle, so
   the first request after a pause can take up to about a minute.
2. **App.** In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL=https://<service>.onrender.com`. Then:

   ```powershell
   cd apps\mobile\android
   .\gradlew.bat app:assembleRelease     # → app\build\outputs\apk\release\app-release.apk
   ```

   Install with `adb install -r app\build\outputs\apk\release\app-release.apk`, or copy the file
   to the phone and open it (allow "Install unknown apps"). The release build is signed with the
   project's debug key, whose SHA-1 is already registered in Google Cloud, which is fine for
   personal installs. Google Play requires your own upload key (EAS Build), and its SHA-1 must
   be added as another Android OAuth client.

## Checks

```bash
npm run check          # format:check + lint + typecheck + test (all workspaces)
npx expo-doctor        # inside apps/mobile
```

Test suites:

- **`packages/shared`:** financial cycles (month-end clamping, leap years, Israeli DST, other time
  zones, cycle offsets), card charge dates and statuses, budget math, money parsing, schemas.
- **`services/api`:**
  - Auth:
    - Google: valid, wrong audience, wrong issuer, expired and forged tokens; verified-email
      linking.
    - Facebook: classic login with `appsecret_proof`, wrong app, Limited Login with nonce.
    - Sessions: token expiry, wrong secret, rotation, reuse detection, logout.
  - Full flows: onboarding (fixed + variable), fixed expenses (create, edit, archive, no double
    counting, legacy data), categories, transactions, exact dashboard totals, cycle settings,
    isolation between users, ignored client-supplied user IDs, account deletion, and the
    development reset (only the chosen user is affected).
  - These run against a real temporary `mongod` from `mongodb-memory-server`. It is started once
    per run, and its binary is cached in `node_modules/.cache` on install. This does **not** test
    your own `MONGODB_URI`. Use `/health` for that.

### Notes on tool versions

- TypeScript is pinned to `~6.0` (typescript-eslint does not support TypeScript 7 yet).
- ESLint is pinned to `^9` (eslint-config-expo's plugins do not support ESLint 10 yet).

## Known limitations / next steps

- Google and Facebook sign-in still need to be tested end to end with real OAuth apps on a
  development build.
- The mobile UI has not been tested on a physical device or simulator yet.
- Credit card status uses the deduction day only (no per-card billing cut-off). Only one card
  deduction day and one currency (ILS) are supported.
- Savings are tracked as a monthly goal (projected vs. goal). Multiple named savings goals are
  not implemented.
- Facebook's data deletion callback / instructions page is not implemented yet.
