# OutClass integration and security audit

Date: September 26, 2026. Scope: newly added club, recruitment, meeting, task, platform, recovery and deterministic demo functionality. No deployment or production data mutation was performed.

## Result and evidence

Local validation passed: 175 tests, all nine migrations on fresh and populated legacy PostgreSQL-compatible PGlite databases, Prisma schema validation, lint (zero errors, 30 warnings), TypeScript and production build. The migration suite verifies RLS and denied browser-role CRUD privileges on all 25 application tables. Dependency audit reports zero known vulnerabilities after patching Next to 15.5.26 and affected transitive dependencies. `npm run validate` repeats the test/migration/lint/typecheck/build sequence; use pnpm 11 for the committed lockfile and workspace configuration.

Evidence has distinct limits: server/action tests execute application authorization with mocked authentication and database results; migration tests execute real SQL in isolated PGlite; browser checks cover local public routes, an existing deployed demo, and current demo components in an isolated local fixture. These are not eight authenticated production-browser sessions. Live `prisma migrate status` against the configured connection timed out; no remote migration, baseline resolution or schema push was performed. Live schema drift, deployed RLS, storage policy configuration and provider settings remain unverified.

## Issues fixed

- New interview bookings require the applicant to be in INTERVIEWING status, in addition to existing ownership, club, time and capacity checks.
- Student dashboard/account responses omit internal anonymous-review text. Evaluation responses select only necessary interviewer identity fields rather than full academic profiles.
- Invitation acceptance requires a verified email without the development verification-skip marker, a currently active inviter and current delegation authority. Revocation reloads authority under the club lock. Removing members revokes outstanding invitations that could otherwise restore access.
- Suspended accounts cannot receive ownership or new platform-granted capabilities. Last-owner checks count active owners.
- OAuth callback redirects use the request origin and validated local paths rather than trusting forwarded-host input.
- Resume signing fails closed when its bucket is public or unavailable, and responses prevent caching/referrer disclosure.
- Account API rejects demo and platform inspection cookies directly, supplementing middleware.
- Workspace switching uses Next route search state, fixing Student selection bouncing back into MII during navigation. Regression tests and the actual local switcher confirm Student → MII Leader → Student.
- Fixed a conditional React hook in the member portal, stale meeting/attendance loading state, and lint errors. Production builds now enforce lint.

