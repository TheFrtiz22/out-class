# OutClass settings, recruiting, and performance cleanup

Date: October 5, 2026. Changes are implemented in the repository. No production database migration, deployment, or invitation send was performed.

## Phase 1: architecture audit and implementation plan

| Area | Existing architecture and findings |
| --- | --- |
| Routes | `/` hosts the student shell through `workspace`, `view`, and `section` query parameters. `/club/[clubId]/workspace` hosts club overview, members, meetings, tasks, recruiting, and settings. Public profiles use `/club/[clubId]`; invitation acceptance uses `/invitations/[id]` and `/settings/organizations`; rooms use `/interviews/book`. |
| Database | Supabase Postgres is accessed by Prisma on the server. `prisma/migrations` is the sole active application-schema history. The Supabase remote snapshot is archived, not replayed. |
| Recruiting configuration | `ApplicationQuestion`, `ApplicationAnswer`, `PipelineRound`, and `Application.roundId` already exist. Initial application and pipeline builder components used sample browser state. Production question configuration was absent; production round settings exposed privacy, not round creation. |
| Interviews and voting | Kits are already stored on `PipelineRound.interviewKit`, with versioned `InterviewRecord` snapshots. Rooms, bookings, and voting sessions already reference round IDs. Reuse these relationships. |
| Authorization | Active, enabled memberships authorize operations by stored capabilities. Local roles are `OWNER`, `ADMIN`, `RECRUITING_ADMIN`, `INTERVIEWER`, and `MEMBER`; legacy titles and global user roles do not grant access. Owners have inherent capabilities. Database triggers also protect the sole active owner. |
| RLS | Application tables have RLS enabled and browser grants revoked. Critical onboarding tables additionally have restrictive server-only policies. Prisma server guards remain necessary because the configured server connection is trusted. |
| Members and invitations | `ClubMember`, `ClubInvitation`, `SchoolIdentity`, `RosterImport`, `RosterImportRow`, and `InvitationDelivery` already support school-bound invitations, resumable imports, delivery state, idempotency, and audit history. No replacement tables are needed. |
| Email | The implementation uses Nodemailer and the existing server-only SMTP configuration, potentially including Resend SMTP. There is no existing Resend HTTP batch client. Preserve the transport and durable outbox. |
| Discovery | Discover and Categories share `ExploreView` but appear as separate navigation destinations, with slightly different headers and content. Consolidate their navigation and URL aliases. |

The implementation order was settings shell and additive model changes; persisted application and round builders; protected bulk member controls; discovery/profile cleanup; query, navigation, import, and delivery optimizations; validation.

A read-only live catalog audit was attempted, but the configured database connection could not initialize in this environment. Schema/FK/index/RLS validation therefore uses the committed migration stack and isolated PostgreSQL-compatible PGlite databases. No claim of remote schema reconciliation is made.

## Product behavior

- Settings now has General, Application, Recruiting Pipeline, Interview Setup, Members & Permissions, Notifications, and Advanced sections. Navigation follows the actor's capabilities. Smaller screens use a scrolling section bar.
- General reuses the existing profile editor, including logos, descriptions, links, contact information, and marketing visibility controls. Directory listing visibility is persisted separately.
- Application supports adding, editing, removing, reordering, required/optional fields, written responses, PDF/document references, real multiple-choice options, a deadline, open/closed state, and student preview. The student form and preview share `QuestionField`.
- Students use the same persisted configuration. Closed/deadline-expired applications cannot be started or submitted; existing drafts can still be saved. Scores and profile information remain in the shared student profile.
- Removing a question with answers archives it. Previously submitted answers remain visible. Legacy multiple-choice questions with prompt-defined choices can remain unchanged; new questions require defined options. Changing the type or choices of an answered question requires a replacement question.
- Recruiting Pipeline supports creation, names, the seven requested types, order, instructions, and interview duration. The first active round is Application Review. Students start in the first active configured round.
- Removal is blocked while a round contains active/draft/waitlisted applications, open rooms, or unfinished voting sessions. Empty unused rounds are deleted; rounds with completed history are archived. History-dependent types are protected. Unambiguous evaluation labels follow round renames while retaining IDs, scores, notes, and dates. Ambiguous historical labels remain preserved, and labels in use cannot be reassigned to a different round. Review writes serialize with pipeline/privacy changes.
- Interview Setup reuses existing round kits, questions, guidance, scoring, rooms, and panels. Round instructions appear in interviews, and round duration initializes new booking rooms.
- Members has per-row selection, page select-all, selection across pages, a bulk toolbar, role defaults, granular permission replacement, bulk removal, resend/revoke, compact invitation menus, copy links, and a member details drawer. Bulk mutations are atomic, scoped to the club, capped at 100, checked against current membership versions, and audited. Last-owner and privilege protections cover the entire selection.
- Role and bulk permission changes and applicant status changes show optimistic feedback and roll back on rejection. Round moves still refresh the server privacy projection.
- Discover and Categories resolve to one experience. Categories filter the existing page through `category`, e.g. `/?workspace=student&view=explore&category=Consulting`. Old bookmarks canonicalize without losing other parameters.
- Unclaimed profiles have a compact badge, intentional claim action, and secondary source details behind an info control.
- Notification preferences can disable invitation delivery. Sending remains explicit. Application review/decision changes do not invent an automatic email system.
- Demo remains isolated from live actions. Live configuration editors clearly require exiting Demo Mode; existing fictional recruiting and interview workflows continue using their existing adapters.

