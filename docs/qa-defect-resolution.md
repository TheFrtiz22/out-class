# Nine-defect resolution and release checkpoint

October 27, 2026: user authorized fixes, protected merge, deployment and synthetic production verification, replacing the audit-only pause. The 29 blocked acceptance variants remain unverified; this release does not complete the 256-criterion audit.

Starting main: `06d3e93`. PR68 head `a5b5820`; PR77 head `0f96249` already contains PR68. Branch `codex/qa-defect-resolution` integrates PR77 with current main, preserving newer ARIA caption, eligibility-save, invitation-idempotency and disposable SMTP checks. Integration commit `9d03616`. Original PRs remain open until protected release supersedes them. Prior PR77 aggregate failure: dock diagonal-hover assertion, not assumed flaky. Native integration workflow passed.

| ID | Cause / implementation | Regression checkpoint | Production |
|---|---|---|---|
| D1 | Read action interrupted Link navigation; reuse PR68 navigation-first/read-independent fix. | Focused tests pass. | Pending |
| D2 | Blur autosave could reserve queue before waiting finish; reuse PR77 submission reservation. | Queue/revision/retry and real Chromium focusout regression pass. | Pending |
| D3 | Own-review query omitted room/day and applicant grouping; use booked room/Eastern day and canonical finalized averages. | New scope tests pending. | Pending |
| D4 | Editor option list omitted supported Walentas/Other and Other text input. | New controls; tests pending. | Pending |
| D5 | Independent mounted state rendered in sheets instead of inline sections. | Inline accessible headers, mounted hidden panels and save state; tests pending. | Pending |
| D6 | Expected missing applicant threw a production-redacted framework Error. | Typed unavailable/error response, safe retry and applications return; tests pending. | Pending |
| D7 | Global Ctrl/Cmd+Enter requested submit; form submit ended phase. | Remove implicit room shortcut/form transition; retain explicit buttons/composer handlers; tests pending. | Pending |
| D8 | JSON.stringify treated PostgreSQL JSONB object-key order as an edit on recovered drafts. | Semantic object-key comparison preserves array order/values/conflict recovery; tests pending. | Pending |
| D9 | Filter discovery was narrower than authorized scheduled room rows. | Union authorized room metadata into options; no kit/review grants; tests pending. | Pending |

## History semantics

No new schema. Existing authorized booking identifies the same club, stable round, room and scheduled Eastern (`America/New_York`) calendar day. No booking means empty history, never a fallback room. Only earlier scheduled starts on that day qualify; simultaneous group slots are not earlier sessions. DST boundaries use zoned instants. Exclude current applicant, unfinished/unlinked evaluations and anonymous contexts. Preserve canonical score visibility: assigned reviewers submit their own review before peer scores; explicit leadership follows the round-score gate. Average valid submitted canonical evaluations once per interviewer, preserving historical fractions. Sort applicants by latest eligible finalized evaluation timestamp, then applicant ID descending; take five applicants, not reviewer entries. Never select private drafts/closing text.

## Pending release gates

New focused regressions, disposable integration, types/lint/build and final required CI; reconcile later main changes. No migration expected. Record previous compatible Vercel deployment, preview isolation, merged/deployed source, synthetic production verification and cleanup before claiming live. Do not reopen immutable reviews. Production remains unchanged so far.

Grant-revocation HTTP500 remains unclassified; audit caller/preconditions retained. Need real exception context or isolated reproduction; no speculative runtime changes or blind production retries.
