# Interview audit repairs and release handoff

October 5, 2026. This handoff supersedes the deployment counts and anonymous-review exclusions in the earlier stage handoffs. Production deployment remains unauthorized and pending.

## Source and repairs

The clean `interview-room-redesign` checkpoint was `4757ced3a744d44ec64d26e17d5a21296e0e9ecf`. Fetch verified main at `f171f714aa1ff1c64b8209f424730d0c413d4b6a`. Merge commit `3c66f4773d3335fae0992e7b882d71bc3ef02a22` preserves both parents. The Next configuration and applicant-intelligence test conflicts were resolved preserving PDF tracing, the interview panel projection, and newer voting presentation behavior. Schema, voting/presentation/join, onboarding and demo additions from main remain intact. Audit repairs are subsequent uncommitted changes on the feature branch, available for review and a local commit. Nothing was pushed or deployed.

- **Owner setup:** Interview management exposes Interview access setup only to current owners. Owners explicitly attest President, Vice-president or Board offices through the existing audited membership actions; scheduling/admin titles never imply those offices. The UI can review/save a proposed room panel, approve its exact revision and eligible bookings, or manually grant/revoke an applicant/round panel assignment. Anonymous cases are labeled and cannot receive private panel grants.
- **Scheduling integration:** Booking and rescheduling derive assignments only from a current owner's reviewed room policy. Panel edits, closure, cancellation, disabled accounts and loss of membership/review rights revoke derived grants. Reopening requires approval again. Revision checks reject stale approval. Panel edits retain scheduling overlap protection. Legacy or moved-round bookings remain unresolved. Manual grants and explicit manual revocations remain independent; cancellation does not undo an intentional manual grant, and later bookings cannot undo a manual revocation. Owners must revoke manual grants separately.
- **Private résumé access:** Recruiting projections and leader workspace links use `/api/recruiting-resumes?clubId=…&applicationId=…`. The route derives the current private object from authorized application scope, checks current club membership, review/identify permissions, draft/anonymous privacy and disabled accounts, and rechecks authorization and the reference after download. It proxies validated PDF bytes with no-store headers, no public or signed storage URL, and an audit event. Caller-selected object paths are rejected. Profile-owner self service still uses its owner-scoped route. Interview documents remain pinned to the preserved version and annotation access remains separate. Legacy external links retain their existing safe URL handling; the server does not fetch arbitrary external URLs.
- **Anonymous closing reopening:** Explicit current President/VP/Board permissions can read final reviews after a round transition. Original, recorded or current anonymity yields the same anonymous applicant label as recruiting decisions, a generic round label, exact score, unavailable closing free text and no identifying submission timestamp. No question notes, profile/files/scholarships or identifying free text are returned. The UI updates an already-open review's label from refreshed metadata, displays the unavailable state, remains read-only and clears data when access fails. Evaluation immutability and separate President/VP annotation moderation remain enforced.
- **Demo:** All new setup operations have isolated adapters. The browser check found and repaired stale-object mutation in approval/panel editing; mutations now update the cloned store record. Tests verify persisted setup and entry with zero live action calls.

Principal changed areas: `actions/interview-access-setup.ts`, `components/interview-access-setup.tsx`, room/booking and membership actions, `utils/interview-scheduling-access.ts`, the scoped résumé route/helper and link callers, closing review actions/projections/UI, demo adapters, Prisma schema/new migration, and focused SQL/action/payload/UI tests.

## Migration authority and exact chain

Prisma remains the only migration authority. The combined branch has **24** forward migrations, in order:

```text
20260923000000_baseline
20260923010000_capabilities
20260924000000_club_claims
20260924010000_anonymous_review_tests
20260924020000_interview_kits
20260924030000_meetings
20260924040000_member_tasks
20260925000000_platform_view_sessions
20260925010000_marketing_participants
20260927000000_recruiting_rules
20260928000000_private_resume_storage
20260929000000_club_marketing
20260930000000_interview_rooms
20261001000000_support_impersonation_tutorials
20261001010000_club_onboarding
20261002000000_organization_invitation_emails
20261002010000_onboarding_security
20261003000000_applicant_intelligence
20261003010000_durable_voting
20261003020000_corkboard
20261003030000_task_workflows
20261004000000_interview_foundation
20261004000000_voting_presentation_join
20261005000000_interview_scheduling_access
```

