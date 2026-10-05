# Closing review implementation and release handoff

October 5, 2026. Implements the final workflow in [the contract](interview-room-redesign.md), using the existing interview records and canonical Evaluations. Production migrations and deployment remain pending explicit authorization.

## Completed behavior

- End interview (including form/keyboard submission) opens a discussion draft. It neither assigns a score nor submits, advances an applicant, changes membership, or ends another panel member’s interview.
- Questions the applicant asked and Additional notes use the existing per-interviewer persisted draft. Autosave and manual submission use the acknowledged revision; final submission reads the latest draft reference. Server finalization remains transactional with audit, stable round identity, canonical Evaluation linkage and exact retry handling.
- Overall score uses an accessible native horizontal range slider, 1–10 with step 0.5. Its visual initial position is 1, but the persisted value remains null and announces Not scored until interaction. Pointer/touch release and supported keyboard keys also acknowledge an unchanged endpoint; focus/Tab alone does not score. Submitted values are rendered as read-only text.
- History is above the slider, with read-only applicant/score cards, loading, retry and empty states. The server derives the reviewer, uses stable club/round scope, applies current access/privacy, excludes the current application and unfinished records, and orders newest first with a deterministic ID tie-break. Historical values are displayed without rounding.
- Save and finish requires scoring, freezes final submission, rejects double clicks, and sends the latest text. A failed request retains text and exposes Retry save and finish. An interrupted successful response can retry the identical final payload/revision without duplicating the evaluation. Refresh revision after submission locks controls; local recovery text is explicitly described as unsaved, not the canonical final review.
- Interview management adds Submitted reviews for explicit active PRESIDENT, VICE_PRESIDENT and BOARD grants. Discovery returns metadata only; opening returns closing fields only. Both current and recorded anonymous rounds are excluded on the server. Past-round reviews remain available under current authorization. There is no edit, unlock or resubmit control. Selection and visible content clear on failed access checks; reads refresh on focus and every ten seconds while visible. Résumé moderation remains a separate president/VP capability.
- Recruiting decisions retain the existing server anonymization/reveal rules. No automatic free-text anonymization was introduced. Leadership review responses contain no private question notes, résumé paths, files or scholarships.

## Changed files in this stage

| Files | Changes |
| --- | --- |
| `components/interview-kit-session.tsx` | Deliberate nullable slider scoring, exact endpoints, latest-draft submission, final retry, locked recovery, history cards and submitted-state copy. |
| `components/interview-submitted-reviews.tsx`, `components/interview-management-tabs.tsx` | Explicit leadership discovery and read-only closing review, including past rounds and access-loss clearing. |
| `actions/interview-kits.ts` | Narrow, authorized submitted-review discovery with deterministic order and server-side anonymity/club/applicant exclusions. |
| `lib/workspace-api.ts`, `lib/demo/interview-foundation.ts` | Isolated demo adapter and matching leadership projection/access rules. |
| `tests/interview-session-ui.test.cjs`, `tests/interview-kits.test.cjs` | Endpoint scoring, keyboard/touch handlers, discussion, final autosave races, double clicks, failed/lost-response retry, server concurrency and narrow leadership permissions. |
| `tests/interview-journey.test.cjs`, `tests/interview-submitted-reviews-ui.test.cjs`, `tests/resume-viewer-ui.test.cjs` | Synthetic integrated journey, exact historical decimals, access loss, immutable leadership controls and management office visibility. |
| This document | Verification evidence and deployment gates. |

Previous-stage files and unrelated existing dependency changes remain in the working tree. No applied migration was edited. This stage adds no migration.

## Verification and limits

Synthetic action/demo fixtures cover scholar profile save without clearing résumé/experience, narrow panel data, preserved questions after kit edits, independent panel completion/private notes, shared annotations with peer edit denial, original document after replacement, discussion with null score, independent half-point submissions, exact final retries, previous-five after completion, leadership past-round reopening, anonymous transition exclusion and zero live action calls. Existing negative tests cover outsiders/applicants/revocation, cross-club/round/document scope, annotation conflicts/moderation history, anonymous decision payloads and alternate evaluation/admin paths. Disposable database tests enforce final update/delete/unlink/reset protection and preserve historical 8.25 scores.

| Check | Evidence |
| --- | --- |
| `npm test` | 526 total, 524 passed, zero failures, two existing external-service skips. |
| `npm run test:migrations` | All 22 migrations applied on fresh and legacy isolated PGlite; all 47 tables enforce RLS and deny browser-role CRUD. No connection URL or hosted target used. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Zero errors, 30 existing warnings. |
| `npm run build` | Passed; production pages generated and build traces completed. Temporary acceptance route absent from the production route list. |
| `git diff --check` | Passed; Git also reports existing LF/CRLF normalization notices. |
| Local Chrome | Fictional scholar panel, private draft through résumé overlay/Escape, saved question completion, discussion without scoring, Home=1 with unchanged thumb, End=10, half-point arrows to 8.5, draft refresh recovery, final submission and locked reload, leadership closing-only read. At 390px, columns stack without horizontal overflow and keyboard focus reaches Save and finish. Temporary fixture route was removed. |

