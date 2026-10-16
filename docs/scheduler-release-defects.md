# Scheduler release defects

Branch: `repair/scheduler-release-defects`, based on current main
`c0f74488ad65f0e2767e421bd1bdf9daca079e6f` (2026-10-15).
No migrations, environment changes, membership grants, deployment or merge.

## Demonstrated autosave cause and repair

The retained synthetic announcement's retry made a real POST to
`/club/c5c25e15-55c0-4ae0-ab0f-d992790c64f3/workspace`, returning **500** at
2026-10-15 16:18:51.352 EDT. Request
`cgghm-1792095531352-433acaa29496`, deployment
`GFDj2LPQ8wVbh8BuxvNymzSRssx5`, execution 1.50s. The retained browser's
server action went to its original artifact; the failing statement is identical
on current main. Sanitized server evidence: `PrismaClientKnownRequestError`,
`P2010`, failed to deserialize PostgreSQL type `void`, digest `1394101650`.

`saveEditorDraft` selects `pg_advisory_xact_lock`, whose return type Prisma 6.19.3
cannot deserialize. PGlite's adapter tests did not exercise Prisma's wire-type
decoder. Announcement publication calls `draftSave.flush()` first, so it correctly
stops rather than losing the private draft or bypassing persistence.

Cast that function's **result** to `text`. The same transaction-scoped lock and
account/scope key remain. Authorization, revision conflicts, mutation-ID retry,
tombstones, draft isolation, the 850ms debounce and domain commit boundary are
unchanged. Native regression runs the original statement as a negative control
(P2010), then the actual repaired action, reload, first-create concurrency,
lost acknowledgment and authorization denial checks.

## Historical pre-claim P2028: not claimed fixed

Actual cron request `p45dq-1792078903489-6c3b54763522` on deployment
`3qP7dw5xmbv7nCb7SDkzH34XptEh` started 11:41:43.489 EDT. Two claim-stage
P2028 events occurred at 11:41:44.530 (+1041ms); response **503** after 2816ms.
No claims or publications; one no-candidate deferral; due count zero.

The old diagnostic records only the outer stage and Prisma code. Missing:
callback-entry timestamp, acquisition duration, last query/step, SQLSTATE,
transaction age and contemporaneous pool occupancy/connection-start timing or
database blocker samples. The exact deployed connection limit is not established
by the retained evidence; an optional recovery URL is not runtime proof.

The claim callback consists of bounded SQL and a claim update. No provider Auth
HTTP runs on the no-candidate cron path: it never reaches publication or the ORM
mutation/support wrapper. Ordinary Club lock conflicts use SKIP LOCKED. An actual
advisory lock wait is a separate SQL timeout, not proof of pool exhaustion.

Actual PostgreSQL/Prisma reproductions distinguish:

| Controlled condition | Result | Measured evidence |
| --- | --- | --- |
| Occupied one-connection pool | P2028 before callback | ~1002ms acquisition, transactionMs null; next invocation recovers |
| Three claim lanes sharing one slow connection | Two P2028 + one ordinary deferral | ~1002ms for both acquisition failures; no SQL lock wait |
| Held scheduler advisory lock | P2010 / SQLSTATE 55P03 | ~1ms acquisition, ~1006ms transaction/lock wait |
| Injected delay after callback entry | P2028 transaction expiry | ~1ms acquisition, ~4204ms transaction; rollback |

Acquisition contention is consistent with the historical timing and signature,
but not proven to be its production cause. No timeout, capacity, retry, privilege,
fencing, fairness or publication behavior is changed on that hypothesis.

## Bounded recurrence diagnostics

Claim failures now include a fixed phase (`acquisition`, `configuration`,
`advisory_lock`, `capacity_scan`, `candidate_scan`, `intent_lock`, `claim_update`,
or `commit`), acquisition/transaction/current-step/elapsed milliseconds, and the
unchanged maxWait=1000ms/timeout=4000ms. Durations cap at 60000ms; transactionMs
is null before callback entry. Only validated Prisma codes and SQLSTATE are
extracted. No raw message, stack, SQL, recipient, club/user ID, token, cookie,
password, URL or arbitrary error metadata is logged. Logging remains best effort
and cannot replace failure handling. No new diagnostic query consumes a pool slot.

