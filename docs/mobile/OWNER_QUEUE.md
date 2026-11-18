# Owner queue: mobile build

Everything here is prepared and waiting on the owner. Nothing in this list has been done to production.
Order is priority. Updated 2026-11-18.

## Blocked by a guard during the run (recorded, not worked around)

- `.claude/hooks/guard-bash.cjs` blocks any command that names a `.env` file, including a count of
  `REPLACE_ME` placeholders and writing `mobile/.env.local`. The run therefore never read this clone's
  `.env`. Staging was verified another way: `scripts/staging/guard.cjs` loads the file inside Node,
  exits unless every database and Supabase value names `brrdatmhoagaxmggurki` and nothing names
  production, and prints no value. The app's public configuration lives in `mobile/config.local.json`
  (git-ignored) instead of an `.env` file. **Please review `scripts/staging/guard.cjs` and
  `scripts/staging/deploy-schema.cjs`**: they are the documented gap in the hook (a script that opens
  the file itself), used here only to fail closed on the staging target.

## 1. Production database migrations (apply before any code that needs them deploys)

Three additive migrations, applied and tested on staging, rehearsed on PGlite in
`tests/check-in-pass.test.cjs` and `tests/native-push.test.cjs`:

| Migration | What it does |
| --- | --- |
| `20261118120000_meeting_check_in_pass` | New table `MeetingCheckInPass` (door mode). RLS on, browser roles revoked, runtime role SELECT/INSERT/DELETE |
| `20261118130000_native_push_subscriptions` | `WebPushSubscription.kind` and `.platform`; replaces two CHECK constraints so web rows keep today's rule and native rows are allowed |
| `20261118140000_native_push_platform_required` | Closes a NULL-platform gap in the previous one |

Steps: Actions → Database migrations → Run workflow with `ref` = the mobile branch and `dry_run` on;
confirm exactly these three are pending; run again with `dry_run` off and approve. The Vercel
`prebuild` schema check keeps the code from publishing ahead of the first two (it checks tables and
columns, not CHECK constraints, so it cannot see the third: apply all three together).

Rollback, in this order: delete `kind = 'EXPO'` rows (older code would try to send Web Push to
them), restore the two original CHECKs, drop the two columns, drop `MeetingCheckInPass`.

Not yet exercised on real PostgreSQL: the grant and policy branch for `outclass_production_app`
(staging has no such role; PGlite tests cover it). Run `node scripts/run-disposable-postgres.cjs
security` in CI, or check `pg_policies` for `MeetingCheckInPass` after applying.

## 2. Native push credentials (push works in the app; server-to-device delivery needs these)

1. Create an Expo account/organization and an EAS project for `net.outclass.app`; put its project ID
   in `mobile/app.config.ts` (`extra.eas.projectId`).
2. Apple Developer: an APNs auth key (.p8) for the app ID, uploaded with `eas credentials`.
3. Firebase: a project with an Android app `net.outclass.app`; upload the FCM v1 service account key
   with `eas credentials`, and add `google-services.json` to the EAS build.
4. Vercel production env: `NATIVE_PUSH_ENABLED=1`, and `EXPO_ACCESS_TOKEN` if "enhanced security" is
   turned on for the Expo project.

## 3. Apple and Google accounts, store listings

See `docs/mobile/store/` (listing copy, App Privacy and Data Safety drafts, review notes, reviewer
account plan). Needs: Apple Developer Program membership, App Store Connect app record for
`net.outclass.app`, Google Play Console app, signing through EAS (`mobile/eas.json`).

## 4. Universal links and app links

`/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` are routes in the web app
(`lib/app-links.ts`, `tests/app-links.test.cjs`). Each answers 404 until its identifier is set, so
nothing is published by accident. Set in Vercel production: `OUTCLASS_IOS_APP_ID`
(`<Apple Team ID>.net.outclass.app`) and `OUTCLASS_ANDROID_CERT_SHA256` (the Play app signing
certificate's SHA-256 fingerprint), deploy, then check with Apple's and Google's validators. Only
`/q/*` is claimed. Until then `/q/` links open the website, which still works.

## 5. Sentry

Create a Sentry project for the app (React Native) and set `EXPO_PUBLIC_SENTRY_DSN` in the EAS
environment. `mobile/src/lib/report.ts` is the single seam; adding `@sentry/react-native` is one
dependency (decision-log row needed).

## 6. Turnstile for native sign-in

If production enforces Turnstile on password sign-in (docs/turnstile.md stage 2), set
`EXPO_PUBLIC_TURNSTILE_SITE_KEY` to the production site key and add the WebView's page origin
(`www.out-class.net`) to the widget's hostnames. The code path is in
`mobile/src/components/turnstile.tsx`.

## 7. Licensing

`public/images/campus/` has no license record. The app ships none of these photos. Decide whether
to license or replace them before any store screenshot uses campus photography.

## 8. Decisions to confirm

- The dark palette (docs/mobile/FINAL_REPORT.md).
- Sign in with Apple: the app offers only OutClass's own email-and-password accounts (no
  third-party or social login), so App Review Guideline 4.8 does not require it. If Microsoft
  sign-in is turned on later (`NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH`), re-check 4.8 before adding it
  to the app.
- Test accounts use `@virginia.edu` addresses on staging (`student.staging@virginia.edu` …) because
  sign-in accepts only that domain; `@staging.test` is refused by the Auth trigger.

## private: move out of repo

(Security notes are kept out of this public repository. See the final report hand-off.)
