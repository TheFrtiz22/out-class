# Support workspace transaction and review affordance repair

## Baseline and scope

Based on main `2c54a8cb1e9402b04708514291b316ec9aeecb80`, confirmed serving during the October 19, 2026 controlled hosted rehearsal. PR #49's application submission repair remains present. This repair needs no migration and must be reviewed before any merge or production deployment.

## Hosted evidence and limits

The existing synthetic applicant retained its successful submission, then moved through `IN_REVIEW` to `INTERVIEWING`. One synthetic 20-minute room/slot was created, one-person panel approval committed without conflicts, and booking publication committed at **2026-10-19 05:08:48.269 UTC**, revision 1. Intake remained closed and the club stayed hidden.

The published slot was **05:15–05:35 UTC / 1:15–1:35 AM Eastern**. The applicant's booking UI loaded it, then removed it after its start. **No reservation was created.** The short rehearsal window was an operator setup error, not evidence of a booking defect. Continue with a sufficiently future slot; never change clocks or bypass publication/staffing checks to reuse the expired one.

The synthetic President received a **single-round staffing eligibility override**, plus the product's audited availability attestation for that one synthetic session. These settings grant no administrative/applicant permissions. Existing roles, permission arrays and interview offices were preserved. The availability exception did not change personal availability or participation responses. No real applicant, real membership, credential, or permission grant was changed.

Expected denial: a club owner without a current identified panel assignment could not finalize an identified review. The form nevertheless exposed editing/finalization and showed a misleading generic save failure. An office alone also does not authorize identified evaluation submission; panel assignment remains mandatory.

Additional hosted workspace failures:

| UTC timestamp | Error | Evidence |
| --- | --- | --- |
| 2026-10-19 05:01:01.40 | P2028 | Commit after the existing 5,000 ms budget; 5,124 ms elapsed; digest `901508645` |
| 2026-10-19 05:07:33.73 | P2028 | `application.findMany`: transaction not found/closed; digest `1809910923` |

These logs establish failures, **not a shared root cause or exact action attribution**. In particular, read-only pipeline queries do not traverse the mutation-only support audit extension. Do not attribute the pipeline error to provider validation without additional timing evidence.

## Changes

1. **Editor drafts:** use the existing support-aware transaction wrapper. Provider-backed support resolution runs before transaction acquisition; transaction-local live authority validation remains before audited mutations and before commit. Existing club/user/membership locks, personal ownership, CAS revisions, advisory serialization, acknowledgement recovery and tombstones remain intact.
2. **Budgets:** explicitly retain Prisma 6.19.3's prior **2,000 ms acquisition / 5,000 ms execution** defaults. No automatic retry or transaction-timeout increase. The existing wrapper also applies its 3-second lock / 10-second SQL statement limits; the five-second transaction still bounds execution.
3. **Review affordance:** the protected pipeline response supplies `canEvaluate` from current assignment, review permission, anonymity, self-review and submitted-state rules. The client enables draft hydration, editing and finalization only when appropriate. An unavailable review no longer creates a draft or prevents closing the drawer/recruitment controls. Backend evaluation authorization remains unchanged. Demo follows the same affordance rules.
4. **Read diagnostics:** failures in `getClubPipeline` now emit phase, allowlisted Prisma code, acquisition duration, transaction duration and overall duration. The original error is rethrown. No exception message/meta, SQL, names, IDs, answers, notes or credentials are serialized. Existing RepeatableRead isolation and five-second transaction default are unchanged. This instrumentation does **not** claim to fix the unclassified read failure.

## Validation

- Focused database/domain/UI group: **59 passed**.
- Affected authorization/UI group: **27 passed**.
- Existing autosave and Demo-entry real browser checks: **3 passed** after restoring the missing local Chrome launcher.
- New desktop/mobile browser regression: **1 passed**, exercising the real form/hook with isolated request/Auth fixtures. It verifies no review editor/draft request for an unassigned reader, usable recruitment controls/close, assigned draft HTTP persistence and mobile width.
- TypeScript passed during implementation; final-source repository validation is recorded in the PR checks.
- The first broad local run was interrupted after detecting the missing Chrome launcher; it is **not a pass**. The pinned local Chromium runtime was restored and affected browser checks rerun.
- Added native PostgreSQL regressions compare serving-source and repaired draft writes under **simulated 5,500 ms provider latency**, exercise attribution, retry/CAS, cross-club denial, support revocation rollback, continued enforcement of the five-second business-work limit, and current/revoked/anonymous/self review affordances. These use the actual bounded-role Prisma engine and support query extension; only request/provider authentication is synthetic.
- Native tests require the existing isolated PostgreSQL CI job because this host has no Docker daemon. A gated local skip is not native execution evidence. Exact native and complete repository results belong in the final-source PR checks/report.

## Production preservation and remaining work

Outbound email stayed explicitly disabled. Existing delivery count remained 16 (historical records, not new sends). Original notification outbox and preference fingerprints matched their pre-test baselines. Synthetic stage/assignment notices are retained separately; none were replayed. Support sessions were ended.

At the hosted checkpoint the fixture is **hidden, active, intake closed**, with the published slot now expired and no reservation. Its history and single-round eligibility/attestation remain preserved for continuation. Re-suspension requires canonical fresh Admin verification; no direct SQL product mutation was used. The original five credential recovery files are outside this clone and were not accessed or modified.

Remaining: controlled future-slot reservation, interview completion, voting/decision/offer continuation, exact read-failure diagnosis, post-deployment verification of this repair if approved, and provider-owner hosted email verification. Do not mark the full site or full journey cleared from these partial results.

## Exact repair manifest

- `actions/crm.ts`
- `actions/editor-drafts.ts`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `lib/workspace-api.ts`
- `tests/crm-photo-authorization.test.cjs`
- `tests/decision-transactions-native.test.cjs`
- `tests/editor-drafts.test.cjs`
- `tests/live-applicant-views.test.cjs`
- `tests/review-editor-access-browser.test.cjs`
- `tests/scheduler-release-native.test.cjs`
- `docs/support-workspace-transaction-repair.md`
