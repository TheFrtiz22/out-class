# OutClass mobile build prompt (Fable 5.2, autonomous run)

Source of truth: the claude.ai project doc `claude/outclass-mobile-fable-prompt.md` (revised 2026-11-18).

You are building the OutClass native mobile app (iOS and Android) from start to finish in one autonomous run. **Do not stop, pause for approval, or ask the user anything.** The owner is not watching and wants the app as close to finished as possible, delivered with screenshots at the end. When you reach a decision, make the best choice supported by the repo and these instructions, record it in `docs/agent-ops/decision-log.md`, and keep going.

### What you may and may not touch

- **Your working folder.** You are in a separate clone at `.claude/worktrees/out-class-mobile`, inside the owner's main `out-class` folder. Work only inside this clone. Never read, edit or run anything in the parent folders (`../`, `../../`, `../../../`), especially the parent `.env`, which holds **production** keys. The clone has no `node_modules`, so run `pnpm install` first.
- **Staging is yours.** Supabase project `brrdatmhoagaxmggurki` (`outclass-staging`), whose credentials are in this clone's `.env`, is a disposable environment for this run. You may migrate it, seed it, reset its data, create test users, change its Auth settings through the APIs available to you, and send real push notifications to simulator/emulator test devices registered there. Before every write, check that the connection or URL contains `brrdatmhoagaxmggurki`. If anything points at `htlgjluegmdwfjkzzwic` (production), stop that step, log it, and continue with something else. If `.env` still contains `REPLACE_ME`, build everything that doesn't need the database, use a local Supabase stack (`supabase start`) for database work, and list "run the staging keys script" first in the owner queue.
- **Production is never yours.** That means no production migrations, deploys, Auth/Storage/DNS/env changes, real user data, real emails or pushes, merges to `main`, store submissions, or credential creation/rotation. Do not stop when you reach one. **Prepare it fully** (tested on staging, exact steps written), add it to `docs/mobile/OWNER_QUEUE.md`, and continue.
- If a hook or permission rule blocks a command, never rephrase it or work around it. Log it in the owner queue and take a path that doesn't need it.

### Mission

Turn OutClass's web product into a real native app that carries over the website's language, branding, theming and feel exactly, but is built entirely around how phones are used. This is not a redesign and not a web wrapper. A student who knows the website should feel at home immediately, and the app should feel smoother and more connected than the site: instant navigation, native gestures, haptics, sheets, push, the camera and the lock screen.

### Read first, in this order

1. `CLAUDE.md` and `AGENTS.md`. Their engineering rules apply. Where they say to ask the owner, follow this prompt instead: prepare the action, queue it, and continue. Start with the `outclass-session-start` skill.
2. `docs/CLAUDE_CODE_HANDOFF_2026-11-04.md`, `docs/agent-ops/README.md`, `docs/agent-ops/authz-matrix.md`, `docs/agent-ops/journey-matrix.md`, `docs/agent-ops/decision-log.md` (read every row; later rows and the "Recent decisions" section below supersede earlier ones).
3. `docs/database-deployment.md` (fresh-install procedure), `docs/qr-attendance.md`, `docs/service-worker.md` (installed app and Web Push), `docs/turnstile.md`, `docs/staging-security-rls-20261101.md`.
4. `styles/tokens.css` (including the `[data-theme="present"]` projector theme), `styles/typography.css`, `styles/navigation-glass.css`, `styles/interface-primitives.css`, `lib/spring.ts`, `components/icons`, `components/qr/outclass-qr-code`, `lib/qr`, `lib/short-links.ts`, `lib/short-link-store.ts`, `lib/web-push.ts`, `utils/notification-push.ts`, `actions/push-subscriptions.ts`, `lib/navigation.ts`, `public/brand/`.
5. The phone-width web experience (the five-tab student design). This is the visual and behavioural reference. Run the site locally against staging and screenshot every student screen at 390pt width before building anything.

Verify everything against current `main`. More than 400 commits landed between Nov 13 and 18, and older docs may describe replaced features.

### Recent decisions and changes (Nov 13–18) you must honour

