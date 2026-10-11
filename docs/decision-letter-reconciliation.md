# Decision-letter reconciliation

Integrated main baseline: `3448ccb96b9b3a54f035a06a572379d10537e07c`; original reconciliation base: `c1c3952`. See the final integration section for current results. Original reconciliation: Preserved implementation reviewed: c917260 (backup/decision-letters-before-sync). Comparison completed before product edits. No wholesale cherry-pick, file deletion, or restoration of older general communications.

## Architecture decision

Current main remains authoritative for UserNotification (unique userId/eventKey), paginated inbox and aggregate unread badge, archive/read actions, UserNotificationPreference, ClubAnnouncement, retired direct-message exports (always denied), communicationsSnapshot/stream, NotificationEmailOutbox and NotificationEmailDelivery. The insert trigger queues every notification atomically. Existing Resend transport persists exact payloads and uses stable provider idempotency keys, bounded attempts and a 23-hour retry window; expired ambiguous receipts become UNCERTAIN. Existing SMTP invitation delivery is untouched. No parallel decision worker/route/cron is added.

The feature adds immutable structured DecisionLetter snapshots, Application.decisionVersion and private Club.decisionLetterTemplates. Application/ClubInvitation/ClubMember remain authoritative. Template editing uses recruitment.manage with transaction-time user/member/capability/suspension checks under the existing Club lock. Preview uses only fictional Alex Student. Text is bounded and escaped; five whitelisted variables, no executable templates/HTML.

New additive migration: `20261010190001_reconciled_decision_letters/migration.sql`. CLI scaffold was generated as 20261010185557; its destination prefix was normalized immediately after current main's 20261010190000 migration, before local deployment. The obsolete 20261010181822 migration is not restored. No Notification or decision-only delivery table is created. RLS, restrictive denial policy and browser privilege revocation protect DecisionLetter; a trigger prohibits update/delete. Existing announcements, preferences, inbox rows and queued intents are untouched.

Final publication increments a version and creates one letter/UserNotification in the canonical transaction; the existing insert trigger creates its outbox item. Current application trigger skips versioned finals to avoid a duplicate outcome-revealing generic update; unversioned historical and non-final producers remain. Recruitment-linked offers skip the generic invitation notice; ordinary invitations remain unchanged. Direct CRM and voting share publishRecruitmentDecision. Offer responses reuse canonical commands and unique offer/response event keys.

Decision emails use DECISION mapped to existing emailApplications and INSTANT/DAILY/OFF preferences. In-app letters/notifications are always available independently of optional email. Instant emails have an outcome-neutral club subject and validated canonical View Decision link. Daily digests retain their existing subject and include the same validated, outcome-neutral decision CTA. This intentionally adopts current-main preference policy instead of the old unconditional SMTP decision policy. Resend retries within its deduplication window use the exact same payload/key; SMTP ambiguous-send reconciliation remains unchanged in the invitation system.

Authenticated letter readers scope to the effective student owner, load narrow snapshots/current offer state, and return canonical notification IDs for existing read-state actions. A private asset proxy rechecks recipient ownership and club path before/after download; no privileged URLs or secrets reach clients. Historical/corrected/revoked/expired/declined letters remain readable without active controls. No backfill or reopening is introduced. Status links to available letters; older final records retain existing status/offer presentation.

Current inbox component/actions, stream route, announcement UI, preference controls and interview/collaboration files are retained. Demo letter rows use the current presentation mapper and persisted Demo read/archive arrays; live adapters are never called in Demo.

## All 41 files from c917260

