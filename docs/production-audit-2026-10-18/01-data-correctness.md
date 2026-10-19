# Data correctness report

## Local remediation update

Later real browser checks reproduced a scheduling parent remount that reset round/week state, plus overcounted interview coverage: retained availability from declined/unconfirmed participants was included in capacity lists. Both coverage projections now require confirmation, with a draft/confirm/decline regression and exact-count browser checks. Assignment validation already rejected unconfirmed participants. The scheduling parent now remains mounted for same-club round changes, with desktop/mobile parent-state, history and club-reset checks.

The common account projection is now allowlisted in both HTTP and RSC. Real local Auth/Prisma/PostgreSQL fixtures verify student-owned applications, two campus records, overlapping memberships, ordinary-member denials and recruiter/owner template reads scoped to the permitted club. This does not establish a second email-domain sign-in policy. The batched communications snapshot passes migrated SQL fixtures and native Prisma checks for exact pre-change hash/count parity. Current validation details are in [the remediation report](remediation/REPORT.md); original baseline results follow.


Stage A: existing behavior was inspected and tested; application behavior was not changed. Sources and authorization boundaries are mapped in [data-flow-map.md](data-flow-map.md). These results establish specific properties, not universal correctness across all future records and deployments.

## Executed evidence

| Validation | Result | What it establishes |
|---|---|---|
| Entire `tests/*.test.cjs`, concurrency limited to 3 | 1,228 passed; 30 skipped; zero failures | Existing unit, mocked action/UI and PGlite coverage. Optional native/E2E cases require dedicated fixture variables; skips are not passes. |
| `npm run test:migrations` | Passed | All 56 migrations replay on fresh and populated legacy databases; preserved records; all 78 application tables RLS-enabled and browser CRUD denied. |
| Real onboarding runner | 14 passed, zero skipped | Actual Next HTTP → Supabase Auth/TOTP → Prisma/PostgreSQL and local SMTP. Claiming, role denials, verified invitations, CSV preview/confirmation/replay, recovery and session revocation. |
| Dedicated native publication runner | 65 passed across five test groups | Actual PostgreSQL transactions, bounded runtime role, additive upgrade preservation, invitation/availability/decision publication, audiences, concurrent workers/retries and rollback. Expected injected failures appear in logs and are not test failures. |
| New account-projection probe | Completed; disclosure reproduced | Real account HTTP response with two universities, two students and overlapping memberships; own application filtering holds; ordinary member receives internal Club template properties. |
| Scheduling quality browser audit | Failed after startup/build and initial checks | The old URL selects the assigned-room view; test waits for the scheduling heading. Later scheduling assertions were not executed. Do not count this as verified scheduling UX. |
| Live read-only data invariants | No violations in the listed checks | Snapshot of existing production relationships/counts only; not concurrent mutation testing. |

Logs and reproduction outputs are under [evidence](evidence/). The native suite totals are 8 + 7 + 16 + 16 + 18 = 65; they are reported separately from the default run rather than presenting skips as completed coverage.

## Feature matrix

“Passed tests” means the named executed suites cover selected allow/deny behaviors; it does not mean every screen was manually reviewed against production student records.

