# Integrated workspace release

## Baseline and merge resolutions

Work began at `625def62abd79f138493db4f1ae3d3b5e8c90164` on
`repair/workspace-reliability`. Main's first three commits were `9a3b3db`
(availability), `661a2ff` (panel proposals), `e8f33ec` (official panels).
Merge `ffa3eaf` retains the feature branch and main as parents. Textual resolutions:

- `prisma/schema.prisma`: retain both sets of relations, fields and models.
- `lib/notification-email.ts`: retain main's panel signatures/destinations and
  the validated optional-letter decision destination, neutral wording and digest CTAs.
- `tests/club-suspension.test.cjs`: retain transaction wrapper mocking plus recursive
  utility loading, preserving actual suspension/authorization assertions.

Main then advanced to `b4a9efa10f1f0ea2bc269907fd28bc5ea6871dbc` through
`2ec1282` and `b4a9efa` (availability collection/recovery and scheduling UX).
It was integrated with a second normal merge, without rebase/force-push.
Clean overlaps in communications, workspace API, notification worker, schema,
application reads and organization/interview commands were reviewed. Current
availability-request access suppression and signed panel delivery context remain;
retired messages remain denied. Existing reliability, session-bound Admin elevation,
audiences, announcement/decision scheduling, formal letters, rejected history,
reconsideration, offers/membership and recruitment cycles remain present.

## Complete producer/composer audit

This table inventories actual send surfaces and event producers, not hypothetical
emails. Inbox means canonical UserNotification; optional canonical email means the
shared outbox/worker applies channel preferences and digest timing. Mandatory Auth
traffic is not optional club communication.

| Producer / source | Composer / action | Channels | Scheduling / exclusion |
| --- | --- | --- | --- |
| Announcements (`actions/communications.ts`) | Club Announcements | Inbox + optional canonical email | Send now / Schedule; fixed or send-time audience; edit/cancel. |
| Direct final decisions (`actions/crm.ts`, canonical offer publisher) | Applicant/Decisions drawer | Status + optional immutable letter + inbox + optional neutral email | Send now / Schedule; reviewed content/settings frozen; atomic execution. |
| Voting final decisions (`actions/voting.ts`) | Completed voting review | Same as direct decisions | Send now / Schedule; at most 50 selected applicants, explicit review; atomic whole job. |
| Reviewed roster invitation emails (`actions/invitation-emails.ts`) | CSV review InvitationEmailControls | Existing InvitationDelivery SMTP email | Send now / Schedule; fixed reviewed import selection, max 50. Creating/importing invitations does not send email. |
| Individual invitation resend | Members invitation menu | Existing InvitationDelivery SMTP email | Send now / Schedule; max 50 generic pending selections or individual resend. Existing QUEUED/SENDING emails cannot be postponed by a new schedule. |
| Existing queued invitation processing | Send queued invitations / internal worker | SMTP email | Drain request, not a new message composer. Does not rewrite timing/history of existing queued messages. New schedules enter the same delivery queue only when due. |
| Availability collection requests (`actions/availability.ts`) | Interview Scheduling → Availability → Collect availability | Inbox + optional canonical INTERVIEW email | Send now / Schedule; fixed selected eligible interviewers, max 50. No early request/participation/notification writes. |
| Availability reminders | Same Collect availability area | Inbox + optional canonical INTERVIEW email | Send now / Schedule. Response/decline and 24-hour cooldown reevaluated at execution; zero remaining eligible notices is a truthful published count of zero. |
| Application submission / non-final stage transitions | Student submit / leader round/status command; SQL trigger | Inbox + optional APPLICATION/INTERVIEW email | Immediate operational consequence of the committed application state, not a standalone send composer. Cannot delay interview eligibility/booking notices separately. Final decisions use the explicit atomic scheduler above. |
| Interview booking/rescheduling/cancellation | Student/leader booking controls; SQL trigger | Inbox + optional INTERVIEW email | Immediate schedule-change confirmation; delaying notice independently could conceal the current appointment. |
| Interview assignment/revocation | Interview access/member assignment controls | Inbox + optional INTERVIEW email | Immediate access change; current access is rechecked at inbox/delivery. No independent send/reminder composer. |
| Official panel publication/replacement | Owner Review & Publish approval | Inbox + optional signed INTERVIEW email | Immediate consequence of an approved operational schedule; approval, grants, bookings and notices remain synchronized. Delayed panel approval is a separate business-command feature, not a delayed email switch. |
| Task assignment | Task publish/assign controls; SQL trigger | Inbox + optional TASK email | Immediate consequence of a published assignment. No standalone task-send/reminder composer exists. |
| Task review / revision request | Reviewer feedback controls; SQL trigger | Inbox + optional TASK email | Immediate response to saved review/revision; do not hide time-sensitive feedback behind an independent send timer. |
| Offer accept/decline | Student offer controls | Membership/offer result + inbox + optional OFFER_RESPONSE email | Immediate transactional receipt. Never delay or replay acceptance, decline or membership to schedule its receipt. |
| Invitation creation/claim/revocation | Member/owner access workflows; SQL trigger | Inbox; duplicate canonical invitation email suppressed | Immediate access-state event. Optional invitation SMTP sends above are separately scheduled; creation/expiry/claim is not postponed. Recruitment offers retain their canonical decision/response path. |
| Admin student claim/resend and school/owner onboarding | Elevated Admin account/access controls | Auth invite/claim SMTP email | Immediate security/account access, requires current fresh Admin verification. No deferred Admin authority; a global Admin without live club membership cannot schedule club sends. |
| Verification, sign-in recovery, reset, MFA and logout/security | Supabase Auth / Admin sign-in | Provider Auth/security channels | Mandatory immediate security/authentication messages; excluded from optional scheduling. |
| Corkboard/events/RSVP and profile publication | Event/appearance/profile editors | Persisted content; no separate email/notification send producer in these paths | No existing send composer to schedule. Announcements may deliberately target event/lead audiences using canonical channels. |
| Direct conversations/messages | Retired message actions | None | Remain rejected; scheduling does not reactivate them. |
| Notification preferences, digests and retries | Inbox preferences / delivery workers | Canonical email delivery | Recipient-selected timing / technical retry, not a user-authored publication composer. Preserved independently of publication scheduling. |
| Demo | Demo adapters | Isolated browser data | All new live scheduling actions reject Demo; no live delivery. |

