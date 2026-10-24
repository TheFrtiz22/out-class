# Phase 3 — pipeline list, detail and display pages

Parent: `583b231f4a6e7eed9222ac983c9e6634483be6e9` (the unreleased Phase 2 branch). Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Main was `145fed90e046fe11577c86654c5f29ff6964f177` at the start of this phase.

The selected pipeline reads an explicit compact list. Opening a candidate reads that candidate through the original guarded projection; single-candidate previews use that same one read directly. Display pages bound the rendered rows to 100. Whole-list search, filters, sorting, counts, quick review and voting candidate selection retain their prior meaning, including global Kanban lane totals. The request still contains the complete compact selection: server pagination remains a later step.

`PLAN.json` fixes the disposable cohorts and BA/AB collection. `BASELINE_SOURCE.json` and `CANDIDATE_SOURCE.json` identify frozen production outputs and application source hashes. `comparison-paged/` supplies the completed final 100/1,000 cohorts. Its later 5,000 control stopped on source-load failure and remains retained. `stress-5000/` records every planned 5,000-applicant attempt, including failures; no timeout is replaced or converted to an invented navigation time. Requests include timings, non-sensitive trace IDs and received bytes. Loader probes adapt the Next cookie context but use real local Auth, live session SQL and Prisma; they are separate from browser timing.

The earlier attempts remain separate:

- `comparison/`: the first strict protocol stopped on two baseline HTTP-200 Flight cancellations. The revised protocol counts successful cycle-read cancellations separately and verifies that the cycle UI has no error. Canceled response bytes come from CDP received chunks and are marked explicitly. No other cancellations or errors are accepted.
- `comparison-final/` and `SPLIT_ONLY_RESULTS.json`: the split-only prototype completed 100 and 1,000 applicants but stopped at two warm browser timeouts with 5,000 applicants. It is not accepted or pooled into the final comparison. This led to the display-page boundary.
- Pilot directories and prototype loader probes are excluded from the accepted comparison. The first two detail pilots used obsolete/non-rendered readiness text. The third uses actual application-response content. The paged 5,000-applicant pilot passes all four cold/warm cases; the full stress study still finds source-preparation failures in both builds.

No hosted configuration, schema, index or production records are changed. No merge, push or deployment is performed.

During packaging, the four per-attempt `PLAN.json` snapshots were reconstructed from the retained cumulative plan. Every snapshot matches the SHA-256 recorded by its original protocol; see `PLAN_VERIFICATION.json`. Future collections copy the plan at startup. Older protocol environment summaries and some raw profile `inputMethod` labels inherited “keyboard” from Phase 2; the actual profile interaction was a pointer click in both builds. The final harness labels it correctly. Raw timing observations and original protocol records were not rewritten.
