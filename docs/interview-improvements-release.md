# Interview improvements release — October 12, 2026

The larger résumé preview, manual timer, earlier-round submitted reviews,
assignment notifications and authoritative round averages are live on
<https://www.out-class.net/>. Existing interview drafts, document snapshots,
annotations, independent scores and permission checks are retained.

## Source and deployment

- Feature: `codex/interview-history-timer-notifications`, implementation
  `66e39ea`, integration/privacy fixes `f53410d`, inbox fix
  `48a57edd524f862f97065638b130f9bb9ec96030`.
- PR #20 merged at `83f26716b76b347df883272a68062cbd978dc919` during parallel
  release work. Its early deployment encountered missing schema. Custom-domain
  promotion was held and a compatible application restored while the approved
  schema/recovery work completed. No database-wide read-only protection was added.
- PR #25 merged through the normal workflow at
  `b6e2818667105ef634819e4972ae388acaca1f40` after staging acceptance and green
  checks. Matching production deployment `dpl_GLNYQfD6ZDJZqCVDn1qCbsFfUiML`
  served `www`; actual independent Auth/SQL/Storage verification passed there.
- Subsequent main work is preserved. The October 12 resumed verification found
  `www` serving READY deployment `dpl_67yZPd8HHYFgK5L56mHG5ndNTyp4`, source
  `ace4710aed8c3846c26c03be824feb54454715fc`, with this release as an ancestor.
  Its interview components, actions, demo adapters and migration SQL are unchanged
  from the verified release. The later CRM diff changes the separate recruitment
  decision transaction, not interview submission/history/aggregation.
- Production environment metadata is unchanged; automatic custom-domain
  publishing is enabled. No maintenance remains active. The existing Vercel
  pipeline owns promotion; do not create a competing production deployment.

## Where to find the changes

- The résumé uses more of the applicant column; click its preview or Expand
  résumé for the existing authorized overlay.
- The interview header contains an own-session timer: Start, Pause/Resume and
  Reset. It starts at zero, pauses in post-interview and resets for a fresh next
  candidate. Reset affects only the timer.
- Earlier rounds is beneath Miscellaneous notes on the right. Current assigned
  later-round interviewers can open the same application's earlier submitted
  reviews. Final question notes come from an immutable submission snapshot,
  never the earlier reviewer's mutable draft. Anonymous contexts deny identifying
  history. Revocation removes access.
- Assignment notices use the existing notification inbox. They include current
  permitted context and Open interview room. Retries do not duplicate notices;
  rescheduling/cancellation and revoked links are checked against current access.
  Existing INTERVIEW email preferences and delivery rules remain in force.
- Round average appears after the interviewer's own submission and in authorized
  applicant/round leadership views. It includes exact canonical submitted scores,
  counts each reviewer once, shows up to two decimals and identifies provisional
  completion. Participating leaders also cannot see peers before submitting.

## Database, backup and recovery

These approved unchanged migrations are applied to staging and production:

1. `20261010190001_reconciled_decision_letters`
2. `20261011180000_submitted_interview_questions`
3. `20261011194930_decision_letter_runtime_access`

The first and third were explicitly approved concurrent-main prerequisites.
The interview migration adds nullable JSONB `InterviewRecord.submittedQuestions`
and a validated constraint requiring a completed record and a bounded array.
It uses a five-second lock timeout. Historical records remain NULL; there is no
private-note backfill, score rounding or historical evaluation duplication.
Old writers may omit the nullable snapshot, so the additive change is compatible.

Staging additionally lacked existing recruitment-offer and communications
prerequisites; those were reconciled with exact SQL/catalog evidence. Production
already had those prerequisites. The separate authorized recovery operation
applied the three pending production migrations through authoritative Prisma
deployment; see [production-auth-recovery.md](production-auth-recovery.md).
This release independently verified all 39 successful ledger entries and SQL
checksums, accepting only LF/CRLF-equivalent source bytes. Actual new constraints,
bounded runtime ownership, enabled RLS, denied anon/authenticated CRUD and absent
runtime schema CREATE/BYPASSRLS were checked on production. No applied SQL was
edited, false history registered, database reset, db push or archive replay used.

A certificate/hostname-verified consistent production public/Auth/Storage-schema
dump was restored to disposable loopback PostgreSQL. All 66 application-table
counts/content digests and the ledger matched; SHA-256
`788c2f39eb4a63469ac2adf33203a615f5dfdd7a17e9f1112bc98db386696858`.
The separate recovery rehearsal restored an encrypted public-schema backup and
applied these exact migrations while preserving existing table content. Provider
backup availability is documented in that receipt. Neither exercise certifies a
full hosted Auth/Storage disaster restore or a new backup of Storage object bytes.

