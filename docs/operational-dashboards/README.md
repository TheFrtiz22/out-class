# Operational dashboards

## Workflow audit

The previous overviews interpreted application statuses as pipeline stages, labeled any pending application critical, and repeated navigation links. Club work appeared twice and member announcements were absent. The current floating dock and workspace switcher are retained.

Recruitment uses configured `PipelineRound` records, `RecruitmentCycle` attribution, submitted applications, stable-round submitted evaluations, current panel assignments, booking publication, voting sessions and scheduled communications. Status and round are separate. The schema has no global current-round pointer, round review deadline, or transition history; the dashboard must not invent these. Intake has a real club deadline and enabled flag. Review eligibility is anonymous-review permission or a current identified panel assignment, excluding self review and finalized own evaluations. Applicant details must use CRM's existing allowlist projection and evaluation action.

Daily club work uses assignments, revision requests, server-confirmed submission/review, and task deadlines. Projects are containers, not submittable tasks. Personal obligations include requested revisions; a submitted item is not complete until reviewed. Managers see aggregate submission backlog; members see only their own assignments. Meetings support authorized detail/edit/attendance. Public published events alone support RSVP; ordinary member meetings do not. Announcements are scoped through the current user's notification recipient record, including custom audiences.

Inline: task instructions, files, submit/update, reviewer feedback/approval; applicant preview/evaluation; meeting agenda/resources/edit; announcement content. Drawers reuse existing forms and authorization. Full workspaces remain appropriate for panel planning/publication, live interview execution, bulk applicant progression, voting presentation, and decision publication. These actions require contextual preparation/confirmation beyond a compact overview.

Summary queries are scoped to the authenticated club and user, bounded previews plus database counts. Applicant answers, resumes and evaluations load only on demand. No cross-user summary cache; authorization is checked again before returning. Failed loads are unavailable, never zero activity. Successful domain mutations refresh the overview without navigating or resetting shell state.

## Module contract

| Module | Authoritative source | Available action | Access | Refresh |
| --- | --- | --- | --- | --- |
| Intake and cycle context | Club open/deadline; active RecruitmentCycle records | Refresh; configure in existing workspace | Applicant review/identify; setup requires recruitment management | Private overview read |
| Configured pipeline | PipelineRound + database-filtered active applications | Filter embedded review queue by round | Identified access, or anonymous rounds only | Narrow round-filtered read |
| Personal review backlog | Current round, panel grants, submitted stable-round Evaluation; excludes self and final outcomes | Open permitted applicant, finalize evaluation, next eligible review | Existing CRM canEvaluate and server evaluation guards | Confirmed evaluation response + fresh overview |
| Applicant preview | One application through CRM's existing allowlist projection | Existing profile, responses, evaluation and authorized recruitment controls | Existing anonymous masking, panel/evidence rights and mutation checks | Domain response / scoped CRM refresh |
| Booking follow-up | Current interview-round applicants without a round booking; published/paused flags | Open round scheduling setup | Interview management | Overview read |
| Upcoming interviews | Next six actual bookings within seven days, active identified rounds; managers or own booking-linked panel grants | Prepare in drawer; launch own authorized interview | Identity + interview management or current assignment; launch requires official panel validation | Overview read; canonical coverage and assigned-room reads on demand |
| Interview preparation | Existing interviewBookingCoverage and getAssignedInterviewRooms | Inspect approval/staffing/availability blockers; open existing interview/kit or scheduler | Canonical publication and interview-entry authorization | Each drawer open and explicit retry |
| Voting and decision activity | Unpublished voting sessions and existing recorded application statuses | Join permitted lobby or continue exact session; existing confirmed decision workflow | Review + vote/view/manage; participant/lobby scope; identity restrictions remain | Overview read, then existing voting polling; exact session preserved |
| Offers awaiting response | Current accepted application linked to a live, unexpired pending ClubInvitation | Preview the applicant; existing pending-offer rescind control | decisions.manage + applicants.identify; round anonymity still masks the label | Confirmed offer mutation + overview and scoped CRM refresh |
| Upcoming milestones | Actual intake deadline and scheduled communication dates | Read upcoming dates; manage via existing tools | Decision management/publication and identity for scheduled dates | Overview read |
| Review coverage | Eligible active applicants vs this member's finalized stable-round evaluations | Inspect queue by round | Same review eligibility as queue | Confirmed evaluation + overview refresh |
| Personal obligations | TaskAssignment outstanding/revision requests + ClubTask deadlines | Read instructions/resources; submit/update text/link/files; view feedback and related project tasks | Current assignment owner; existing task submission guards | Server-confirmed mutation + scoped assignment and overview refresh |
| Team submission backlog | Submitted, unreviewed, non-revision-requested task assignments | Existing review form, feedback, approve/request revision | tasks.manage | Server-confirmed review + overview refresh |
| Team work | Aggregate non-draft task assignments | Open existing assignment management | tasks.manage; no member rankings | Overview refresh |
| Meetings | Next four real club meetings within seven days | Agenda/resources; existing edit and attendance actions | Current membership; separate manage/attendance permissions | Existing detail refresh + overview on edit |
| Event registration | Published event at approved revision with RSVP enabled | Existing RSVP/cancellation controls | Existing event registration server checks, capacity and deadline validation | Confirmed RSVP result + overview refresh |
| Club updates | Published announcements joined to this user's notification recipients | Read complete content in drawer | Current club membership and actual recipient scope, including custom audiences | Overview refresh |