Next patch selection addresses published advisories, including [Windows server handling](https://github.com/advisories/GHSA-p293-qw3h-jr36) and [AVIF optimization](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4); applicability depends on deployment and enabled features. No exploitation is asserted.

## Persona and boundary coverage

| Persona | Representative verified boundary |
| --- | --- |
| Ordinary student | No club management from forged club IDs, role values or workspace state; anonymous protected route shows an unavailable state. |
| Applicant | Own applications only; internal anonymous text omitted; interview booking requires invitation stage. |
| Club member | Current membership and task audience restrict assignments, resources and submissions; membership does not imply management. |
| Limited manager | Explicit capabilities enforced; cannot escalate delegation or obtain identified applicant data without identity permission. |
| Broad manager | Authorized operations remain club-scoped; foreign club/application/task IDs denied. |
| MII demo leader | One student identity, management only for MII; real workspace switcher; demo adapters stay local and live actions reject demo sessions. |
| Super-admin | Separate allowlist, database grant, active account and MFA requirements; no implicit grant from legacy role or demo state. |
| Anonymous reviewer | Sanitized review projection omits identity fields and unsafe source text; identity-dependent operations require separate permission. |

Tests additionally cover claim approval authority, invitation expiry/revocation, ACT/SAT requirements and score validation, interview kit versions and notes, decision conflict checks, QR expiry and issuer revocation, private meeting resources, task audience/submission revisions, file ownership and signed access, recovery token/origin behavior, and read-only platform inspection. Voting previews do not establish a persisted multi-device ballot system; production decision updates have their own authorization.

## Authorization and database policies

Supabase supplies verified authentication; server guards load the active database account and current club membership. Ownership and explicit capability arrays determine access. URL parameters, client workspace selection, legacy role labels and group/cohort labels do not grant authority. Object reads/writes scope IDs to the authorized club or account. Operations exposing applicant identity require the relevant identity permission as well as operational access.

Platform administration is independent of club ownership: allowlisted identity, active database admin grant and MFA assurance are required. Inspection retains the admin identity in an expiring, audited, read-only session. Middleware and server guards block writes; it never issues a target user's authentication token. Writable impersonation is intentionally unavailable.

Application tables enable RLS and revoke direct anon/authenticated CRUD access. Prisma uses a trusted server database role, so server authorization remains essential even with RLS. Supabase Storage policies and authentication triggers are separately configured and were not proven on the live deployment by the SQL suite. Private-bucket checks supplement object ownership and membership checks before signing downloads.

## Schema and routes

No new schema migration was needed for these audit fixes. The existing nine migrations cover:

1. Baseline schema.
2. Capabilities, ownership, suspension, platform grants, invitations, claims, content/tasks and audit records.
3. Claimed clubs and directory metadata without fabricated statistics.
4. Anonymous review and ACT/SAT requirements/subscores.
5. Interview kits and interview records.
6. Unified meetings, retained event/attendance IDs, visibility and hashed QR tokens.
7. Semester projects, task targeting, group/cohort membership, assignments and private files.
8. Expiring platform inspection sessions.
9. Explicit marketing approval, unset by default.

The added functionality uses `/club/[clubId]/workspace`, `/tasks`, `/club-access/[clubId]`, `/invitations/[id]`, `/club-claims/[clubId]`, `/meetings`, `/meetings/[id]`, `/check-in`, `/platform/login`, `/platform`, `/platform/claims`, `/platform/view-as`, `/api/platform/view-as`, `/api/platform/view-as/blocked`, `/forgot-password`, `/reset-password`, `/api/auth/password-recovery`, and `/api/demo`. This audit added no routes; existing `/api/resumes`, `/api/users/me` and `/auth/callback` were hardened.

## Demo integration

Canonical fixtures contain claimed/unclaimed and early-adopter examples, MII leadership, another club membership, applications, SAT/ACT combinations, anonymous rounds, essays/reviews, interview kits/notes, meeting attendance/agendas/resources, historical/upcoming meetings and targeted weekly/semester work. Text, link and safe static sample-file submissions illustrate completion states. Real uploads remain disabled in demo.

Shared IDs and projections connect meeting attendance to applicant review/history and tasks to current membership. Automated workflows check mutation propagation, refresh persistence, cross-club denials and reset restoration. Reset restores canonical data and clears workspace route state. Super-admin is excluded from normal demo identity. Browser verification of current fixtures used an isolated temporary app with demo providers and no production credentials; production auth code was not weakened.

## UX and performance

Student navigation retains Home, Discover, Applications, Calendar and Profile. Club navigation groups work into Overview, Members, Meetings, Tasks, Recruitment and Settings, with access-driven controls. Student mode does not display leader navigation. The local current demo visibly switches both directions using the real workspace selector.

Browser checks inspected sign-in, recovery validation, invalid recovery links, denied club URLs, demo overview and task layouts, including a narrow mobile viewport with no horizontal overflow in the checked pages. Labels, landmarks, skip navigation and explicit unavailable/error states were inspected. This is not a complete screen-reader or every-breakpoint certification. Loading/error/empty handling was reviewed in source; stale meeting and attendance data now clear during reload.

Production build succeeds; shared first-load JavaScript is about 103 kB, while the main application is about 452 kB. Heavy management views and unbounded applicant/member/meeting/task listings merit lazy loading and pagination. Thirty lint warnings remain, primarily image optimization and hook dependencies; they are not hidden by the build.

## Remaining concerns and intentionally deferred work

- Before rollout, verify actual Supabase schema/migration history and RLS using a working direct or staging database connection. Reconcile legacy drift before baselining.
- Exercise all eight personas with separate staging accounts, including MFA, real invitation links, recovery email delivery, private storage upload/download and revoked access. Current test doubles cannot prove provider configuration.
- Review historical capability backfills: existing GENERAL_MEMBER records retain historical review, identity and attendance privileges. New memberships default to no capabilities, but old grants need an explicit least-privilege review.
- Require production email confirmation and disable development unverified-signup bypasses. Bucket privacy, storage policies and service credentials remain operational responsibilities.
- Signed task URLs remain valid for up to 60 seconds and resume URLs for five minutes after issuance. Externally linked resources rely on the external host's access controls. Malware scanning and orphan-file cleanup are deferred.
- Anonymous review relies on the sanitized projection and manager-reviewed text; arbitrary free text must be checked for self-identifying content before publishing it to anonymous reviewers.
- Persisted multi-device voting, invitation email delivery, writable impersonation and native manager resource uploads remain intentionally unavailable or preview-only. No unrelated feature was added to fill those gaps.
- Database audit protections do not protect against a privileged database owner; off-database retention is an operational follow-up.
- The existing GitHub Pages workflow uses an older pnpm and expects a static `out/` artifact, which does not match this server-backed app. Replace it with a server-capable deployment and validation pipeline before relying on it. This audit did not change or trigger deployment.

Highest-value next steps: staging authorization/storage/provider verification; reconcile and deploy migrations safely; replace the deployment pipeline; review legacy grants; then reduce client bundle size and paginate large workspaces.