## Database changes

Migration: `prisma/migrations/20261005000000_club_settings/migration.sql`.

| Existing model | Additions |
| --- | --- |
| `Club` | `applicationOpen` (default true), `applicationDeadline`, `applicationVersion`, `pipelineVersion`, `isDiscoverable` (default true), `invitationEmailEnabled` (default true) |
| `ApplicationQuestion` | `order`, `options` text array, `archivedAt` |
| `PipelineRound` | `type`, `configuration` JSON object, `archivedAt`; allowed-type and JSON-object checks |
| Stored capabilities | `application.manage`, backfilled for existing recruitment managers; immutable invitation snapshots remain unchanged |

Existing IDs, answers, memberships, rounds, kits, and invitation records are retained. Disabled/inactive owners keep their stored grants and regain inherent owner capabilities when reactivated. Existing pending invitations retain their approved permission snapshots; new invitations use updated role defaults. An owner can apply the new role default or grant application management after an older invitation is accepted. Existing question order is backfilled from the prior deterministic ID order. Round types are inferred conservatively from existing dependencies. No table is replaced, no application data is reset, and RLS is not disabled.

Six useful indexes were added: active question ordering; active round ordering; club/status/round application filtering; `lower(User.email)` lookup; club/status/member join order; club/status/invitation creation order. The existing sender/time delivery index is reused. Ordinary indexes are represented in Prisma; the expression index remains SQL-defined.

ApplicationQuestion and PipelineRound receive additional restrictive server-only RLS policies. Existing grants and policies remain intact.

Schema rollback: retain additive columns and archived history when rolling back code. Destructive down SQL is intentionally omitted because dropping choices/archive metadata could destroy new configuration and historical context. An older application ignores new close/visibility/notification preferences, so a rollback needs coordinated operational review. Backup/reconciliation procedures remain in `docs/database-deployment.md`.

## Routes and components

Existing route paths are retained. Club settings uses `?section=settings&setting=general|application|pipeline|interviews|members|notifications|advanced`.

Main implementation files:

- `components/club-settings-workspace.tsx`, `components/clubs/club-settings.css`, and the legacy `components/club-workspace-settings.tsx` entry.
- Existing `application-builder-view.tsx` and `interview-pipeline-builder-view.tsx` are replaced with persisted editors; `actions/club-settings.ts` and `lib/club-settings.ts` provide validation and persistence.
- `components/applications/question-field.tsx`, the student application form, and `actions/applications.ts` share choices, order, availability, and validation.
- `components/organization-member-management.tsx` and `actions/organization-members.ts` provide the bulk manager.
- `components/app-shell.tsx`, `components/club-workspace.tsx`, product/student navigation, Explore, public profiles, and `unclaimed-profile-notice.tsx` handle navigation and discovery cleanup.
- Interview kit/session/room consumers, recruiting rules, voting, search, student timelines, and CRM queries use active persisted rounds.
- Invitation actions, the existing delivery worker/API, `utils/invitation-background.ts`, `utils/email.ts`, and `vercel.json` handle delivery.

## Measurable bottlenecks and fixes

