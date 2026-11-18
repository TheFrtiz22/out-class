# OutClass mobile: final report

Run date: 2026-11-18. Branch `mobile/foundation` (from `main` at `987dca4b`). Nothing was merged, deployed or applied to production. Staging project `outclass-staging` (`brrdatmhoagaxmggurki`) was the only database written to.

Screenshots: `docs/mobile/screenshots/index.html`. Owner actions: `docs/mobile/OWNER_QUEUE.md`.

## What exists now

- **A mobile API** in the web app (`app/api/mobile/v1`): a Supabase bearer token is verified with the same checks as a cookie session, then an allowlisted operation calls the existing Server Action, loader or media handler. It holds no permission logic of its own. 85 operations plus a private-media route.
- **A native app** (`mobile/`, Expo SDK 58, React Native 0.88, `net.outclass.app`) that builds and runs as a release build on the iOS Simulator and the Android emulator against staging.
- **Shared tokens** (`packages/shared`): one source that generates the web's `styles/tokens.css` byte for byte and the app's light and dark themes; a port of `lib/spring.ts` motion; the branded QR geometry.
- **Two new server features**, on staging only: door mode (a leader scans a student's personal pass) and native push as a channel of the existing push path. Three migrations are queued for production.

## Feature matrix

"End to end" means it was exercised on a simulator or emulator, in the app, against the staging API. "API verified" means the server path was exercised over HTTP but the screen was not driven through that action on a device.

### Student

| Feature | Status | Notes |
| --- | --- | --- |
| Sign in, secure session, sign out | End to end (iOS, Android) | Session survives relaunch and reinstall (Keychain). Email and password only |
| Turnstile on sign-in | Built, not exercised | Staging has Turnstile off; the WebView path needs the production site key and hostname (owner queue 6) |
| Home (next step, tasks, applications, clubs, coming up) | End to end | Server-derived with the web's own helpers (`home.view`) |
| Explore, search, category filters | End to end | Staging has 43 clubs; search filters locally because the server search returns at most 6 clubs |
| Club page, Follow / Following, Start or Continue application | End to end | |
| Saved clubs, swipe to remove | End to end | |
| Events board, RSVP, save, Add to Calendar | End to end | Club/date/location filters and the flyer "board" view not built |
| Share sheet with branded QR and short link | End to end | Same matrix and badge as `lib/qr` (`tests/shared-qr.test.cjs`) |
| Profile: view, edit sections, required phone | End to end | Phone validation message is the web's |
| Headshot from library with crop, upload, display | End to end (iOS) | Camera capture not exercised (no simulator camera) |
| Resume upload | API verified | Upload returned 200 by script and the resume opens in the app; the Files picker was not driven on device |
| Applications list by stage | End to end | Counts and labels from the server (`applications.view`) |
| Application draft, autosave, conflict handling, submit | End to end | Submitted a fresh application at Clemons Writers Workshop; conflict from a second client shown and reconciled |
| Interview booking, cancel, Add to Calendar | End to end | Eastern Time; reschedule-not-allowed and paused rounds not exercised |
| Decision letter | End to end | No Print |
| Offer accept / decline | Built, not exercised | Left pending on staging for screenshots. The confirm-sheet wording is new (the web has no confirm step) |
| Inbox: filters, read/unread, archive, mark all read | End to end | |
| Notification preferences | Built; save not exercised on device | |
| Calendar (Agenda, Month) | End to end | Week and Day views not ported |
| Meetings, club member view | End to end | The meeting screen cannot show "you are checked in": no operation returns the member's own attendance |
| Tasks: list, detail, mark viewed | End to end | Submit built, not exercised; task file upload is "Open on web" |
| Settings, account deletion request and cancel | End to end | Requested, saw the scheduled date, cancelled |
| Alumni read-only state | End to end | Banner on Inbox and Profile; server refusals verified in the live matrix |

### Phone-only (Tier 1)

| Feature | Status | Notes |
| --- | --- | --- |
| Scanner for `/q` codes, check-in inside the app | API verified; screen built | The simulator has no camera image. The check-in completes through `shortLinks.resolve` + `meetings.checkIn`; the result screen is reached by opening `/q/<code>` in the app |
| Personal check-in pass | End to end | Rotating code, brightness boost, keep-awake |
| Door mode (leader scans passes) | API verified end to end; scanner screen built | Issue, scan, spent pass and no double count pass in the live matrix. Camera scanning itself needs a real device |
| Native push | Partial | Registration, the server channel, dedupe and the banner are built. A real server-to-device push was **not** sent: that needs an EAS project and APNs/FCM credentials (owner queue 2). The banner in the screenshots is a simulator-delivered sample with the server's payload shape |
| Universal links / app links | Prepared | Routes answer 404 until identifiers are set (owner queue 4). In-app `/q/<code>` route works |
| Add to Calendar | End to end (iOS) | Interviews and events |
| Camera and files | Partial | Library and crop end to end; camera and Files picker need a device |
| Home-screen shortcuts (Scan, Check-in pass) | Built, not exercised | Added late; not triggered on a device |

### Leader tools

| Feature | Status | Notes |
| --- | --- | --- |
| Leader tools hub | End to end | Shown only for memberships with the matching permissions; the server authorizes every call |
| Check-in host mode | End to end | Rotating branded code, live count, close with confirm |
| Door mode | See above | |
| Live voting: host controls and voting | End to end, two actors | Start, open, close, confirm, advance, undo; ballot cast in the app. Not exercised: join gate states, held applicants, end voting, threshold rules. Finalize and corrections are "Open on web" |
| Applicant glance | End to end | Server round counts, server search, paged cards. Photos show initials on staging (no applicant has one) |
| Quick announce | Built; screen reached, publish not exercised | Recipient preview and confirm as on the web. Not published, so staging's outbox behaviour is unverified |
| Interview day | End to end | Next interviewee, countdown, private notes with revision conflict handling. Shared timer, questions and scores are "Open on web" |

### Not reached

Tier 2 (home screen widget, Live Activities, biometric lock, Wallet passes): not started. Sign in with Apple: not needed (no third-party login). Maestro flows on Android beyond sign-in. An accessibility audit with VoiceOver and TalkBack: labels, roles and 44 pt targets are in the code, but no screen-reader pass was run. Dynamic Type at accessibility sizes: not checked on device.

## Tests and gates

- **Web unit suite** (`pnpm run test`): 3,178 tests. First full run 3,064 pass, 29 fail, 83 skipped; all 29 traced and fixed or explained (details in `docs/agent-ops/validation-report.md`). After fixes the affected files pass (160 of 160) and three of four slow voting browser tests pass. **One still fails on this machine**: `tests/voting-room-live-sync.test.cjs` "a client-supplied viewedAt…", because this clone's `.env` supplies a fallback secret the test expects to be absent. No voting file is changed on the branch; it needs confirming in CI. **A final full run after the last fixes was not done**, so "the web suite is green" is not yet proven.
- **`pnpm run test:migrations`**: pass (101 migrations on fresh and legacy databases, every table enforces RLS).
- **`pnpm run lint`**: 0 errors, 17 warnings (not introduced here). **Root `tsc`**: clean. **`next build`**: succeeds. **Mobile `tsc`**: clean.
- **New tests**, all passing: shared tokens 11, shared QR 5, check-in pass 3, native push 5, app links 2.
- **Live authorization matrix** (`scripts/staging/api-authz.cjs`): 82 checks, 0 failed, against the production build on staging.
- **Reviewers**: migration reviewer 1 blocker and 1 should-fix; authorization reviewer 0 blockers and 4 should-fix. All fixed.
- **Web CSS**: unchanged (`git diff origin/main -- styles/tokens.css` is empty).
- **Skipped**: 83, the suites that are gated on a native database, a browser or Storage, as on `main`.

## Performance (simulator and emulator figures, not device figures)

| Measure | Result |
| --- | --- |
| Android cold start to first frame (`am start -W`, release, Pixel 9 emulator, 5 launches) | 728 to 1,178 ms, median 879 ms |
| iOS cold start | Not measured (no reliable first-frame timer was set up) |
| Explore scrolling with 200+ clubs | Not measured: staging has 43 clubs. The list is virtualized with fixed keys |
| iOS release app size (simulator, arm64) | 62 MB; JavaScript bundle 6.4 MB |
| Android release APK (arm64 only) | 46.7 MB; JavaScript bundle 5.3 MB |
| API `explore.directory`, local server on the staging database | 179 ms warm (dev server, early in the run); 1.6 s on a later run with the machine under heavy load |

These were taken on a machine also running builds, so treat them as rough.

## Branches and pull requests

- Branch `mobile/foundation`, 16 commits, about 455 files and 25,600 added lines (most are the app, the web reference screenshots and the lockfile).
- **No pull request was opened and the branch was not pushed** (see "What I did not do").
- Suggested split when it is: API and adapter; shared tokens; migrations and door mode; native push; the app.

## Dark palette for review

Starts from the projector theme. Lives in `packages/shared/src/tokens/tokens.json` under `dark`; not emitted to the web.

| Role | Value |
| --- | --- |
| Canvas / card | `#0f1c2b` / `#162638` |
| Text / muted text | `#f6f5f1` / `#b0c1cc` |
| Primary (buttons) and its text | `#f6f5f1` on `#232d4b` text |
| Secondary, accent / muted surface | `#22364b` / `#1d3045` |
| Brand tint / brand text | `#3a2618` / `#f3a274` |
| Destructive | `#e4838e` (the projector's `#e07a86` is 4.30:1 on the secondary surface) |
| Success / warning / info / interview | `#7fc6a0` / `#e8c36f` / `#8ab8e0` / `#bba7d6` |
| Border / input / focus ring | `#2c4257` / `#5d7286` / `#c86400` |
| Tinted surfaces (blue, sage, lilac, warm) | `#1b2f44` / `#1b3132` / `#272c47` / `#2f2a26` |

Lowest contrast found: text 4.68:1 (destructive on secondary), focus ring 3.11:1. The header and dock use system glass with a light wash of the card colour for legibility.

## Web bugs found (not fixed)

1. The invitation check errors in normal use on My Clubs and in the bell popover.
2. An alumni's "Open club workspace" leads to "Could not load this workspace".
3. Application-card monograms render as full-width grey bars at phone width.
4. Controls clipped with no scroll hint: Decisions tab, Sat/Sun in Availability, interest chips, Edit-profile tabs.
5. Counts disagree: Home says "2 interview invitations" with one already booked, and the pending offer is missing from Home.
6. A current member sees "Start application" on their own club's page.
7. "Review offer" opens a detail with no offer controls.
8. Select-all questions show the help text "Enter your response."
9. The QR monogram sits slightly off-centre (`transform-origin: center` resolves against the SVG viewport in `lib/qr/renderer.ts`).
10. `tests/voting-room-theme.test.cjs` is cited in `styles/tokens.css` but does not exist; `--oc-spring-quick` says 355 ms where the formula gives 353.
11. A migration (`20260924000000_club_claims`) inserts three real-named unclaimed clubs, which appear in Explore on a fresh install.

## Known gaps, each with its next step

| Gap | Next step |
| --- | --- |
| No real push delivered server to device | Owner queue 2, then register a device and run the delivery cron on staging |
| Camera paths (scanner, door mode, photo capture) unproven | Install a build on a real iPhone and Android phone; scan a room code and a pass |
| A final full web test run after the last fixes | Run `pnpm run validate` on an idle machine or in CI |
| Push rows are removed only by the app at sign-out | Remove a device's row when its session ends, or skip at send time (authorization review note) |
| Domain refusals that return 200 with `ok: false` (RSVP, voting, start application) | The app checks them today; consider a uniform refusal status in the API |
| Untested authorization cells | Cross-school, not-eligible door answer, anonymous-review name withholding, concurrent scans on PostgreSQL, maintenance mode on a mobile write (listed in `docs/agent-ops/authz-matrix.md`) |
| Occasional "couldn't confirm your sign-in" (503) seen twice on Home | A log line now names the cause (`mobile.auth.unavailable`); Home keeps showing its data. Not root-caused |
| Explore at 200+ clubs, iOS cold start, accessibility pass, large Dynamic Type | Seed more clubs and measure; run VoiceOver and TalkBack |
| Pure form rules ported into the app (`components/applications/rules.ts`) | Move them into `packages/shared` and import them from the web form |
| Copy invented where the web had none | Offer confirm sheet, calendar notes, alumni banner, scanner and door-mode messages: review the wording |
| Mobile branch adds all app dependencies to the web's install | Check Vercel build time before merging; the merge bot will not merge it (by design) |

## What I did not do

- **Did not push the branch or open a draft PR.** Push is behind an approval rule in this repo, and the run was told not to work around guards. Run `git push -u origin mobile/foundation` and open a draft PR; never add `merge-when-green`.
- **Did not read this clone's `.env`** (the guard hook blocks it). Staging was asserted by `scripts/staging/guard.cjs` instead; please review that script.
- **Did not set Vercel preview variables** or deploy a hosted preview.
- **Did not touch production**: no migration, deploy, Auth, Storage, DNS or email change.

## State left on staging

Seeded data plus: a submitted application at Clemons Writers Workshop; the student checked in to the live meeting; a headshot and resume on the student and a resume on the interviewer; the student's notifications marked read and one archived; the voting session open on applicant 3 of 8 with two decided; one interviewer note. Test accounts are in `docs/mobile/STAGING_ACCOUNTS.local.md` (git-ignored).