Application rollback: restore a previously verified compatible READY deployment
through the existing Vercel promotion mechanism, retaining the additive schema.
If production has accumulated new data, do not reverse migrations/drop columns
or restore a database over it. Stop promotion, inspect the actual schema and use
a separately reviewed data-recovery plan. The current release needs no further
production migration or credential rotation.

## Verification evidence

| Check | Result |
| --- | --- |
| PR #25 required CI, run `38196808525` | 1,000 tests: 986 passed, 0 failed, 14 environment-gated skips |
| Migration checks | All 39 migrations on fresh/legacy disposable databases; 66 protected tables |
| Type checking and production build | Passed locally and in required CI |
| Lint | Passed: 0 errors, 28 existing warnings |
| Focused authorization/SQL/demo/timer tests | Passed, including exact 7.75, dedupe, own-before-peer, snapshots and revoked inbox projections |
| Isolated hosted preview | `out-class-hjv08vwha-outclassuva.vercel.app`, revision `48a57ed`; staging Supabase `omfcozcbpmevwolshibh`, branch-only Auth/DB/Storage configuration |
| Hosted staging acceptance | Two real Auth accounts, independent drafts, private PDF, concurrent shared notes, immutable submissions/history and current access passed |
| Hosted production acceptance | Actual Auth, database and private Storage, two independent synthetic interviewers; passed on `www`, production project `htlgjluegmdwfjkzzwic` |
| Newer live deployment read check | Actual authenticated earlier snapshots and exact 7.75 average persist; actual deployed worker/assets load |
| Live Demo | Existing saved state opens without clearing browser data; preview expansion/ESC focus return retain notes; post-interview starts unscored; Home chooses 1, Right chooses 1.5; reload retains closing notes/score |
| Responsive rendering | Laptop 1365×768 and narrow phone 391×844 CSS viewport checked; no horizontal overflow; mobile stacking and completed-question link retained |
| Current production logs | One-hour sample on `dpl_67yZPd8HHYFgK5L56mHG5ndNTyp4`: zero returned error/fatal requests |

Hosted checks used only an undiscoverable explicitly synthetic club and synthetic
actors; no real applicant reviews or real-club leadership grants changed.
Synthetic email preferences were off. No test notifications were sent to real
interviewers. Hosted email delivery and physical touchscreen testing are not
claimed. Environment-gated CI skips are not counted as passes.

The staged browser also verified timer Start/Pause/Reset and reload, middle-only
post-interview transition, independently confirmed submission, exact previous-five
scope and fresh-next-candidate state. Demo adapters exercise browser-isolated
fixtures; their regression checks make zero live database calls for fictional IDs.
The actual two-account hosted checks are separate evidence, not Demo evidence.

An actual hosted inbox failure (`P2028`, a five-second transaction deadline)
was fixed before PR #25: current-scope prefilters and per-request context reuse
reduce repeated checks, while the transaction uses the existing bounded interview
budget. Full current authorization remains mandatory; revoked notices expose no
identity or usable link. Affected SQL/notification tests and hosted staging were
rerun successfully before production.

Private receipts and screenshots are under the existing Windows-account-protected
`%LOCALAPPDATA%\OutClass-staging-verification` directory. They contain no plaintext
credentials in Git. The full hosted receipt is
`interview-improvements-production-hosted-full.json`; the resumed read receipt is
`interview-improvements-production-hosted.json`.

## Limits and owner setup

- Timer persistence is browser-local for the actual user/interview; it does not
  synchronize across devices.
- Legacy reviews without a finalized-question snapshot show legitimately
  submitted closing content, not old private drafts. New submissions preserve
  their final question evidence.
- Owners should use Interview access setup/membership access to grant real
  requested offices and panel assignments. Existing ADMIN labels do not silently
  become president/vice-president. No real assignments were invented for release.
- A candidate must advance and have a current later-round panel assignment for
  earlier history. Completion counts include current active assignments plus
  preserved submitted evidence; missing scores never become zero.
- Physical touch, new hosted email delivery and full provider disaster recovery
  remain unverified. Existing PDF highlighting/replacement protections remain
  covered by prior valid evidence and unchanged regression checks; this release's
  new hosted PDF check exercised pinned downloads and concurrent general notes.