| Old file | Classification | Reconciliation |
|---|---|---|
| `actions/applications.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `actions/communications.ts` | ADAPT | Append letter/template actions; retain current inbox, announcement and preference actions; preserve main’s denied retired conversation exports. |
| `app/api/decision-letter-assets/route.ts` | PORT | Port the unique letter capability with current-main integration preserved. |
| `app/api/internal/decision-delivery/route.ts` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `app/applications/[applicationId]/decision/page.tsx` | PORT | Port the unique letter capability with current-main integration preserved. |
| `components/applications/application-status-detail.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/club-workspace.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/communications/decision-letter.css` | PORT | Port the unique letter capability with current-main integration preserved. |
| `components/communications/decision-letter.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/communications/template-editor.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/live-voting/board-decision-mode.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/recruitment-review-settings.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `components/views/inbox-view.tsx` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `components/views/leader-dashboard/live-leader-workspace.tsx` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `docs/decision-communications.md` | ADAPT | Replaced by this reconciliation audit and current architecture documentation. |
| `lib/anonymous-review.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `lib/application-state.tsx` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `lib/data.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `lib/decision-email.ts` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `lib/decision-letters.ts` | PORT | Port the unique letter capability with current-main integration preserved. |
| `lib/demo/communications.ts` | ADAPT | Map fictional letter rows through current inboxNotification; canonical Demo read IDs. |
| `lib/demo/recruitment-offers.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `lib/demo/seed.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `lib/demo/store.ts` | ADAPT | Preserve current store/projections, add letter rows and historical snapshots. |
| `lib/notification-presentation.ts` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `lib/workspace-api.ts` | ADAPT | Add letter/template adapters and an adapter to canonical read-state action; no parallel readers. |
| `prisma/migrations/20261010181822_decision_communications/migration.sql` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `prisma/schema.prisma` | ADAPT | Add only DecisionLetter, Club template JSON and Application version; reuse UserNotification/outbox. |
| `tests/communications-e2e.test.cjs` | ADAPT | Keep current foundation scenarios; port older scenarios into separate decision-communications-e2e.test.cjs. |
| `tests/communications-native.test.cjs` | ADAPT | Adapt ownership/idempotency/history tests to canonical UserNotification and outbox; current worker integration owns delivery races. |
| `tests/decision-letters.test.cjs` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `tests/helpers/communications-native.cjs` | ADAPT | Reuse native authorization harness; remove old SMTP worker mock. |
| `tests/live-applicant-views.test.cjs` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `tests/personal-workspace.test.cjs` | ALREADY PRESENT | Keep current-main implementation. |
| `tests/recruitment-offers-native.test.cjs` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `tests/review-tools.test.cjs` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `utils/decision-communications.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `utils/decision-delivery.ts` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `utils/email.ts` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |
| `utils/recruitment-offers.ts` | ADAPT | Port the unique letter capability with current-main integration preserved. |
| `vercel.json` | OBSOLETE / DO NOT PORT | Keep current-main implementation. |

## Verification

Previously completed reconciliation validation on current main c1c3952 (not rerun wholesale during the final print review):

- Focused current communications, decision, recruitment/offer, voting, email and authorization tests: 56 passed, no failures.
- Native PostgreSQL communication/offer tests: 26 passed, no failures. Includes actual lock races, rollback, immutable history, revoked capabilities, expiry, ownership and canonical confirmation deduplication.
- Current-main real Auth/Next RSC/PostgreSQL/REST/stream/provider integration: 8 passed, no failures. All existing scenarios retained; the revocation fixture now preserves the required backup owner and clears inactive owner authority instead of violating current DB constraints.
- Decision real Auth/RSC/PostgreSQL/private Storage/shared provider integration: 1 passed, no failures. Verifies direct/voting retry, one letter/notification/outbox per version, private branding, ownership and independent authenticated-session read/history state. Resend HTTP intercepted locally; no hosted email delivery.
- Fresh and legacy migration checks: all 36 migrations, 66 tables enforcing RLS/browser CRUD denial. Separate populated current-main communications preservation test passed (announcements, read notifications, preferences, pending outbox unchanged).
- Full default suite: 986 tests; 972 passed, 14 environment-gated skips, no failures. Relevant native and communications integration suites were additionally run explicitly above.
- TypeScript, Prisma validate, production build and git diff --check passed. Lint passed with 0 errors and 30 warnings; warnings are not reported as clean lint.
- Real Chrome: template edit/preview/save, direct acceptance, voting publication, announcement publish to scoped applicants, shared inbox, preferences persisted after reload/independent page instance, announcement read persistence, acceptance/membership, Waitlist and Rejection rendered, no offer controls for non-offer decisions. Acceptance layout widths 390/640/768/1024/1440 had no horizontal overflow. Independent Auth client session additionally verified server-owned decision read state.
- Published wording remained unchanged after template edit. Revoked/expired/declined/historical/suspended controls covered by native and focused rendering tests.
- Invitation SMTP transport, interview/collaboration implementation, main inbox/stream and internal delivery route were preserved; regression suites passed.

Remaining P0/P1/P2/P3 product findings: none identified in the reviewed reconciliation. The rendered-print gap was closed by the browser-generated PDF verification below. A physical second device was not used; reload, independent page instance and separate authenticated client session establish server persistence.

All Auth/Postgres/Storage fixtures and provider simulations were local/disposable. No production/staging writes, hosted email calls, commits or pushes. Local fixture databases are retained for inspection. Temporary runner/proxy credentials are outside the repository and are not included in this batch.

## Final local rendered-print review — 2026-10-11

Branch `reconcile/decision-letters`, full HEAD `c1c3952d665132cf5130012470f1b5c3e41a4de6`. Reviewed the actual tracked diff and contents of all 16 untracked files. The 39-file manifest matches exactly: no missing, extra, unrelated or deleted files. This review changes only this report; no application, test, schema or migration fix was required.

### Rendering method and results

Interactive Chrome print preview was blank/uninspectable under the connected browser session, so it is **not** claimed verified. Used the explicitly permitted alternative: an isolated headless instance of installed **Chrome/154.0.8037.98**, Puppeteer `Page.printToPDF`, `emulateMediaType('print')`, CSS page size, print backgrounds, no browser headers/footers. It navigated the actual authenticated student routes with locally issued Supabase session cookies; no substitute HTML, auth mock, public logo URL or DOM content injection. Waited for the article, fonts and all private-logo images to load. External browser requests were blocked. Authentication cookies were held only in the isolated temporary profile/session, which was removed after verification.

| Case | Actual paginated output | Result |
|---|---|---|
| Acceptance | 1 A4 page | All wording, expiry date, private CF logo, signature and footer readable; actions absent. |
| Waitlist | 1 A4 page | Non-guarantee wording, private RS logo, signature and footer readable; no offer controls. |
| Rejection | 1 A4 page | Complete rejection wording, private AC logo, signature and footer readable; no offer controls. |
| Long custom Acceptance | 4 A4 pages | 22 numbered sections, 5,912 resolved body characters, a newline-containing `club.name` variable, multiline closing/signer/footer and private LP logo. All sections and final body/footer markers readable. |

Rendered **every page to PNG and visually inspected all seven pages**. No clipping, overlap, missing glyphs, unintended blank pages, truncated content or broken images. Long-letter page transitions occur between complete numbered paragraphs (04/05, 12/13, 20/21); signature remains together on page 4. Body and signature preserve multiline variable values; masthead/title use normal whitespace wrapping. Margins are consistent with CSS A4/18mm plus article padding (text starts approximately 22mm from the left; continuation text begins approximately 18.5mm from the top). Serif body and bold Georgia headings are readable; logo proportions and colors render correctly. Navigation, Print, Accept/Decline, response and membership controls are hidden. PDF text extraction, normalized only for whitespace, independently confirms every persisted content field appears completely; it is supplementary to visual inspection.

### Reproducible evidence

Local evidence directory: `/tmp/outclass-print-verification/` (outside the commit batch; retain/copy these artifacts before temporary-directory cleanup).

- `accepted.pdf`, `waitlisted.pdf`, `rejected.pdf`, `long-custom-acceptance.pdf`: original browser-generated paginated output.
- `<case>-page-<n>.png`: all seven inspected page renders; `<case>.txt`: extracted text.
- `cases.json`: exact fixture route IDs and expected immutable content; `render-evidence.json`: browser version, method, print-media state, loaded proxy logo dimensions and hidden-control assertions; `pdf-inspection.json`: page dimensions, content bounds, images/fonts, complete-content and absent-control checks.
- `prepare.cjs`: creates a new disposable long-letter club/application, saves the template/uploads private logo/publishes through authenticated canonical leader actions. Existing published letters are never updated. It reads local DB content only for fixture metadata; actual PDF content is loaded through the authenticated application route.
- `render.cjs`: rerender retained cases using the guarded existing local configuration; `pdf-qa.py`: rasterize and check text/page geometry; `verify-access.cjs`: independent ownership/private-logo/snapshot/idempotency assertions.
- `fixtures.log`, `render.log`, `access.log`, `focused.log`, `migrations.log`, `prisma.log`: this review's execution results.

To reproduce on this machine from the repository root, start the retained local `outclass_reconcile_rest` and `outclass_reconcile_storage` containers, then run `/tmp/reconcile-api.cjs` and `/tmp/reconcile-run.cjs start` in separate terminals. Run `node /tmp/outclass-print-verification/render.cjs`, then `/tmp/outclass-print-verification/venv/bin/python /tmp/outclass-print-verification/pdf-qa.py`. The scripts require the guarded local fixture configuration, installed Chrome and their isolated `/tmp` dependencies; they cannot target production/staging. `prepare.cjs` is only needed for a new long-letter fixture; `cases.json` already points to the retained records.

PDF SHA-256:

```text
05fb7121d7f30f14358dbea11d50bae8e9dc78eb281998038d411ca75b76dc84  accepted.pdf
252ca0e10ef67b6173e9ae18800b14990b98230ee91f05d2faeb61ab0166ea0c  waitlisted.pdf
c6e4a6ce9ec797c2fea5353255ea089c7500fb106c51029b619e9aa7e736ee6c  rejected.pdf
fec5000f2484b461597bf9edf4e8b06bb403daf9efd93194562c192283f33f3a  long-custom-acceptance.pdf
```

### Checks rerun in this review

- `node --test tests/decision-letters.test.cjs tests/decision-migration.test.cjs tests/communications.test.cjs`: **11 passed, 0 failed, 0 skipped**. Covers rendering/offer states, safe variables/XSS, Demo isolation, preferences, current communications and populated migration preservation.
- `npm run test:migrations`: passed fresh/legacy history, **36 migrations / 66 RLS-protected tables**, browser-role CRUD denial.
- `node /tmp/reconcile-run.cjs schema`: Prisma validate passed.
- Render and access scripts: all four authenticated routes rendered. Owner private assets returned 200; foreign letter readers returned null; foreign and anonymous assets returned 404. Persisted snapshots stayed unchanged, with exactly one letter per version and one associated canonical notification/outbox item after printing.
- Manifest comparison and `git diff --check`: passed.
- Full suite, native races, broader real integration, TypeScript, lint and production build are **previously reported results**, not rerun now: no product code changed and no new regression was found to justify repeating them.

Migration compatibility was reviewed against the authoritative schema and `20261010190000` communications migration. It is correctly ordered and transactional, adds only letter/template/version schema, retains canonical UserNotification/preferences/outbox tables and data, preserves existing notification insert/outbox trigger, and replaces only the application/invitation producers needed to avoid duplicate final/offer notices. Populated preservation and fresh/legacy RLS checks passed again. Main inbox, stream, shared delivery worker and invitation SMTP implementations remain unchanged. No migration was applied to production or staging.

No remaining P0/P1/P2/P3 product finding was identified. Verified Chrome PDF/A4 output is ready for commit review; other print engines, physical printers and user-selected scaling/header/footer settings were not tested. Interactive preview tooling remains a local limitation, not a substitute for or blocker to the inspected PDFs. No commit/push/merge/deployment was performed; temporary services were stopped and local fixtures retained.

## Historical pre-commit changed-file manifest (39 files)

Branch: `reconcile/decision-letters`; HEAD unchanged at `c1c3952`. 23 tracked files modified, 16 untracked files, zero staged files and no deletions.


```text
actions/applications.ts
actions/communications.ts
components/applications/application-status-detail.tsx
components/club-workspace.tsx
components/communications-preferences.tsx
components/live-voting/board-decision-mode.tsx
components/recruitment-review-settings.tsx
components/views/leader-dashboard/live-leader-workspace.tsx
lib/anonymous-review.ts
lib/communications-client.ts
lib/communications-policy.ts
lib/data.ts
lib/demo/recruitment-offers.ts
lib/demo/seed.ts
lib/demo/store.ts
lib/notification-email.ts
lib/workspace-api.ts
prisma/schema.prisma
tests/communications-e2e.test.cjs
tests/live-applicant-views.test.cjs
tests/recruitment-offers-native.test.cjs
tests/review-tools.test.cjs
utils/recruitment-offers.ts
app/api/decision-letter-assets/route.ts
app/applications/[applicationId]/decision/page.tsx
components/communications/decision-letter.css
components/communications/decision-letter.tsx
components/communications/template-editor.tsx
docs/decision-letter-reconciliation.md
lib/decision-letters.ts
lib/demo/communications.ts
prisma/migrations/20261010190001_reconciled_decision_letters/migration.sql
tests/communications-native.test.cjs
tests/decision-communications-e2e.test.cjs
tests/decision-letters.test.cjs
tests/decision-migration.test.cjs
tests/helpers/communications-native.cjs
tests/helpers/reconcile-local.cjs
utils/decision-communications.ts
```

## Integrated main and bounded runtime verification — 2026-10-11

Baseline verification: clean branch `reconcile/decision-letters`, HEAD `bfeee314e9303771de4cb956dbb253ad97c1eaa8`; fetched origin/main remained `3448ccb96b9b3a54f035a06a572379d10537e07c`. Merge base `c1c3952d665132cf5130012470f1b5c3e41a4de6`. Per authorization, ran `git merge --no-commit --no-ff origin/main`; merge is resolved, staged and **uncommitted**. HEAD and remote reconciliation commit remain unchanged. This section supersedes historical validation/manifest statements above.

### Resolution and semantic review

- `components/club-workspace.tsx`: main’s message section remains removed; formal-decision publication wording retained.
- `components/communications-preferences.tsx`: removed messaging switch; retained application updates and decisions label.
- `lib/communications-client.ts`: union of main’s expanded category map and DECISION/OFFER_RESPONSE, with existing fallback and decision/response CTAs.
- `lib/data.ts`: union of notification categories plus optional applicationId.
- `lib/notification-email.ts`: main’s branded announcement subject, “Read your updates” and automated footer; neutral instant decisions, strict canonical UUID destinations and neutral digest CTAs retained.
- `tests/communications-e2e.test.cjs`: retained main’s authoritative announcement/retired-messaging scenarios. Added guarded reconciliation-local config support; scope conversation assertions to this fixture’s clubs and quiesce retained disposable queue fixtures before running the global mocked worker. Decision integration remains separate.
- Clean overlap `actions/communications.ts`: main’s five retired exports still reject immediately before any Auth/database/email access; appended letter/template actions retain owner reads and transactional reauthorization. Announcement/preferences/inbox implementation agrees with main.
- Main’s interview authorization/shared-lock and polling changes, canonical inbox, stream, outbox, shared delivery worker, cron and deployment workflow are retained. Direct/voting producer, offer/membership commands, anonymous-review restrictions, Demo isolation and private-asset authorization retain the reviewed implementation. No duplicate models/workers or competing migration history were introduced.

### Bounded runtime repair

New migration: `prisma/migrations/20261011194930_decision_letter_runtime_access/migration.sql`, scaffolded with Supabase CLI then moved to the authoritative Prisma history. It follows `20261011002000_production_communications_runtime_access`. Existing SQL/history is unchanged. If the runtime role exists, only DecisionLetter ownership transfers to `outclass_production_app`; temporary schema CREATE permission is restored to its prior state in the same transaction. Without that role it is a no-op. No unrelated table ownership, browser grants, RLS policy, role attribute or immutable trigger changes are made by this migration.

PGlite regression paths: **4/4 passed** (three upgrade paths and absent-role no-op). Verify preserved announcements, notifications, preferences, queued intent and existing letters; owner/RLS/restrictive policy state; runtime read/write/outbox publication; immutable update denial; actual anon/authenticated SELECT/INSERT/UPDATE/DELETE denial; idempotent repair; NOSUPERUSER/NOBYPASSRLS and no public schema CREATE.

Real PostgreSQL/Prisma `migrate deploy` paths: **3/3 passed**, 38 migrations each:

1. Fresh complete history, populated records and second no-op deploy preserved.
2. Already-current-main history, populated communications, then pending older `20261010190001` followed by additive repair. Prisma successfully applies the pending older timestamp despite main’s later applied migration.
3. Original reconciliation history with populated immutable letter and communications, then current-main runtime migration and additive letter repair.

Each compares full row JSON for ClubAnnouncement, UserNotification, UserNotificationPreference and NotificationEmailOutbox, plus existing DecisionLetter where present; confirms migration count, runtime SELECT, RLS and absence of browser CRUD privileges. Database names and exact deploy output are in the local evidence logs. Failed initial harness attempts (snapshot ordering assumed every table has an id) were corrected; the reported three paths are the successful reruns.

### Actual bounded server and integration evidence

The dedicated `outclass_reconcile_test` fixture was configured to mirror existing server-owned tables and the retained local Storage server-ownership convention. Only this isolated database’s existing application tables and `storage.objects` were assigned to the test runtime role; Storage schema USAGE was granted and schema CREATE removed. This is fixture setup, **not additional shipped migration SQL** or evidence about live environment grants. The new migration itself changes only DecisionLetter. Isolated bootstrap used the local Supabase administrator because local `postgres` cannot transfer every owned table; no runtime superuser/BYPASSRLS grant was used.

The built Next server connects as `outclass_production_app`; queried `current_user`, `rolsuper=false`, `rolbypassrls=false`; public/storage schema CREATE and reverse operator membership are false, and reading `_prisma_migrations` is denied. Real authenticated HTTP direct/voting publication and retries succeed, confirming access through actual server paths. Private logo uploads/settings and private reads succeed with application authorization. Browser REST notification access denies; actual local PostgreSQL `SET ROLE anon` and `SET ROLE authenticated` attempts independently deny all eight letter CRUD operations (`browser-denial.log`), matching the PGlite checks. Foreign letter reads return null; foreign/anonymous private assets return 404; owner assets return 200.

### Checks rerun on the integrated tree

| Check | Result |
|---|---|
| Focused communications, decision, migration/runtime, anonymous, assets and offers | 38 passed, 0 failed/skipped |
| Native communication/offer transactions | 26 passed, 0 failed/skipped |
| Same decision-native suite using bounded runtime connection | 8 passed, 0 failed/skipped |
| Broader native recruitment authorization/locks/photos | 16 passed, 0 failed/skipped |
| Real Auth/Next announcement, inbox/preferences and mocked worker | 5 passed, 0 failed/skipped |
| Real Auth/Next direct/voting letters/private Storage/shared mocked provider | 1 passed, 0 failed/skipped |
| Private proxy/history checks on four retained print fixtures | All passed; owner 200, foreign/anonymous 404, immutable copy and one event/outbox preserved |
| Full default suite (final rerun) | 996 total: 982 passed, 14 gated skips, 0 failed |
| Migration security harness | All 38 migrations fresh/legacy; all 66 public tables RLS and browser CRUD denial |
| TypeScript and Prisma validation | Passed |
| Lint | 0 errors, 28 existing warnings |
| Production build | Passed, isolated local DB/Auth configuration, hosted delivery disabled |
| Authoritative migration-source guard; staged/unstaged diff checks | Passed |

Four suites skipped in the default run were explicitly exercised above (announcement HTTP, decision native, decision HTTP, offer native); native recruitment was also run separately. Remaining default gates: Admin session, broader Admin MFA/integration, full club-assets Admin/leader lifecycle, corkboard HTTP, interview collaboration native, interview transactions native, onboarding native, onboarding HTTP and built resume-import integration. These are **not counted as passes**. This task reran decision private Storage paths, not the entire pre-existing Admin/club-assets/onboarding fixture matrix. Providers are mocked/intercepted; no hosted email was sent. Prior rendered PDF verification remains historical evidence, not a newly repeated print run; letter markup/CSS were unchanged.

Remaining findings: no P0/P1/P2 product regression identified; P3 existing lint warnings. Local integration required isolated fixture ownership/bootstrap adjustments described above. Live schema drift is not inspected or claimed validated. The integrated diff is ready for commit review, with gated checks and print-engine limits explicitly retained. No original Admin ejection fix is claimed.

Evidence retained outside Git: `/tmp/outclass-integrated-verification/` contains full/focused/native/bounded-native/recruitment-native logs, real HTTP logs, private-access checks, Prisma/lint/types/build, migration security and real PostgreSQL deploy/path logs and guarded reproduction scripts. Runtime credentials remain only in private local files, never in manifests or repository artifacts. Prior PDFs remain `/tmp/outclass-print-verification/`. Temporary app/proxy and isolated REST/Storage services were stopped after validation; fixture databases and evidence retained. No commit, push, merge into main, deployment, production/staging access or mutation occurred.

### Exact final manifests

The resolved merge index differs from reconciliation HEAD in **58 files** (main imports plus integration fixes). All are staged, with zero unstaged/untracked/unmerged files. This is deliberately different from the original 39-file feature commit.

```text
.github/workflows/deploy.yml
actions/communications.ts
actions/interview-collaboration.ts
actions/interview-kits.ts
actions/interview-resumes.ts
app/api/interview-resumes/route.ts
components/club-announcements.tsx
components/club-messaging.tsx
components/club-workspace.tsx
components/communications-preferences.tsx
components/interview-resume-viewer.tsx
components/shell/product-shell.tsx
components/views/inbox-view.tsx
docs/announcement-verification/REPORT.md
docs/announcement-verification/announcement-email.html
docs/announcement-verification/checks/build.txt
docs/announcement-verification/checks/lint.txt
docs/announcement-verification/checks/migration-status.txt
docs/announcement-verification/checks/migration-tests.txt
docs/announcement-verification/checks/schema.txt
docs/announcement-verification/checks/tests.txt
docs/announcement-verification/checks/typecheck.txt
docs/announcement-verification/evidence.json
docs/announcement-verification/screenshots/email-mobile.jpg
docs/announcement-verification/screenshots/email-preferences.jpg
docs/announcement-verification/screenshots/notification-bell.jpg
docs/announcement-verification/screenshots/notification-desktop.jpg
docs/announcement-verification/screenshots/notification-mobile.jpg
docs/announcement-verification/screenshots/outlook-dark.jpg
docs/announcement-verification/screenshots/outlook-light.jpg
docs/announcement-verification/screenshots/published.jpg
docs/announcement-verification/screenshots/resend-delivered.jpg
docs/decision-letter-reconciliation.md
docs/interview-collaboration.md
docs/interview-release-handoff.md
docs/screenshots/collaboration-live-invitation.png
docs/screenshots/collaboration-live-restored-access.png
docs/screenshots/collaboration-live-revoked-access.png
lib/communications-client.ts
lib/data.ts
lib/notification-email.ts
lib/product-navigation.ts
prisma/migrations/20261011002000_production_communications_runtime_access/migration.sql
prisma/migrations/20261011194930_decision_letter_runtime_access/migration.sql
scripts/announcement-e2e-control.cjs
scripts/prepare-announcement-e2e.cjs
tests/communications-e2e.test.cjs
tests/communications-native.test.cjs
tests/communications.test.cjs
tests/decision-migration.test.cjs
tests/decision-runtime-migration.test.cjs
tests/helpers/announcement-e2e.cjs
tests/interview-collaboration-native.test.cjs
tests/production-communications-runtime-migration.test.cjs
tests/resume-viewer-ui.test.cjs
utils/interview-access.ts
utils/interview-collaboration.ts
vercel.json
```

Feature/integration diff against current `origin/main`: **42 files**:

```text
actions/applications.ts
actions/communications.ts
app/api/decision-letter-assets/route.ts
app/applications/[applicationId]/decision/page.tsx
components/applications/application-status-detail.tsx
components/club-workspace.tsx
components/communications-preferences.tsx
components/communications/decision-letter.css
components/communications/decision-letter.tsx
components/communications/template-editor.tsx
components/live-voting/board-decision-mode.tsx
components/recruitment-review-settings.tsx
components/views/leader-dashboard/live-leader-workspace.tsx
docs/decision-letter-reconciliation.md
lib/anonymous-review.ts
lib/communications-client.ts
lib/communications-policy.ts
lib/data.ts
lib/decision-letters.ts
lib/demo/communications.ts
lib/demo/recruitment-offers.ts
lib/demo/seed.ts
lib/demo/store.ts
lib/notification-email.ts
lib/workspace-api.ts
prisma/migrations/20261010190001_reconciled_decision_letters/migration.sql
prisma/migrations/20261011194930_decision_letter_runtime_access/migration.sql
prisma/schema.prisma
tests/communications-e2e.test.cjs
tests/communications-native.test.cjs
tests/communications.test.cjs
tests/decision-communications-e2e.test.cjs
tests/decision-letters.test.cjs
tests/decision-migration.test.cjs
tests/decision-runtime-migration.test.cjs
tests/helpers/communications-native.cjs
tests/helpers/reconcile-local.cjs
tests/live-applicant-views.test.cjs
tests/recruitment-offers-native.test.cjs
tests/review-tools.test.cjs
utils/decision-communications.ts
utils/recruitment-offers.ts
```