## Scope and freshness

The summary is one private `no-store` request, with independent narrow database reads and aggregate queries. It does not fetch applicant answers, resumes or evaluation notes. Previews are bounded: twelve reviews, six bookings, four meetings, four submitted tasks, three announcements, four pending offers and five milestones. Round filtering performs a separate bounded read so a busy round does not disappear behind another round's first twelve candidates. Task details load one task or a bounded project slice, without loading the club roster. The existing legacy overview fields remain available for other callers and visual comparison.

Membership is checked before reading and again before returning the overview/filtered queue. Existing shell authorization scopes clear resources when account, club, grants or privacy settings change. Writes keep all original transaction guards, revision checks, anonymous projections and idempotency. No shared user cache, optimistic completion or new migration is introduced. Refreshing displays a pending state; an unavailable loader replaces the summary with an error and retry, never an all-clear count.

## Deliberate limits

- There is no global current-round pointer, round review deadline, interview-window calendar, scheduled-vote date or application transition history in the schema. The overview names active cycles and shows all current configured rounds. It does not invent a current phase, trends, daily movement, conversion rate or due date.
- A pending review is personalized eligibility, not an invented anonymous-review assignment. Identified reviews require the existing current panel grant; finalized own evaluations are excluded.
- Booking count is not staffing readiness. Staffing, approval and availability checks run through the canonical validator when preparation opens. A booking without approval is explicitly blocked; management permission alone does not grant interview execution.
- Member meetings have no RSVP contract. RSVP controls appear only for published public events that support it. Attendance uses the existing authorized meeting workflow.
- Pipeline planning, official panel publication, live interview execution, voting presentation and final decision publication retain their existing dedicated workflows and confirmation steps. The dashboard supplies context and exact entry points.
- Completion is reviewed assignments / all non-draft personal task assignments. Team metrics use the equivalent club-wide task-assignment denominator. Projects are excluded from these task ratios. Submissions in the past week are activity, not a completion or participation ranking.

## Verification and visual evidence

The dedicated runner is `npm run test:dashboards:e2e`. It creates only `outclass-dashboards-e2e` on localhost ports 59321–59327, with the application on 3115. It uses real verified Supabase sessions, all Prisma migrations, a production Next build, real server mutations, PostgreSQL assertions and authenticated browsers. No application environment file or production credentials are used.

Before captures render commit `2c43f47`'s dashboard components using the same actual local fixture data inside the current shell; these are visual comparisons, not mocked-action verification. After captures and all interaction assertions run against the production application. Evidence covers 1440, 1024, 768 and 390 pixel widths, with WCAG AA checks and horizontal-overflow assertions.


Re-capture the historical comparison with `OUTCLASS_CAPTURE_DASHBOARD_BEFORE=1 npm run test:dashboards:e2e` from a checkout containing commit `2c43f47`. Ordinary verification always captures the current production UI and does not require historical Git objects, so it also works in a shallow checkout.


Final checks (October 22, 2026):

- Full bounded regression suite: 1,353 tests; 1,317 passed, 36 environment-gated skips, zero failures. The dashboard's gated integration scenario ran separately and passed without skips.
- Real verified Auth / production server / PostgreSQL / authenticated browser scenario passed. Includes owner, anonymous-only reviewer, assigned identified reviewer, ordinary member, outsider denial, revoked membership, empty second club, busy filtered round, exact voting-session entry, applicant evaluation and next, task submission and approval, pending-offer preview and rescind with immediate queue refresh, custom-audience updates, meeting preview, RSVP, slow refresh, failure/retry, and concurrent task, evaluation and decision writes.
- Dashboard and applicant-drawer WCAG AA scans passed at 1440 / 1024 / 768 / 390 pixels, with no horizontal overflow. The mobile task submission drawer also passed the overflow check.
- Existing accessibility suite: 27 passed.
- TypeScript passed. ESLint: zero errors, 22 existing hook warnings. Production build passed.
- All 57 migrations applied on fresh and legacy databases; all 78 tables retained RLS and denied browser-role CRUD. No migration added.
- Nine authenticated local summary samples: 41–100 ms; 1,798–5,621 response bytes, including the busy fixture. These are local observations, not a production latency claim.

| Dashboard | Before desktop | After desktop | Before mobile | After mobile |
| --- | --- | --- | --- | --- |
| Recruiting | [1440](evidence/before-recruiting-1440.png) | [1440](evidence/recruiting-1440.png) | [390](evidence/before-recruiting-390.png) | [390](evidence/recruiting-390.png) |
| Club | [1440](evidence/before-club-1440.png) | [1440](evidence/club-1440.png) | [390](evidence/before-club-390.png) | [390](evidence/club-390.png) |

Additional evidence: [applicant action](evidence/applicant-review.png), [mobile applicant drawer](evidence/applicant-drawer-390.png), [mobile task submission](evidence/task-drawer-390.png), [official interview blockers](evidence/interview-preparation.png), [busy round filter](evidence/busy-filtered-round.png), [pending offers](evidence/offer-follow-up.png), [offer preview](evidence/offer-preview.png), and [machine-readable verification](evidence/verification.json). The evidence folder also contains 1024 and 768 pixel captures.

The demo summary implements the live DTO directly and derives review eligibility, round-filtered queues, bookings, votes, pending offers and team task metrics from the saved demo graph. Contract tests exercise every array field and each round’s bounded queue; the design-preview fixture is also rendered through both real overview components.