Only `20261005000000_interview_scheduling_access/migration.sql` is new in these audit repairs. It adds room approved-member IDs, approving-user reference and nonnegative policy revision; assignment booking-source metadata/index; approved-panel subset and current booking/owner/club/reviewer checks; and triggers invalidating derived grants on policy changes, cancellation, membership loss and account disablement. Restrictive RLS and browser-role/PUBLIC denial remain explicit. It grants no legacy private access automatically and changes no historical scores. The existing foundation migration still supplies immutable records, snapshots, document versions, moderation history and score constraints. No applied migration was edited, reset, reconciled with db push, or marked applied; the Supabase archive was not replayed.

## Hosted metadata observation

Authenticated project listing showed OutClass `htlgjluegmdwfjkzzwic` active and staging `omfcozcbpmevwolshibh` inactive. A SELECT-only ledger query on October 5 returned **22 finished, non-rolled-back** Prisma migrations. `voting_presentation_join` is already applied. The exact missing migrations are:

1. `20261004000000_interview_foundation`
2. `20261005000000_interview_scheduling_access`

The historical count of 17 is obsolete. This is ledger verification, not complete schema/checksum/drift verification. The Supabase CLI unexpectedly emitted “Initialising login role…” before returning the SELECT results, despite its documented Management API query path. No application DDL/data statements were sent, but an authentication-role side effect cannot be ruled out; further production CLI checks were stopped. Review this CLI behavior and use a verified read-only metadata mechanism for the staging/production schema rehearsal. No production application migration or Vercel deployment occurred.

## Verification

Validation results are recorded below after the final run. Commands use `npx --yes pnpm@10.34.6` with the existing `pnpm-lock.yaml`, Node 24.21.0 and Prisma 6.19.3; no lockfile deletion or dependency-version workaround was necessary. Frozen install/postinstall and explicit Prisma generation succeeded; PDF worker, maps and font assets were generated. This repaired the audit environment's missing lint plugin/generated types. Windows persistent-PGlite and production output checks are retained rather than disabled.

| Check | Result |
| --- | --- |
| Frozen pnpm install, Prisma generation, PDF assets | Passed; existing lockfile retained. |
| Lint | Passed, 0 errors and 29 existing warnings (image elements and hook dependencies); no check disabled. |
| TypeScript | Passed, including regenerated Prisma types and scoped route/UI adapters. |
| Production build | Passed, exit 0, compilation/type checks/static generation/tracing completed; filesystem blockage did not reproduce. |
| Migration path | Passed; Prisma is the sole active application history. |
| Fresh/legacy migration rehearsal | Passed in disposable PGlite: 24 migrations, 47 tables with RLS and browser-role CRUD denial. |
| Focused SQL/action, demo setup and anonymous UI regressions | Passed, including closure/reopening requiring reapproval and anonymous label refresh. |
| Full suite | Final stable-source rerun: 628 tests, 625 passed, 0 failed, 3 skipped; duration 140,917.819 ms, exit 0. |
| Native PostgreSQL transaction races | Not run: no verified isolated database/tools available. |
| Hosted Auth/Storage and configured HTTP onboarding/import runtime | Not run; no isolated hosted test configuration supplied. |

The build's existing database-backed public metadata path logged missing `DATABASE_URL` during prerender, then completed through its fallback. This exit-0 local build is not proof of production database-backed metadata or hosted functionality. Existing webpack cache serialization warnings also remain. Earlier retries found an obsolete résumé-link expectation and a typo in the added closure test; both were corrected, not skipped. No environment EPERM failure reproduced in the successfully completed checks.