- **Glass stays.** The owner decided on Nov 10 to keep the glass header and dock (FE-22 closed). That supersedes the Nov 5 decision-log row about "solid chrome".
- **Dark mode.** The website is light-only (Nov 8 decision). The app follows the system light/dark setting (owner decision). Derive the dark palette starting from the projector theme tokens (`[data-theme="present"]`), add dark values to the shared tokens **without changing the web's CSS output**, and mark the dark palette for owner review in the final report.
- **Motion:** `lib/spring.ts` (critically damped springs, a bounce variant only for thrown gestures, momentum `project()`, `rubberband()`) and the `.claude/skills/apple-design` skill define OutClass motion. Port those curves and physics to Reanimated rather than inventing new ones. Sheets dismiss by dragging. Confirmations use an in-app confirm sheet with the same wording as the web's `useConfirm`, never a bare system dialog for destructive actions.
- **Navigation:** the web rail now has Inbox and Settings pinned at the foot of every workspace, and a personal **Tasks** tab under Applications (PR #384). In the app, the five tabs stay (Home, Explore, Inbox, Calendar, Profile): Tasks and To-do live in Home, and Settings is reached from Profile.
- **Interviews and voting were rebuilt:**
  - The Interviews tab was rebuilt (#373), and the interview room was restyled with Libre Caslon names and a Source Sans countdown.
  - The voting room was redesigned (#395), with an open electorate, own-application privacy and alumni excluded from voting.
  - Alumni accounts are fully read-only (#394).
  - Voting setup was polished (#383). The "Below the threshold" default is still an open owner decision, so use whatever `main` does.
  - Mirror the current versions, not older docs.
- **QR:** the share sheet now offers a QR (#411), and club settings has a QR (#443). Reuse those paths.
- **Web Push already exists.** VAPID push via `web-push`, a `PushSubscription` table (migration `20261111090000_web_push_subscriptions`), the Inbox push toggle, and sending from the notification-delivery cron after email. Native push must be **another channel in this same delivery path**: same preferences, same toggle semantics, and dedupe per notification per device so nobody gets web and native pushes twice for one event. Don't build a parallel sender.
- **Multi-school is coming** (the owner plans it after this semester). `uva.out-class.net` is already attached in Vercel. Per-school subdomains are planned, `/q` short links stay on the apex domain, and the host is never a security boundary. The app must not hardcode UVA: the school comes from the signed-in user's server-side identity, the theme comes through the `[data-school]` token layer, and the API base URL is configurable.
- **Brand:**
  - The product UI uses the token palette. The logo files use their own navy/orange, so take app icons and logos from `public/brand/` and leave their colours alone.
  - The campus photos in `public/images/campus/` have **no license record** (one came from a third-party blog). Do not ship them in the app binary or in store screenshots. Use the line illustrations and brand assets, and queue photo licensing in the owner queue.
- **Known web issues** (site review backlog, Nov 16):
  - The web has mismatched counts between screens, visible test/synthetic content, developer wording, and an undecided Follow-vs-Save label.
  - The app must show the same **server-computed** counts (never re-count on the client), filter test content the same way the server does, and use the label `main` uses.
  - Log any web bug you find in the final report; don't fix web backlog items in this run unless the mobile API needs the shared fix.
- **Auth:**
  - Microsoft OAuth is off unless `NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH=true`, so check what production actually uses.
  - Production may enforce Turnstile on signup, sign-in and recovery (`docs/turnstile.md`). Native auth must work under that, for example with Turnstile in a WebView for email/password flows. Leave Turnstile off on staging, but build and test the code path with Cloudflare's published test keys.
- **Students give a phone number** (required for applicants, so clubs can call with offers). Notifications in this run are push and in-app only, no SMS (SMS is undecided).
- **CI and merging:** `main`'s "Local Auth, settings and navigation" job was failing as of Nov 16; record unrelated failures, don't chase them. The merge bot never merges PRs touching `package.json` or the lockfile, so leave every mobile PR as a draft and never add the `merge-when-green` label.

### Staging setup (do this first, after session start)

1. Bring staging to schema parity with the fresh-install procedure in `docs/database-deployment.md`: `prisma migrate deploy` (via `npm run db:deploy`) using `MIGRATION_DATABASE_URL`, then `supabase/task-submissions.sql`, then `prisma generate`. Never use `db push`, and never replay `supabase/archive`.
2. Verify with the Supabase Security Advisor, or equivalent catalog queries: no public table without RLS, a private resumes bucket with its restrictive guard, and the same browser-role denials as production's design.
3. Seed realistic **fictional** data with the existing seed and demo tooling, extended as needed:
   - UVA with about 40 clubs (including the five pilot-style commerce clubs, under fictional names).
   - About 300 students, with recruiting cycles at every stage, interview slots, a live vote, events with check-in, and inbox notifications.
   - Test accounts created through the Supabase admin API with confirmed emails: `student@staging.test`, `leader@staging.test`, `interviewer@staging.test`, `alumni@staging.test` and `admin@staging.test`. Put the passwords only in `docs/mobile/STAGING_ACCOUNTS.local.md`, gitignored.
4. Run the web app locally against staging (`OUTCLASS_SITE_URL=http://localhost:3000`). The simulators reach it at `http://localhost:3000` on iOS and `http://10.0.2.2:3000` on Android.
5. Optional hosted preview: push `mobile/staging`. If a Vercel tool is available, add **preview env vars scoped to the `mobile/staging` branch only**:
   - Public: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `OUTCLASS_DEMO_ENABLED=false`.
   - Secret (from `.env`): `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Never edit production or unscoped preview variables. If no Vercel tool is available, queue these steps for the owner.
6. Add a decision-log row: staging restored 2026-11-18 (owner approval in chat), reversing the 2026-11-09 decision, with the cost noted.

### Fixed decisions

- **Stack:** Expo (latest stable SDK; check current docs, don't assume versions) + React Native + TypeScript + Expo Router. App ID `net.outclass.app`, display name "OutClass".
- **Repo layout:** add `mobile/` (the Expo app) and `packages/shared/` (tokens, zod schemas, API types) as pnpm workspace packages beside the web app. Don't move the web app or change its build.
- **Tabs:** Home (includes To-do and Tasks), Explore (includes Corkboard), Inbox, Calendar, Profile. Light/dark follows the system.
- **Leader workspace:** stays mostly on the web. Mobile gets the focused leader tools below. Everything else is an "Open on web" handoff to the right page.
- **Search:** Postgres only, typo-tolerant, through the API. No Typesense.
- **Icons:** Phosphor (`phosphor-react-native`) under the same semantic names as `@/components/icons`. Never Lucide, never decorative icons.
- **QR:** reuse `lib/qr` encoding and the branded-code rules (monogram, high error correction), drawn with react-native-svg. No generic QR generators. Scanning uses the camera module.
- **Auth:** Supabase Auth with the providers production actually has enabled, using AuthSession/expo-web-browser with sessions in expo-secure-store; email/password on staging. Check current App Review Guideline 4.8: if a third-party login ships and isn't exempt, implement Sign in with Apple behind a flag and queue the Apple-side setup.

### Engineering non-negotiables

- **One source of truth for authorization.** The web's logic lives in server actions (`actions/*.ts`), which a native app can't call. Build a versioned mobile API (`app/api/mobile/v1/...`) that authenticates a Supabase bearer token server-side and runs the **same** identity, capability, ownership, revision and audit code paths as the actions. Never write a second copy of a permission check.
  - Choose either (a) an identity adapter the session helpers honour when an Authorization header is present, or (b) extracting action bodies into shared server functions, with the actions becoming thin wrappers.
  - Prefer whichever changes fewer existing web files, and document the choice in `docs/mobile/architecture.md`.
  - `middleware.*`, `lib/auth*` and `app/api/auth/` are owner-merge paths: keep changes there minimal and well tested.
- The web release must not regress. `pnpm run validate` must be green on every branch that touches web code, and the web's CSS output must stay identical (test it).
- The app ships only the Supabase URL and publishable key. Every private read and write goes through the mobile API.
- Leader-private data (notes, evaluations, ballots, resumes) is never written to disk on the device: memory only, cleared on sign-out and after a background timeout.
- Demo/preview data stays isolated from production, as on the web.
- The repo is public, so security weaknesses go in `docs/mobile/OWNER_QUEUE.md` under "private: move out of repo", with minimal detail, never in commits or PR text.
- Record each new dependency in the decision log after checking `outclass-reuse-first`.
- If an approach fails twice, switch to the next best, log the diagnosis, and continue. Never abandon the run over one blocked feature.

### Design carry-over (the most important quality bar)

- **Tokens:** `styles/tokens.css` values move into `packages/shared/tokens` as the single source, which generates both the web CSS (identical output, proven by a test) and the React Native theme. Keep `[data-school]` overrides, the single focus-ring colour with its halo, and the accessible small-text orange.
- **Typography:** Libre Caslon Text headings and Source Sans 3 body from `app/fonts`, via expo-font, with Dynamic Type and Android font scaling.
- **Glass:** the round glass header and dock become native blur (expo-blur; iOS 26 Liquid Glass where the SDK supports it), with solid fallbacks under Reduce Transparency.
- **Brand:** the monogram, the logos from `public/brand/` and the approved line illustrations. Licensed photography only. No stock clip-art, no template screens, no heavy italics, no decorative icons.
- **Copy:** reuse the web's exact wording, labels, empty states and errors.

### The native feel bar

- Native tabs and stacks, iOS swipe-back, Android predictive back.
- Bottom sheets that dismiss by dragging; swipe actions on lists; pull-to-refresh.
- TanStack Query with prefetching, optimistic updates with rollback, and skeletons that match the final layout. No full-screen spinners and no layout jumps.
- One haptics helper, used on confirmations, check-ins, votes, saves and errors.
- Reanimated motion using the `lib/spring.ts` physics, disabled under Reduce Motion.
- VoiceOver and TalkBack labels, 44pt targets, Dynamic Type up to accessibility sizes, contrast checked in both themes.
- Clear offline states; writes queue only where the server is idempotent.
- Measure cold start, Explore scrolling with 200+ clubs, and bundle size on simulator/emulator release builds, and record them (labelled as simulator figures) in `validation-report.md`.

### Scope

**Student: full parity with the phone-width website.** Discovery and search, club pages, follow/save, the reusable profile (required phone number, headshot, resume), applications (draft, autosave, submit, status), interview booking and rescheduling (Eastern display, 8 AM–9 PM bounds, same conflict checks), decisions and offer responses, inbox and notifications, calendar, events and meetings, live voting (as redesigned), tasks, settings, account deletion (Apple requires it), and the alumni read-only state.

**Leader: focused mobile tools.**
- **Check-in host mode:** full-screen branded rotating QR via `issueMeetingCheckIn`, with brightness boost, keep-awake, a live attendee counter, and one-tap close.
- **Door mode (in-app leader scanner):** the leader scans each student's personal check-in pass. This is a new attendance direction.
  - The pass is a short-lived, rotating, identity-bound token issued by the server, never a static ID.
  - Scans are authorized by `meetings.attendance` and record into `EventAttendance` under the same uniqueness rule.
  - Haptic and sound feedback for success, already checked in, and not eligible; fast continuous scanning for a 200-person line.
  - New migration: apply it on staging, test it, and queue it for production. Run the `outclass-authz-matrix` review.
- **Live voting host controls:** following the redesigned room (#395), with tallies only as permitted and a haptic tick per round.
- **Applicant glance:** read-only pipeline counts and applicant cards (with photos) for permitted leaders, with "Open on web" for full review.
- **Quick announce:** to an existing audience through the existing communications path, with a preview and confirm sheet. On staging it records to the outbox but doesn't deliver.
- **Interview day mode:** next-interviewee card, timer, and private notes through the existing interview-collaboration path, matching the rebuilt Interviews flow.

**Mobile-only, Tier 1:**
- **Universal scanner:** an entry point in the header and a long-press app-icon shortcut. It recognizes `/q/<code>` links. Check-in completes inside the app with the signed-in session, no browser hop. Club, voting-join and live-room codes open the matching screen. Other codes are politely rejected, and tokens are never logged.
- **Personal check-in pass:** full-screen with brightness boost, two taps from Home.
- **Native push:** a channel in the existing delivery path (see Web Push above). Native device tokens are stored via a new migration, applied on staging and queued for production. Real pushes go to the staging simulator/emulator devices, using Expo's development push credentials where possible; production APNs/FCM keys are queued.
- **Universal links and app links:** prepare `apple-app-site-association` and `assetlinks.json` in the web app, test them on the local server, and queue the production deploy.
- **Native calendar:** "Add to Calendar" for interviews and events, with Eastern times preserved.
- **Camera and files:** a headshot from camera or library with crop; resume upload from the document picker or Files, through the existing Storage paths and the private-bucket rules.
- **Share sheet:** for clubs and events, with the QR option, via the existing `createShortLink` rules.

**Tier 2 (only after Tier 1 works end to end; one branch each):** a home screen widget, Live Activities (interview countdown, live vote), biometric lock for leader tools, and Apple/Google Wallet passes (certificates queued).

**Out of scope on mobile:** recruitment configuration, the application builder, the scheduling editor and panel publication, CRM, roster import, CSV exports, platform admin, Outlook busy times. These get "Open on web" handoffs.

### Order of work (no pausing between steps; a task-ledger row for each)

0. Session start, `pnpm install`, then the staging setup above. Inventory every journey: map its actions and notifications, and mark its web status (implemented / partial / demo-only / unverified). Write `docs/mobile/architecture.md`, then run a timed Explore spike end to end against staging.
1. Mobile API, with cross-user, cross-school, alumni and revoked-member denial tests for every endpoint, plus revision-conflict and idempotency tests, and an authz-matrix review.
2. Shared tokens and types, with the identical-web-CSS test, the RN light and dark themes, fonts and icon mapping.
3. App shell: auth (including the Turnstile path), secure session, the five native tabs, theming, error boundary, Sentry wiring (DSN queued).
4. Student parity, every screen.
5. Mobile-only Tier 1.
6. Leader tools.
7. Hardening: accessibility pass, performance numbers, offline behaviour, and Maestro end-to-end flows on both simulators against staging (sign in, apply, book an interview, check in both directions, vote, receive a real push on staging).
8. Store readiness: icon, splash and adaptive icon from `public/brand/`; iOS privacy manifest; draft App Privacy and Play Data Safety answers from what the code actually collects; store listing copy in the web's voice; review notes and a staging-style reviewer account plan; `eas.json` profiles. All of it queued for the owner.
9. Tier 2, as time allows.

Work on `mobile/<slug>` branches (`git switch --no-track -c mobile/<slug> origin/main`), commit often, push branches and open **draft** PRs. Never touch `main`.

### Final deliverable: screenshots and report

1. **Screenshots** of every screen on the iOS Simulator (a current iPhone) and the Android emulator, in light and dark mode, using the seeded staging data. Include the key states: empty, skeleton, error, offline, a submitted application, a booked interview, check-in success (both directions), an active vote, a push banner, the scanner, the alumni read-only view, and the leader tools. Save to `docs/mobile/screenshots/<platform>/<theme>/NN-screen-name.png`, plus web-vs-app parity pairs for every student screen.
2. **`docs/mobile/screenshots/index.html`:** one self-contained page with every screenshot grouped by tab and flow, with captions, iOS and Android side by side, and the parity pairs.
3. **Screen recordings** (`xcrun simctl io booted recordVideo`) of apply-to-submit, scan-to-check-in, and a live vote.
4. **`docs/mobile/FINAL_REPORT.md`:**
   - A feature matrix (works end to end / partial / not reached).
   - Test counts with skips, and the simulator performance numbers.
   - Branches and PRs.
   - The dark palette for review.
   - Web bugs found.
   - The owner queue in priority order, with exact steps for each item.
   - Known gaps, each with its next step.