An acquisition-phase recurrence still requires correlated pool/connection-start
evidence to distinguish local pool saturation from database/pooler connection
startup or availability. An in-callback recurrence identifies the last operation;
55P03/57014 distinguish lock/statement cancellation. Request grouping supplies
deployment and timestamp without adding personal identifiers to events.

## Validation rerun

- Focused autosave/scheduler/browser: **23 passed**, including actual React
  debounce at 849/850ms, slow saves/caret, mobile, retries, offline retention,
  reload, tab conflicts, publication cleanup and navigation.
- Dedicated PostgreSQL: **5 polling/security + 57 native checks passed**,
  including **8 new release-defect checks** and existing mixed-club/50-applicant,
  cancellation, revocation, crash/lease recovery and rollback cases. Three jobs
  progressed under sustained polling. All 53 migrations deployed; Prisma status
  up to date; populated preservation check passed.
- Full suite: **1174 passed, 26 gated skips, zero failures**. Native tests are
  gated in the generic suite and passed separately above.
- TypeScript, production build, Prisma validation, diff checks passed. Lint:
  zero errors, 28 existing warnings. Migration security: 53 fresh/legacy
  migrations, 76 tables enforce RLS/browser CRUD denial.
- Real local Supabase Auth + production Next HTTP: actual draft save/reload,
  retry/conflict, zero early publication; concurrent voting/publication;
  exactly one notification/outbox intent. Private server Storage upload and
  authenticated browser-role write denial passed. Final clean fixture flow:
  174ms, one publication, zero failures/claim errors.
- Rendered authenticated Chrome: typed draft reached Saved, survived page reload,
  recipient preview one synthetic user, keyboard Tab/Enter and timezone-resolved
  schedule confirmation saved successfully. Screenshot retained. Native browser
  window became unavailable during cancellation confirmation; the same isolated
  intent was cancelled through the supported authenticated server action.

An initial run lacked current main's newly declared local browser dependency;
frozen pnpm install resolved it. A native run overlapped dependency replacement
and was aborted after a capacity-fixture failure; the complete rerun passed.
Initial Prisma validation lacked DATABASE_URL; rerun used an explicit disposable
localhost URL. These initial failures are not counted as passing checks.

Evidence stays outside Git: `/tmp/outclass-release-defects-*.log`,
`/tmp/outclass-release-defects-evidence/`, and
`/tmp/outclass-pr34-hosted-evidence/`. Successful hosted decision publications
(48.168s, 49.845s, 49.902s late) and both cancellations remain preserved.

## Hosted announcement rehearsal after authorized deployment

1. Verify the serving repair SHA and explicit outbound-email false flag, including
   invitation delivery. Snapshot existing queue/preferences; do not replay them.
2. Keep the authorized synthetic club's Voting modal polling. Reopen the retained
   announcement (do not discard its text); confirm Saved and reload recovery.
3. Preview the existing controlled self-only group (exactly one), choose a new
   future America/New_York time, confirm schedule through the composer.
4. Record no early announcement/notification/outbox; capture actual cron request,
   sampled claim phase, publication timestamp/lateness, exactly one canonical
   announcement/notice/outbox and zero duplicate on later invocations. No manual
   hosted worker call. Record polling errors/gaps honestly.
5. Cancel a separate synthetic schedule, verify after due, monitor due age,
   expired leases and the new diagnostics for at least 15 minutes.

This PR does not perform that deployment or hosted rehearsal. Historical P2028
remains an open operational finding. Cross-club progress and invitation claim
remain independently pending normal mailbox verification/current membership;
the platform creator has no implicit club scheduler access. Hosted email remains
unverified and requires the provider owner. Global email stays disabled; real
data/preferences/queues and synthetic history remain intact.

## Exact commit manifest

- actions/editor-drafts.ts
- lib/scheduler-claim-diagnostics.ts
- utils/scheduled-communications.ts
- tests/scheduler-diagnostics.test.cjs
- tests/scheduler-release-native.test.cjs
- scripts/test-scheduler-polling-local.cjs
- docs/scheduler-release-defects.md

No migrations. All five untracked credential-recovery files excluded and unchanged.