| Role / feature | Authoritative records and conditions | Verification / remaining limit |
|---|---|---|
| Student dashboard | Own Application; visible Event/attendance; own panel schedule; status presentation helpers | `student-home`, `student-agenda`, `personal-workspace`, `student-journey`, `live-applicant-views` passed. No production account impersonation used for comparison. |
| Discovery / organization profiles | Public Club projection; discoverable/unsuspended directory; live published events | Directory, marketing, discovery and public-boundary tests passed; no school filter; direct-link undiscoverable profile policy needs confirmation before tightening. |
| Applications / statuses | `(studentId,clubId)` key; DRAFTING-only mutation; active first round and current questions; historical answered questions retained | Student application, autosave, recruitment/offer and leader-isolation tests passed. Live cross-club round/answer checks returned zero. Application-cycle/reapply policy remains existing behavior. |
| Student interviews / booking | Own invited application; correct club/round; approved current panel, future time, staffing/capacity | Interview/self-booking, room, publication and database tests passed; live over-capacity and duplicate round-booking counts zero. Native simultaneous exclusive-slot race not run. |
| Tasks / assignments | Active assigned member; ClubTask → TaskAssignment; manager can manage every target | Tasks/workflow/database tests passed; live assignee/member/club mismatches zero. Dedicated production file access not exercised. |
| Events / attendance / RSVP | Public published events or member visibility; own save/RSVP; attendance authorized by scope/token | Campus event, meetings, storage-policy and attendance tests passed. Native event Storage and RSVP-concurrency optional suites remain unexecuted. |
| Notifications / invitations | Own inbox `userId`; immutable publication audience; verified current SchoolIdentity | Notifications/audience tests and 65 native publication tests passed. Real onboarding invitation acceptance/replays passed. Live missing-outbox count zero. |
| Personal settings / profile | Session-owned StudentProfile; section-specific writes; owned asset references | Profile, settings-navigation component, preference and upload-boundary tests passed; full optional settings HTTP runner not executed. Shared account Club projection discloses template properties. |
| Club dashboard / analytics | Club-scoped counts; drafts excluded; anonymous visibility determines visible recruiting counts | Club workspace/overview, applicant and isolation tests passed. No separate analytics warehouse was found; displayed analytics derive from application and attendance queries. No snapshot of every production UI count was made. |
| Applicants / review / rounds | Authorized club; active rounds; explicit identified/anonymous projections; submitted evaluation gates | Leader-isolation, anonymous review, applicant intelligence and recruitment tests passed. Round moves reject foreign rounds. Native reviewer-concurrency suite remains an optional gap. |
| Interview scheduling / availability / kits | Global user availability plus scoped participation; immutable kit/session snapshot; explicit panel grants | Default database/unit/browser-component tests passed; actual scheduling-quality browser path fails before full flow. Kit draft/native full-interview concurrency tests were skipped in default suite. |
| Club tasks / members / access | Scoped capabilities and every-target checks; last active owner; status not just legacy title | Role, bulk, membership, tasks tests passed; real HTTP onboarding role-denial cases passed. Overlapping memberships in the new probe remain ordinary; no implicit admin grants. |
| Announcements / schedules | Explicit audience, current publisher authority, idempotency, atomic inbox/outbox | Communications tests and native workers/audiences passed. Email recipient processing uses captured local SMTP or outbound-disabled fixtures. No production email was sent. |
| Club settings / decision templates | Scoped manage grants and revision guards | Settings tests passed. Dedicated template endpoint is permission-guarded, but common account/bootstrap projection bypasses that property boundary; confirmed M1. |
| Admin organization create/claim | Platform allowlist, active grant, MFA/elevation; school mapping and scoped owner invitation | Default platform/onboarding tests and real onboarding approval/designation/replay checks passed. Full optional Admin workspace/elevation E2E suite was not run separately. |
| University configuration / admin permissions | School/identifier configuration; composite school keys; explicit platform authority | Migration tests include UVA/Penn identities, reject wrong-school identifier/invitation/import references. **End-to-end second-domain login is unsupported by current UVA-only guards.** |
| Platform management / view-as / onboarding | Real actor/effective user separated; support session and audit; elevated operations | Platform/admin/support tests passed; sensitive recovery/TOTP cases passed in real HTTP. Full operational disaster recovery and every support mutation were not exercised. |

## Live snapshot checks

[live-integrity-counts.json](evidence/live-integrity-counts.json) contains the exact read-only aggregate query. Counts were zero for: application/round club mismatches; answer/question club mismatches; booking/slot and booking/round club mismatches; slots over capacity; duplicate application/round bookings; active panel cross-club assignments; task/member/user mismatches; invitation/school mismatches; duplicate pending same-email invitations; claimed unsuspended clubs without an active non-disabled owner; notifications without outbox; and decision-letter club mismatches.

Only one School and one distinct Club school are present live. No conclusion about multi-university production correctness can be drawn from that population. The controlled account probe creates two schools and overlapping ordinary memberships; existing SQL tests validate school-bound identities and invitations. Current `requireAuth`, signup and legacy invitation paths explicitly require UVA email, while application submission does not independently bind the club's school to a current verified student school. A second-campus rollout requires a coherent policy and negative end-to-end tests first. This is a High rollout-readiness risk, not a demonstrated existing production cross-campus data leak.

Two historical CHECK constraints are NOT VALID. Separate safe counts found zero score-range or slot-window violations; validate them only through an approved, timed migration/maintenance plan. All 56 migration names are present live; four checksum differences are exactly LF/CRLF differences, not missing migrations. See [schema inventory](schema-inventory.md).

## Cache and update propagation

Private workspace GET responses and the client reader use no-store. React request caches contain no cross-request identity keys. Workspace client resources include identity, club and permission scope, and late responses are discarded when scope changes. Existing navigation/isolation tests cover selected switch/refresh scenarios. Notification audiences and inbox ownership are explicit. Status mutations write audit/decision/notification state transactionally; workers and clients subsequently refresh through guarded reads.

Public directory fields have a 60-second cache; event publication visibility is read fresh. Launch consent/marketing uses a separate 300-second cache, and sitemap data has a 600-second cache. Those staleness windows are not authorization for private information. Preserve per-domain invalidation when changing public projections. No shared-cache private-data leak was reproduced; no claim is made that every revalidation branch has complete coverage.

## Prioritized correctness work

1. Replace the common account Club projection to remove internal decision templates, then test both RSC/bootstrap and API serialization across roles.
2. Repair the scheduling audit's navigation contract and execute the full real scheduling/booking journey before treating the current green default suite as a release guarantee.
3. Add independent-native-connection exclusive-slot booking/rescheduling races, cross-club overlapping interview commitments, and ordinary-session replay tests.
4. Gate second-university enablement on domain-aware auth/identity/application/discovery policy and a two-domain E2E fixture.
5. Validate the two historical CHECK constraints under an approved database plan after rechecking zero violations.
