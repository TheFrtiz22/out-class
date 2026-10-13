# Club recipient audiences and groups

Branch: `repair/workspace-reliability`.
Main inspected after fetch: `ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`, unchanged.
Reliability checkpoint: `e31d3257a97b028629f94278beb53eeab8b9a8fb` (28 files).
Admin session checkpoint: `7dea0d174bf7d9c5d02447d674fc1026c2614b48` (26 files).
Admin migration-before-code instructions remain in `docs/admin-session-lifetime.md`.

## Product entry points and capabilities

Open the club workspace **Announcements** section. **Recipient groups** provides
create, edit, preview and delete controls. Editing requires both `meetings.manage`
and `members.manage` (or active club ownership). Preview/use requires
`meetings.manage`; applicant-derived filters additionally require
`applications.review` and `applicants.identify`. The server repeats live account,
active membership, capability and suspension checks after acquiring club locks.
Group metadata does not expose manual recipient IDs. Recipient identities are
resolved and authorized on demand. Anonymous-review applicants never enter
applicant-derived selections; saved manual selections cannot reveal their
identity later if their current club visibility is lost.

Manual groups (Consulting, Finance, teams, committees) select known people from
previews. Users can combine previews to add selections, remove selections or
clear them. Rule groups store reusable include/exclude definitions, including
other groups. Dependency cycles, references outside the club and dependency
removal are rejected. Optimistic revisions prevent stale edits; identical
save retries return the existing group. Group deletion deletes group entries,
never student accounts, memberships or published notifications.

The announcement composer has **Groups and audience filters** and **Preview
recipients and count**. Include selectors are unioned; exclusions subtract from
that union; each person is notified once. A rule's populated filters intersect;
multi-value filters match any listed value. Empty value filters mean no restriction.
Publication reevaluates current data and authorization; a preview is a timestamped
estimate rather than a reservation. A publication request key freezes the original
notification rows and rejects changed-content retries, including audience changes.

## Supported rules — recorded data only

- Active members: actual ACTIVE ClubMember rows and enabled accounts.
- Executives/officers: active members with explicit ownership, recorded
  PRESIDENT/VICE_PRESIDENT/BOARD interview offices, or recorded PRESIDENT/
  RECRUITMENT_LEAD legacy club roles. Titles are not parsed or guessed.
- Access roles: OWNER, ADMIN, RECRUITING_ADMIN, INTERVIEWER, MEMBER.
- Graduation year: StudentProfile.gradYear; missing profiles do not match a
  specific year. No inferred years or student-year conversion.
- Joining/recruitment cohort: recorded ClubMember.cohort; recorded joinedAt
  date ranges; existing ClubMember.groups labels remain usable.
- Active submitted applicants: excludes DRAFTING and REJECTED; current non-archived,
  non-anonymous rounds only. Filter by club round, graduation year and submitted/
  in-review/interviewing/accepted/waitlisted status.
- **Rejected Applicants**: separate explicit source, never implicitly included in
  active applicants. The same anonymous-review and identification restrictions apply.
- Interview state: current INTERVIEWING, any recorded booking, no recorded booking,
  or a completed canonical interview record. Bookings have no cancellation-status
  field; these filters do not invent one or infer interview completion from a date.
- Recruitment offers: none, pending, accepted, declined, revoked, expired. Pending
  deadlines are evaluated at resolution; elapsed pending offers count as expired
  without mutating their records. Offer records and membership commands are unchanged.
- Selected club-event audiences: recorded RSVP, attendance or either.
- Leads: recorded participation in selected club events, excluding active members
  and submitted applicants. This is not a new lead/contact database. Private
  Corkboard saves never become marketing consent or audience membership.
- Saved manual groups and reusable rule groups.

Applications have **no recruitment-cycle field**. Cycle filtering is intentionally
unavailable, not guessed from timestamps, round names or current membership cohort.
Unknown cycle/cohort-on-application input is rejected. The UI and capabilities
response disclose this limitation. Existing missing cohort values remain missing.

## Canonical communications and future scheduling

`utils/recipient-audience.ts` is the shared server-only resolver. It consumes a
transaction client and club/actor scope, returns sorted deduplicated IDs, and does
not inspect channel preferences, send email or call a provider. Existing canonical
UserNotification/outbox triggers remain authoritative. Optional email delivery
continues to apply existing category preferences and worker rules separately.
The retired direct-messaging actions remain disabled.

`captureRecipientAudience` produces a server snapshot; `evaluateRecipientSnapshot`
supports FIXED and SEND_TIME evaluation. FIXED retains captured IDs as an upper
bound and suppresses recipients who no longer match current rules/visibility;
newly matching people cannot enter. SEND_TIME reevaluates rules/groups and can add
new matches. Both reauthorize the actor and reject a different club. Snapshots are
server-owned and must not be accepted from a future scheduler's client payload.
Deleted dependencies fail closed. This batch does not introduce scheduled jobs.

