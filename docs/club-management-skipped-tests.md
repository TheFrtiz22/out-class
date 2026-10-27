# Skipped integration tests — club management UX verification

The full run passed 1,278 tests and skipped these 34 existing environment-gated top-level tests. Some contain additional child scenarios that also did not run. Every listed configuration/database environment variable was unset in the test shell. Tests did not fail and then get reclassified as skipped.

The passing browser tests use disposable local fixtures. They verify the redesigned interactions and exercise canonical scheduling/voting actions in isolation. They do not replace real authenticated Next.js → Supabase Auth → PostgreSQL/Storage/worker integration checks. Migration checks separately passed on fresh and legacy fixtures; that does not establish real database concurrency or live session behavior.

These omissions do not demonstrate a defect in the frontend changes, but leave a release-confidence gap. Before production rollout, run authenticated settings/navigation, announcements, invitations and scheduling/publication checks, plus the native PostgreSQL race/transaction checks against disposable infrastructure. Use the repository's guarded test configurations rather than pointing these tests at production data.

| Test file | Skipped coverage | Required configuration (alternatives where listed) |
| --- | --- | --- |
| [account-data-e2e.test.cjs](../tests/account-data-e2e.test.cjs) | real account HTTP and RSC keep internal templates behind recruiting permission across campuses and overlapping memberships | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [admin-session-e2e.test.cjs](../tests/admin-session-e2e.test.cjs) | real local Admin session survives elevation, navigation and refresh and rejects revoked authority | `OUTCLASS_ADMIN_SESSION_E2E_CONFIG` |
| [admin-workspace-e2e.test.cjs](../tests/admin-workspace-e2e.test.cjs) | disposable real Auth/password/MFA elevation, Admin routes/actions, invitations, reports, impersonation and logout | `OUTCLASS_ADMIN_E2E_CONFIG` |
| [availability-schedules-native.test.cjs](../tests/availability-schedules-native.test.cjs) | scheduled availability requests on actual bounded PostgreSQL | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [campus-event-discovery-browser.test.cjs](../tests/campus-event-discovery-browser.test.cjs) | Events: desktop/tablet/mobile views share filters, saves, RSVP, details and pagination; calendar downloads actual instants | `OUTCLASS_EVENTS_TEST_DATABASE_URL` |
| [campus-event-discovery.test.cjs](../tests/campus-event-discovery.test.cjs) | native Prisma: account-scoped idempotent saves, shared filtered pagination, publication restrictions and existing RSVP | `OUTCLASS_EVENTS_TEST_DATABASE_URL` |
| [club-assets-e2e.test.cjs](../tests/club-assets-e2e.test.cjs) | real local club assets: elevated Admin/leader writes, browser denial, assignment boundaries, suspension and authoritative replacement/removal | `OUTCLASS_CLUB_ASSETS_E2E_CONFIG` |
| [communication-schedules-e2e.test.cjs](../tests/communication-schedules-e2e.test.cjs) | scheduling through local Auth, production actions and authenticated cron | `OUTCLASS_SCHEDULING_E2E_CONFIG` |
| [communication-schedules-native.test.cjs](../tests/communication-schedules-native.test.cjs) | scheduled publication on bounded native PostgreSQL | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [communications-e2e.test.cjs](../tests/communications-e2e.test.cjs) | announcements over real Next HTTP, verified local Auth and PostgreSQL; provider delivery is mocked | `OUTCLASS_ANNOUNCEMENT_E2E_CONFIG` or `OUTCLASS_RECONCILE_E2E_CONFIG` |
| [communications-native.test.cjs](../tests/communications-native.test.cjs) | native decision communications: atomic snapshots, ownership, history, retries and outbox | `OUTCLASS_DECISION_RUNTIME_TEST_DATABASE_URL` or `OUTCLASS_RECRUITMENT_TEST_DATABASE_URL` |
| [corkboard-e2e.test.cjs](../tests/corkboard-e2e.test.cjs) | real local Auth + server actions + PostgreSQL + private Storage: moderation, revision replacement, privacy, RSVP concurrency and attendee authorization | `OUTCLASS_CORKBOARD_E2E_CONFIG` |
| [decision-communications-e2e.test.cjs](../tests/decision-communications-e2e.test.cjs) | real Auth, RSC, PostgreSQL, private Storage and shared email-provider decision lifecycle | `OUTCLASS_RECONCILE_E2E_CONFIG` |
| [decision-publication-e2e.test.cjs](../tests/decision-publication-e2e.test.cjs) | decision lifecycle through local Auth/Storage and production server actions | `OUTCLASS_DECISION_E2E_CONFIG` |
| [decision-publication-native.test.cjs](../tests/decision-publication-native.test.cjs) | decision controls, cycles and scheduled publication on bounded PostgreSQL | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [decision-transactions-native.test.cjs](../tests/decision-transactions-native.test.cjs) | decision/invitation transaction repair on isolated native PostgreSQL | `OUTCLASS_TRANSACTION_TEST_DATABASE_URL` |
| [event-storage-native.test.cjs](../tests/event-storage-native.test.cjs) | isolated native database + Supabase: authorized flyers, replacement/removal/cascade cleanup, public serving and all-day edits | `OUTCLASS_EVENT_STORAGE_TEST_CONFIG` |
| [interview-collaboration-native.test.cjs](../tests/interview-collaboration-native.test.cjs) | native collaboration: ordered simultaneous picks, revision conflicts, exact queue advancement, invitations and revocation | `OUTCLASS_SECURITY_TEST_DATABASE_URL` |
| [interview-native-concurrency.test.cjs](../tests/interview-native-concurrency.test.cjs) | native PostgreSQL interview transactions: independent drafts, simultaneous finish, annotations, revocation and immutable anonymous reopening | `OUTCLASS_SECURITY_TEST_DATABASE_URL` |
| [invitation-schedules-e2e.test.cjs](../tests/invitation-schedules-e2e.test.cjs) | scheduled invitation dispatch through local Auth and production actions | `OUTCLASS_INVITATION_SCHEDULE_E2E_CONFIG` |
| [invitation-schedules-native.test.cjs](../tests/invitation-schedules-native.test.cjs) | invitation scheduling and fair worker on actual bounded PostgreSQL | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [onboarding-concurrency.test.cjs](../tests/onboarding-concurrency.test.cjs) | native PostgreSQL: concurrent claims, duplicate imports, email delivery, and owner suspensions | `OUTCLASS_SECURITY_TEST_DATABASE_URL` |
| [onboarding-e2e.test.cjs](../tests/onboarding-e2e.test.cjs) | complete onboarding over real Next HTTP, Supabase Auth/MFA, PostgreSQL and captured SMTP | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [recipient-audiences-e2e.test.cjs](../tests/recipient-audiences-e2e.test.cjs) | recipient groups through real local Auth and production Next server actions | `OUTCLASS_AUDIENCE_E2E_CONFIG` |
| [recipient-audiences-native.test.cjs](../tests/recipient-audiences-native.test.cjs) | recipient audiences on bounded native PostgreSQL | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [recruitment-native.test.cjs](../tests/recruitment-native.test.cjs) | native recruitment authorization races, immutable round rename, feedback and narrow photos | `OUTCLASS_RECRUITMENT_TEST_DATABASE_URL` |
| [recruitment-offers-native.test.cjs](../tests/recruitment-offers-native.test.cjs) | native offers: publication, student authority, membership, retries and races | `OUTCLASS_RECRUITMENT_TEST_DATABASE_URL` |
| [resume-import-runtime.test.cjs](../tests/resume-import-runtime.test.cjs) | isolated built Next action loads PDF.js and its worker, returns proposals and structured failures | `OUTCLASS_STAGING_IMPORT_CONFIG` or `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [scheduler-polling-native.test.cjs](../tests/scheduler-polling-native.test.cjs) | real PostgreSQL voting polling versus scheduler progress | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [scheduler-release-native.test.cjs](../tests/scheduler-release-native.test.cjs) | release defects on actual bounded PostgreSQL/Prisma | `OUTCLASS_AUDIENCE_TEST_DATABASE_URL` |
| [session-revocation-e2e.test.cjs](../tests/session-revocation-e2e.test.cjs) | captured ordinary-session cookies cannot replay protected reads or profile writes after revocation | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [settings-navigation-e2e.test.cjs](../tests/settings-navigation-e2e.test.cjs) | settings and authenticated navigation across roles, saves, history and responsive layouts | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [signup-privacy-e2e.test.cjs](../tests/signup-privacy-e2e.test.cjs) | signup privacy on real Next, Auth, SMTP and desktop/mobile browsers | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
| [student-claim-e2e.test.cjs](../tests/student-claim-e2e.test.cjs) | student invitations claim and resend through the compatibility runtime without Auth token SQL | `OUTCLASS_ONBOARDING_E2E_CONFIG` |
