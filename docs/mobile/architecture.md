# OutClass mobile architecture

Status: in progress (branch `mobile/foundation`). Written 2026-11-18.

## Shape

```
out-class/
  app/api/mobile/v1/[operation]/route.ts   the native app's HTTP boundary
  lib/mobile-api/operations.ts             allowlist: operation name -> existing action/loader
  lib/mobile-api/views.ts                  screen-shaped reads built from the web's own helpers
  utils/mobile-api.ts                      bearer auth, input bounds, refusal -> HTTP mapping
  utils/mobile-request.ts                  request context (AsyncLocalStorage)
  utils/auth.ts                            getSessionState: cookie session OR mobile bearer token
  packages/shared/                         tokens (single source for web CSS + RN theme), motion
  mobile/                                  Expo SDK 58 app (Expo Router, React Native 0.88)
```

## Authorization: one source of truth

Chosen option: **(a) an identity adapter**. `getSessionState()` in `utils/auth.ts` is the single place
every action, loader and page gets its identity from. It now has two entries that share one
verification function (`verifiedSessionState`): the cookie session (unchanged) and a bearer token
supplied by a mobile API request. Both run the same three checks: Supabase `getUser(token)`, a live
`auth.sessions` row for the token's session, and the second-factor rule.

Why (a) and not (b) extracting action bodies: (a) changed **one existing web file** (`utils/auth.ts`,
+26/-10) and no action. (b) would have touched every action file the app calls (about 20).

How the bearer path is selected: only `utils/mobile-api.ts` opens the mobile request context
(`runMobileRequest`), and only for a request to `app/api/mobile/v1`. Shared code never reads an
`Authorization` header, so a browser request cannot opt in. A mobile request that carries the Demo
Mode or support-session cookie is refused outright.

What the mobile API adds: nothing about permissions. Each operation in
`lib/mobile-api/operations.ts` names an existing Server Action or loader; identity, club capability,
ownership, alumni, revision and audit checks run inside that action exactly as for the web. Writes
(`POST`) get the same maintenance-mode refusal as Server Actions.

Wire format: `GET /api/mobile/v1/<operation>?input=<json>` for reads, `POST` with a JSON (or
multipart) body for writes. Success is `{ "data": ... }`; a refusal is
`{ "error": { "code", "message" } }` with the action's own message and an HTTP status
(401 signed out, 403 forbidden/alumni/revoked, 404, 409 conflict, 422 other refusals, 429, 503).

Not changed: `middleware.ts`, `lib/auth*`, `app/api/auth/`.

## Server-computed views

The web derives Home and Calendar in the browser from `getStudentDashboardData` using pure helpers
(`lib/student-home.ts`, `lib/student-calendar-data.ts`). `lib/mobile-api/views.ts` runs the same
loaders and helpers on the server (`home.view`, `calendar.view`), so the app shows the same items,
order and counts and never re-counts.

## App

- Auth: Supabase Auth (email + password, the provider staging and production use), session in the
  Keychain/Keystore via `expo-secure-store` (chunked). The app ships only the Supabase URL and
  publishable key; it never queries tables or Storage directly.
- Configuration: `mobile/app.config.ts` reads `EXPO_PUBLIC_*` or the git-ignored
  `mobile/config.local.json`. The API base URL is configurable; nothing hardcodes a school host.
- Data: TanStack Query over `src/lib/api.ts`; refusals are shown with the server's wording.
- Theme: `@outclass/shared/tokens` `resolveTheme(scheme, school)`; follows the system light/dark
  setting. Glass header and dock: Liquid Glass (`expo-glass-effect`) where available, blur
  (`expo-blur`) otherwise, solid under Reduce Transparency.
- Motion: `src/lib/motion.ts` (Reanimated springs from `@outclass/shared/motion`, a port of
  `lib/spring.ts`); off under Reduce Motion. Sheets drag to dismiss (`src/components/sheet.tsx`).
- Icons: `src/components/icons.ts`, generated from the web's `components/icons` (same semantic
  names, Phosphor).
- Private data: leader-private data stays in memory (`src/lib/private-memory.ts`, query scope
  `"leader"`), cleared on sign-out, account change and after 5 minutes in the background.

## Local development

1. `node scripts/staging/deploy-schema.cjs status` (fail-closed staging guard), `node scripts/staging/seed.cjs`.
2. Web: `pnpm exec next dev -p 3000` (this clone's `.env` points at staging).
3. App: copy `mobile/config.example.json` to `mobile/config.local.json`; `cd mobile && npx expo prebuild -p ios && (cd ios && pod install)`, build with Xcode or `xcodebuild`, then `npx expo start --dev-client`.
4. Flows: `node scripts/staging/maestro.cjs e2e/<flow>.yaml`.