The caller retains the club serialization lock through use of the resolved IDs.
Writes use the established bounded club transaction wrapper: provider validation
before acquisition, live DB authorization and support validation inside the
transaction, 5s acquisition / 15s transaction / 3s lock / 10s statement budgets.
Individual domain audit writes preserve the existing support attribution extension.
No network delivery occurs while locks are held.

Bounds: 100 groups per club, 1,000 recipients per selector/result, 20 include and
20 exclude selectors, five group-dependency levels and 100 rule evaluations per
resolution. Oversized selections fail explicitly; results are never silently
truncated. Counts represent audience membership, not delivery eligibility.

## Migration and deployment compatibility

Migration: `20261013002253_recipient_audiences`.
Adds RecipientGroup, RecipientGroupEntry and nullable ClubAnnouncement.audienceSpec;
extends the existing audience CHECK for CUSTOM and requires a custom specification
only for CUSTOM records. Existing announcements retain NULL specifications.
Group entries use a composite (groupId, clubId) foreign key. Both new tables have
restrictive false RLS and no browser/PUBLIC grants. When the established
outclass_production_app role exists, only these new tables gain that bounded owner;
its schema CREATE privilege state is preserved. No unrelated ownership, role,
provider, preference, queue or student data changes occur.

For any future authorized deployment, apply Admin migration
`20261012171752_admin_session_bound_elevation`, then this audience migration before
application code. Both are additive; no migration was applied to production/staging.
An older application can continue reading existing announcements and inserting
MEMBERS/APPLICANTS records, but does not expose new custom-group controls.

## Validation and evidence

- Focused audience/communications/migration checks: 15 passed.
- Native PostgreSQL feature checks: 16 passed through the actual bounded runtime
  role, covering CRUD, rules, member changes, fixed/dynamic resolution, deduplication,
  retries, stale revisions, dependency cycles, atomic audit rollback, permission
  revocation, cross-club denial, anonymous-review changes and Demo denial.
- Populated native browser-role checks: SELECT/INSERT/UPDATE/DELETE remain denied
  even after accidental broad grants and permissive policies. Cross-club composite
  foreign-key violation is rejected; runtime schema CREATE remains denied.
- Real local Auth + production-build Next HTTP group checks: 5 passed, zero skipped.
  Create/edit/preview, member and cross-club denial, actual Demo-cookie denial,
  publication retry and canonical notification/outbox counts, and deletion/account
  preservation exercised. The local runner explicitly disables communications
  email and Resend. No provider delivery is counted as verified.
- Full suite: 1,008 passed, 17 gated skips, zero failures (1,025 total). The dedicated
  native and HTTP gates above were executed separately, not counted as passing skips.
- All 41 migrations apply on fresh and legacy isolated databases; all 68 tables
  enforce RLS/browser CRUD denial. A populated native 40-to-41 upgrade preserves
  membership/cohort/labels, announcements, notifications and queued outbox intent.
  Prisma migrate status reports up to date after the fresh full deployment.
- Existing native transaction regressions: 31 repair checks plus 26 offer/
  communications checks passed, including normal and impersonated sessions,
  support attribution, revocation, transaction bounds, retries and rollback.
- TypeScript, Prisma validation, production build and diff checks passed; lint has
  zero errors and 28 existing warnings.

Evidence: `/tmp/outclass-recipient-audiences/{focused,native,http,full,migrations,
checks,lint,build,transactions}.log`. Reproduce native checks with
`node scripts/test-recipient-audiences-local.cjs`; the helper always creates and
removes a dedicated loopback fixture and never reads application DB secrets.
For the prepared disposable Auth fixture:
`OUTCLASS_ADMIN_LOCAL_PROJECT=outclass-admin-session-e2e node scripts/run-admin-local.cjs audience-integration`.
Rendered browser interaction/visual QA has not been run; production/hosted email
verification remains outside this local batch. No known P0/P1/P2 code findings;
cycle data and full browser visual verification are explicit remaining gaps.

All five credential-recovery files remain unchanged and excluded. No push, merge,
deployment, production/staging database change, global email enablement, real
preference change or existing production queue change was performed.

## Exact feature manifest (15 files)

- `actions/communications.ts`
- `actions/recipient-groups.ts`
- `components/club-announcements.tsx`
- `components/recipient-audiences.tsx`
- `docs/recipient-audiences.md`
- `lib/recipient-audience.ts`
- `prisma/migrations/20261013002253_recipient_audiences/migration.sql`
- `prisma/schema.prisma`
- `scripts/run-admin-local.cjs`
- `scripts/test-recipient-audiences-local.cjs`
- `tests/decision-runtime-migration.test.cjs`
- `tests/recipient-audience.test.cjs`
- `tests/recipient-audiences-e2e.test.cjs`
- `tests/recipient-audiences-native.test.cjs`
- `utils/recipient-audience.ts`