The migrated SQL/action test applies all migrations to disposable in-memory PGlite, invokes actual room → booking → owner approval → assignment → interview actions through a small SQL-backed Prisma adapter, and verifies stale approvals, scheduler self-grant denial, panel changes, overlap denial, rescheduling, cancellation, manual revocation, disabled accounts and ambiguous legacy review. It uses synthetic authentication; it is not a native Prisma transaction-race test. Payload/route mocks separately cover résumé permissions/reference rechecks and anonymous identified→anonymous transitions. Existing tests retain private note isolation, snapshots, historical decimal scores, canonical immutable evaluations, concurrent annotations and safe retry protections.

Local Chrome checks used a temporary synthetic route and actual setup/session components with isolated demo adapters: preapproval denial, reviewed approval and entry, office controls, question notes/completion, discussion with null score, deliberate lower-endpoint keyboard scoring, save failure retaining text after revocation, explicit grant/retry recovery and final 9.5 locking. At 390×844 the workflow stacked without horizontal overflow. The temporary route was removed, dev server stopped, tab closed and viewport restored. A browser-extension-added hydration attribute warning was observed; no application permission was weakened. Browser checks did not exercise hosted Auth/Storage or real applicant documents. PDF parsing/text-layer/anchor checks are real local PDF tests in the existing suite, separate from mocked authorization checks.

Native PostgreSQL/Docker tools and a verified disposable native connection were unavailable. Hosted onboarding/Auth/MFA/Storage and isolated built résumé-import runtime configurations were not supplied. These remain staging prerequisites, not passing hosted-service evidence.

The three skipped opt-in tests are native PostgreSQL onboarding races (`OUTCLASS_SECURITY_TEST_DATABASE_URL` absent), real HTTP/hosted onboarding, and the isolated built PDF-import action runtime (both require `OUTCLASS_ONBOARDING_E2E_CONFIG`). The persistent corkboard and voting migration reopen tests pass without removing their filesystem checks. Real local PDF processing tests continue to run in the full suite. No hosted applicant document was accessed by these tests.

## Coordinated release checklist — still unapplied

1. Review and commit the feature repairs locally. Review the merged main changes and immutable migration checksums. Push/merge require separate authorization; a Git commit does not update Supabase.
2. Activate/provision verified isolated staging. Record database identity and isolation before any writes. Rehearse the complete 24-migration fresh/legacy chain using Prisma and the deployed-schema upgrade with a sanitized backup. Run native Prisma race/revocation tests, validate SQL constraints/RLS/browser grants and compare schema/ledger checksums through a verified read-only route.
3. Verify backup and restore operationally, including document storage/version retention and audit rows. Record owners and recovery procedure; restoring an older schema requires a compatible application artifact. Do not use reset/db push/resolve to conceal drift.
4. Rehearse hosted Auth/Storage with two synthetic interviewer accounts, an explicit office holder, owner, applicant and outsider. Verify private bucket configuration, authorization before/after download, replacement résumé preserving old annotations, membership disable/revoke behavior, anonymous reopening, exact-score history, immutable alternate evaluation/admin endpoints and demo zero-write behavior.
5. After explicit production authorization, enter a coordinated maintenance/release window and recheck the ledger. Apply exactly the pending Prisma migrations (currently foundation, then scheduling access) **before** releasing the matching Vercel application artifact. Do not replay the Supabase archive or reapply the already-finished voting migration. Generate Prisma/PDF assets from the frozen lockfile in the build.
6. Deploy the reviewed matching source revision to Vercel only after schema verification. Attest actual offices and review existing room panels/bookings in the owner UI; leave ambiguous cases unresolved. Smoke-check room booking/rescheduling/cancellation, independent question drafts, authorized current recruiting résumé vs pinned interview version, anonymous closing projections, read-only submissions, native transaction races, revoked access and audit events. Check logs for denied/missing-column errors without logging private content. Confirm backup recovery remains available.

Production release is **not ready** until these gates are completed and authorization is given. Both named production migrations and the Vercel feature release remain unapplied.