## Added scheduling handlers and safeguards

Invitation scheduling reuses ScheduledCommunication and the existing InvitationDelivery
worker; it creates no new messaging system. Selection snapshots contain server-only
invitation IDs and immutable-recipient/grant/expiry fingerprints. Club membership,
`members.manage`, per-invitation role/capability grant scope, operational club, recipient
state, expiry and existing queued delivery are rechecked transactionally. Support
impersonation cannot mint future authority. No Admin elevation is deferred. Due intent,
delivery enqueue and audit commit atomically; no SMTP/provider call occurs there.
Published means dispatch queued, never sent. Existing delivery cooldown, quota,
preferences, ambiguous-send handling and idempotency remain authoritative.

An explicit `COMMUNICATIONS_EMAIL_ENABLED=false` now also pauses optional invitation
SMTP processing before provider configuration is read; it preserves QUEUED rows.
Undefined retains the prior invitation setting for compatibility. No production
variable was changed and no provider test email was sent.

Availability requests/reminders share the immediate transaction's publication helper.
Live sender permission, active interview round, eligible selected member IDs and
account state are rechecked. Responded/declined members and premature reminders are
skipped at execution. Participation revision/sequence, canonical notification/outbox,
audits and durable completion commit together. Immediate support-attributed requests
use the established clubWriteTransaction, validating provider proof before acquiring
business locks and live support authority inside the transaction. Its prior 20s
execution bound is retained; scheduled requests use the existing 12s worker bound.
No authority, RLS, anonymous-review or provider-session bypass was introduced.