Actual touch-device gestures and browser network-failure injection were not tested: pointer/touch handlers and save failures were exercised in component tests. Two-interviewer concurrency and résumé replacement were exercised with synthetic action/demo fixtures; the prior résumé stage separately verified shared-browser annotations and zoom. The browser acceptance check uses local demo data, not hosted authentication or real applicant documents. A browser double-click attempt lost its tab binding before confirmation; no browser double-click claim is made. Automated component and server tests verify that behavior.

Native PostgreSQL lock scheduling and hosted Supabase Auth/MFA/Storage remain untested here. Two existing service-dependent tests are skipped. PGlite validates SQL but cannot substitute for staging concurrency/auth/storage rehearsal. The new leadership list shows the latest 100 reviews and has no pagination. Already downloaded résumé bytes cannot be recalled after access revocation; subsequent server reads/writes/downloads are reauthorized and active viewers clear on access failure. Format support and PDF.js Apache-2.0 asset/dependency requirements remain as documented in [the résumé handoff](interview-resume-ui.md).

## Pending migrations and release order

The contract’s October 4 metadata inspection reported production ending at `20261002010000_onboarding_security`. This is historical evidence, not a fresh live migration audit. If that history is still accurate, the exact pending chain is:

1. `20261003000000_applicant_intelligence` — applicant display/observations and evaluation linkage.
2. `20261003010000_durable_voting` — durable voting sessions/participants.
3. `20261003020000_corkboard` — persisted corkboard.
4. `20261003030000_task_workflows` — additive task workflow fields/constraints.
5. `20261004000000_interview_foundation` — scholar SQL validation, explicit offices/panels, stable Evaluation round/submission fields, preserved résumé byte snapshots, annotations and append-only revision history; SQL scope/revision checks, immutable-final/snapshot guards, new-score half-step validation, membership revocation, RLS and browser-role grant denial. Historical score values are preserved. See [the exact SQL](../prisma/migrations/20261004000000_interview_foundation/migration.sql) and [foundation details](interview-room-backend.md).

No résumé-viewer or closing-review migration follows that chain. Do not replay the archived Supabase migrations, edit applied Prisma SQL, reset a database, use db push to reconcile drift, or mark an unknown migration applied to suppress a mismatch.

Deployment checklist (not executed):

1. Pin the reviewed release commit and reproduce dependency installation from `pnpm-lock.yaml` on Node >=22.13. Generate Prisma client and bundled local PDF worker/CMap/font assets; run tests, typecheck, lint and build on the release artifact. Inspect packaging and the PDF worker/CSP/tracing paths.
2. Verify live Prisma migration history/checksums and catalog constraints/indexes/grants/RLS using authorized metadata reads. Independently review the four earlier feature migrations. Resolve drift or ambiguous legacy Evaluation provenance deliberately, retaining historical scores and evidence. Do not infer office holders from ADMIN roles or titles.
3. Provision or reactivate an explicitly authorized disposable native PostgreSQL/Supabase staging target. Verify its project identity, host, database and isolation before any mutation; do not use production URLs. Rehearse the exact ordered chain on fresh and representative legacy data, including ambiguous mappings, 8.25 scores and completed interviews.
4. Take an encrypted database backup covering snapshot bytes, audits and annotation history, plus the required private-storage backup. Restore into a separate disposable target and verify integrity, résumé hashes/versions, immutable historical reviews, constraints and RLS. Record restore duration, recovery point and a tested recovery procedure before approval.
5. In staging, test real Auth/MFA, trusted database-role permissions, private Storage capture and the scoped no-store/range résumé proxy. Use two browser accounts to race autosave/finalization and annotation edits; revoke grants mid-session. Test score endpoints on real touch hardware, anonymous decision projections, old-round leadership reads, refresh recovery, asset loading and storage replacement. Confirm no production calls from demo.
6. Obtain verified office mappings and owner-managed explicit panel grants; verify capacity/retention/backups for immutable bytea documents. Review application rollback compatibility with final-write guards; use forward fixes for schema changes rather than destructive rollback. Establish an authorized maintenance window or write gate for coordinated migration/release, and record owners and abort criteria.
7. **Only after separate production authorization:** validate the target again, take the approved backup, apply the verified pending migrations in the order above using the repository Prisma deploy path, confirm successful migration checksums/catalog protections, then release the matching application artifact. Resume interview writes only after schema, renderer and authorized-access smoke checks pass. Do not release this UI against an unmigrated schema.
8. Post-deployment smoke checks with designated synthetic accounts: profile scholar persistence; ordinary panel bank read/edit denial; independent questions; private pinned résumé and shared comments; null-score discussion and deliberate 1/10/half-step selection; one evaluation per reviewer despite retry; unchanged applicant decision/membership; history scope; past-round read-only leadership; applicant/outsider/revoked/anonymous denial; no-store downloads, worker loading and zero demo writes. Monitor access errors, revision conflicts, transaction failures and snapshot storage growth. Keep restore/recovery ready until the release is accepted.

Production migration execution, grants and deployment are still pending explicit authorization. No hosted Auth/Storage test success or native PostgreSQL rehearsal is claimed.