| Bottleneck | Change and evidence |
| --- | --- |
| Workspace eager assets | Large applicant, interview, task, member, and settings tools are deferred. Workspace manifest assets, including CSS, fell from 1,522,766 to approximately 1,232,554 uncompressed bytes: about 19.1%. This is asset size, not a network-latency benchmark. |
| Student tab server waterfalls | Already-open student navigation updates native browser history and client state. It no longer reruns homepage authentication, profile, and complete dashboard queries on every tab. Auth/initial entry still use normal server navigation. A regression test verifies no router server navigation for these transitions. |
| Club/settings tab reloads | Club overview fetching no longer depends on the current section. Membership changes still invalidate it. Loaded clean settings panels remain mounted, and settings section changes use URL-synchronized client navigation. Confirmed discard unmounts an unsaved editor; pipeline saves invalidate the retained interview setup. |
| Serial dashboard queries | Student applications, attendance, and accessible meetings are fetched together. Existing parallel club overview queries remain parallel. |
| Repeated auth writes | `requireAuth` reads an existing unchanged account instead of upserting it for every guarded request. Disabled accounts and verified-email checks remain enforced. |
| Public directory refetches | Only the public allowlist projection is cached for 60 seconds, with mutation invalidation tags. Personal applications, permissions, members, and private data are not placed in the shared cache. |
| Large round payloads | Round list/pipeline configuration reads select the fields they consume rather than duplicating kit JSON. Applicant kit editing is moved to Settings/Interview Setup. |
| Member reads holding locks | Read-only member-directory access no longer takes the exclusive organization lock used by writes. Independent reads are grouped. Identity refreshes happen when the actor's own membership changes. |
| CSV row loops | A normal 50-row ready batch previously needed roughly 350 row-work statements (seven per row, excluding shared setup). Its bulk path now needs eight row-work statements, plus two when expired invitations need updating/auditing. Classification uses maps/sets. Constraint failures alone fall back to isolated per-row handling. Existing rollback, partial-failure, duplicate, race, and retry tests pass. |
| Case-insensitive email lookup | The actual lookup now uses `lower(email) = ANY(...)`. EXPLAIN ANALYZE on 15,000 synthetic identities selected `User_email_lower_idx`, read three shared buffers, and returned one match. Local execution was sub-millisecond; this does not measure production Supabase latency. |
| Invitation queue N+1 | Roster and bulk resend requests validate the selection once, inspect delivery history/quotas in bulk, and create outbox entries in one write. |
| Email blocking UI/DB | Queue records commit before background work is scheduled with Next `after()`. UI requests do not drain SMTP. SMTP executes outside database transactions/club locks. Delivery is claimed durably, with at most three provider sends concurrently, bounded worker time, and retained queued work. |
| Applicant status refetch | Optimistic status updates avoid reloading the complete pipeline after a status-only mutation; expected-status checks and rollback remain in place. Privacy-changing round moves still reload. |

Delivery retains QUEUED, SENDING, SENT, FAILED, and CANCELLED states, cooldowns, quotas, current inviter authority checks, and idempotency. Failed mail does not roll back an import. Explicit resend retries rejected deliveries after the cooldown. Ambiguous delivery/commit failures stay protected from automatic duplicate sends and are labeled for review. Revocation cancels queued work; an email already claimed/in flight may arrive, but accepting an invitation always checks live authority/status.

## Remaining performance limits

- Applicant CRM still loads the club's full submitted application projection for client filters and drawers. Very large recruiting pools would benefit from server pagination and lazy detail reads.
- Member management uses client pagination over a scoped directory, including invitation history. Very large rosters would benefit from server search/pagination.
- The existing shared demo/data adapter contributes substantial client code. Further splitting needs a separate careful demo-boundary refactor.
- Cold data loads, authentication verification, database/network latency, and provider delivery times remain. There is no measured production guarantee of less than 300 ms.
- SMTP cannot prove whether a timed-out send was accepted; those deliveries require provider review rather than an unsafe automatic resend.

## Validation and rollout

- `npm run validate`: full test suite, migration replay/authorization checks, lint, typecheck, and production build.
- Current suite: 601 tests, 598 passing, zero failures, three environment-gated tests skipped. New tests cover editor interactions, choices, deadlines, archive safety, stale writes, bulk owner protection, delivery uncertainty, and navigation behavior.
- The full 23-migration stack passes on fresh and legacy isolated databases; all 43 tables retain RLS and browser CRUD denial. Additional tests challenge new restrictive policies with permissive policies/browser grants and run the indexed EXPLAIN query.
- Lint has zero errors and 28 existing warnings. Typecheck and production build pass. `git diff --check` and `npm run db:check-path` pass.
- Existing lockfile dependencies were restored. That fixed the three original PDF-worker failures caused by missing `pdfjs-dist`; no dependency version/lockfile changes were introduced.
- Browser visual QA used real application-editor components with fictional SSR fixture data at desktop, 768 px tablet, and 390 px mobile widths. Mobile content width equaled viewport width; only settings navigation scrolls horizontally. Runtime persistence and rejection behavior were verified separately in component/action/database tests. No live invitation was sent.

Deployment steps:

1. Follow the existing database reconciliation/backup procedure. On an aligned staging/production installation, apply the new migration with `npm run db:deploy`; regenerate Prisma Client and deploy the application after schema application. Do not reset, use `db push`, or replay archived Supabase history.
2. Preserve/configure the existing server SMTP values: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and `OUTCLASS_SITE_URL`. Email configuration is not available in the local environment; production configuration was not inspected or changed.
3. Set `CRON_SECRET` on the deployment. The existing protected delivery endpoint supports GET and POST. `vercel.json` schedules it every minute. Minute schedules require Vercel Pro/Enterprise; Hobby deployments reject them. For Hobby, use an authenticated external scheduler for this endpoint and remove the minute entry before deploying, or use a supported plan. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
4. Smoke-test a small club through application creation/submission, new round scheduling, a role/permission change, owner protection, and one explicitly requested invitation email. Inspect actual delivery state and cold/repeated navigation metrics in the deployed environment.

No production schema changes, real invitations, ownership changes, or permission changes were made during this implementation.