All schedules use explicit IANA zone and repeated-hour choice, reject missing clock
hours, require 1 minute–366 days future, retain cancellation/history, and never treat
selection as permission to contact a disabled/ineligible recipient. Announcements
alone support send-time rule evaluation; decisions, invitations and availability use
fixed reviewed targets. New handlers edit by cancel-and-reschedule, with stable
request IDs for response-loss retries. PROCESSING/PUBLISHED work cannot be edited
or cancelled. Reviewable FAILED intents do not automatically resend.

## Scheduler operations / capacity

Repository `vercel.json` invokes `/api/internal/scheduled-communications` every minute.
GET/POST use constant-time `Authorization: Bearer CRON_SECRET` verification, fail
closed if unset, node runtime, maxDuration 60s, no-store responses. Existing invitation
and canonical delivery crons remain. Publication is independent of email enablement.
Production activation is pending release; this is repository/local invocation evidence,
not a claim that the unshipped endpoint is running on the host.

Candidate selection now has its own 3s statement / 4s transaction / 1s acquisition
bounds. It selects at most two candidates per club, ranks clubs least recently
serviced, scans up to 16 candidates past locked clubs, and admits no more than two
claims. The 15s admission window includes selection time. Busy clubs cannot occupy
both candidate slots indefinitely; a native test holds the oldest club locked and
verifies another club publishes two jobs while the locked work remains untouched.

Claim: 4s transaction / 1s acquisition / 1s lock / 3s statement. Publication: 12s
(announcements, invitations, availability) or 20s (decisions), 2s acquisition/lock,
8s statement. Failure marking: 4s / 1s acquisition/lock / 3s statement. Claims fence
by revision and expire after two minutes. Crash-before-commit rolls back business
writes; expired claims recover. Crash-after-commit sees PUBLISHED and never replays.
Caught failures roll back all business writes and mark only the owned revision with
benign PUBLICATION_UNAVAILABLE; marker failure leaves a recoverable lease.

Capacity is deliberately global, not two jobs per club: at most 2 intents/minute,
sometimes one when the first exceeds the admission window. A 100-job backlog can
therefore take 50–100+ minutes plus contention/other clubs. This is not a precise-time
or high-volume broadcast SLA. All kinds count SCHEDULED/PROCESSING/FAILED against the
club's 100 queued-work cap; managers see all queued jobs and bounded completed history.
Operators should monitor due age, FAILED jobs, stale PROCESSING leases and route
503s. Read-only backlog query (no recipient data):

```sql
SELECT kind,status,count(*) AS intents,min("scheduledAt") AS oldest_scheduled,
       min("updatedAt") AS oldest_update
FROM "ScheduledCommunication"
WHERE status IN ('SCHEDULED','PROCESSING','FAILED')
GROUP BY kind,status;
```

Scheduled decisions reject >50 candidates or >500 ballots per selected latest-pass
candidate; fetches exclude unrelated candidates/history. Native final measurement:
50 mixed outcomes with 10ms ORM delay, **9,821ms / 728 operations**, under 20s.
50 availability requests: **2,238ms / 162 operations**, under unchanged 12s.
These are local simulated-latency measurements, not hosted throughput guarantees.
Whole-job state/authority conflicts fail atomically, never silently overwrite decisions.

## Exact pending production migration order

Read-only production ledger: project `htlgjluegmdwfjkzzwic`, **43 completed entries**,
no unexpected migration names. All source checksums match, allowing four verified
historical LF/CRLF equivalents; no ledger mutation or migration replay occurred.
Current main's availability, panel and collection migrations are already applied.
Exactly these eight branch migrations remain pending, in lexical Prisma order:

1. `20261012171752_admin_session_bound_elevation`
2. `20261013002253_recipient_audiences`
3. `20261013005624_scheduled_communications`
4. `20261013014837_decision_letter_controls`
5. `20261013014950_recruitment_cycles`
6. `20261013015200_scheduled_decisions`
7. `20261013140024_scheduled_invitation_emails`
8. `20261013141510_scheduled_availability_requests`

**Migrations before application code/cron activation.** Use the existing approved
operator Prisma deployment path (`npm run db:deploy`), with independently verified
production identity and backup in the separately authorized release window. Do not
put operator credentials in application runtime. No reset, resolve/mark-applied,
history rewrite or production application of these migrations occurred here.
New code requires the nullable Admin expiry and the new tables/columns; deploying
code first causes query failures and prevents the new workflows from operating.
Main merge automatically deploys production, so a draft PR is not release authorization.
Old serving code can remain during the additive migration step; verify before merging.

## Migration / regression evidence

`node scripts/test-decision-publication-local.cjs` creates a dedicated native PostgreSQL
instance with actual bounded runtime role, applies the complete **51-migration**
history with Prisma, and runs 64 non-gated checks: 8 invitation, 7 availability,
15 decision/cycle, 16 audience and 18 announcement scheduling. It also tests:

- Current-production-equivalent 43→51 upgrade through actual Prisma deploy/status,
  with the four source copies encoded CRLF to reproduce the live ledger. The earlier
  Admin migration is discovered despite later panel/collection migrations already
  being applied. No manual ledger entries or history rewriting.
- Populated integrated pre-controls→current upgrade preserves immutable letters,
  answers/evaluations, queued announcement intents, groups, preferences and members.
- Production-equivalent fixture preserves old Admin expiry/revocation state, stored
  availability/collection reminder data, membership cohorts/groups, preferences,
  letters and existing INTERVIEW notification/outbox rows.
- Bounded ownership, restrictive RLS and browser denial verified for new private
  tables and main availability/panel tables. No schema CREATE expansion.
- Native concurrency, cancellation, crashes/lease recovery, retries, rollback,
  disabled accounts, revoked permission, archived rounds, scope/isolation, zero
  early outcomes, queue preservation and 50-recipient measured capacity.

`npm run test:migrations`: all 51 migrations on fresh/legacy PGlite; all 74 protected
tables enforce browser CRUD denial. These are additional schema/security checks,
not a substitute for the native Prisma tests above.

Integrated full suite: **1,062 passed, 24 gated skips, zero failures (1,086 total)**.
The native checks above run separately, not counted as those skipped passes.
Existing real PostgreSQL transaction repair suite: **31 + 26 passed**.
Loopback Supabase Auth/Storage + built Next actions: decisions/private assets 7,
audiences 5, announcement scheduling 5, Admin sessions 12, invitation/availability
scheduling 5: **34 passed**, no skips/failures. No outbound provider was invoked.
TypeScript, Prisma validate, production build, migration-path and diff checks passed.
Lint: zero errors, 28 existing warnings. Evidence logs use `/tmp/outclass-integrated-*`.

## Browser QA and hosted limitations

Authenticated local Chrome desktop and 390×844 mobile QA covers new invitation
composer/preview/manager and availability request/reminder schedule/manager, keyboard
segmented datetime entry, explicit repeated-hour selection and cancellation. The
same New York 2026-11-01 01:00 LATER resolved to 06:00Z. Mobile width remains 390px
without horizontal overflow. Evidence lives in `/tmp/outclass-integrated-qa/`.
Existing decision controls, letters, rejected retention/cycles and audience workflow
QA/print evidence is preserved at `/tmp/outclass-decision-qa/`. Actual authenticated
print PDFs (Acceptance/Waitlist/Rejection; long multiline content/private logo) passed
before integration; PDFs were not rerun after integration, and are not claimed fresh.

Hosted cron activation, provider email/digest delivery and hosted throughput remain
unverified. The provider owner is required for controlled hosted email verification;
email remains disabled. Physical mobile devices/printers were not tested. Older broad
Admin/club-assets runner has a different fixture/port contract and remains gated;
current Auth/session/private-asset integrations passed separately. Newly integrated
main browser scripts were not run as headless automation; affected UI was checked
through the authenticated browser. CI/Vercel results must be distinguished from local
passes. No production deployment, database/queue/preference changes, main merge or
outbound enablement is performed by this preparation.

## Release manifest

`workspace-release-manifest.txt` lists the exact diff against main
`b4a9efa10f1f0ea2bc269907fd28bc5ea6871dbc`, including these reports and all earlier
branch features. The five credential-recovery files retain their original SHA256,
remain untracked/unstaged, and are excluded. Temporary fixtures, screenshots, PDFs,
logs and credential-bearing files are excluded.
