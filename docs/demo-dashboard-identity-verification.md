# Demo dashboard identity comparison

Scope: avoid rebuilding the full Demo user inside the dashboard meeting-membership predicate. No authenticated adapter, schema, storage format, notification, or interview submission change.

The dashboard now reads the authoritative synthetic identity from the current snapshot once per call. Meeting and attendance membership comparisons and the existing application projection use that ID. A missing identity fails closed with an explicit error. There is no cached identity to survive an account switch or reset. Recruitment-audience meetings retain their existing visibility; other meetings still require the same club/user membership comparison.

The related attendance predicate already used an ID rather than a full user; it now reuses the same local ID. The dashboard still computes its application data once. Full Demo user construction elsewhere is outside this fix.

Baseline source: `f158c69105fa83187506a330146997f5e16d005a` (previous reviewed head `a862dbf3d5970759f793b5384a7b60072a5e8b4b` has the same tree). Previous production: `dpl_9sWg3HtLnoeFXSV8nu9sFo73BQPV`. No migration or maintenance is required; this remains a compatible application rollback.

Regression coverage: exact dashboard membership/application/attendance results; projection access counts; current-snapshot identity replacement, membership revocation, reset, stop/restart, missing identity; unchanged reads have zero persistence writes/notifications. Existing interview persistence/browser checks cover initialization, private drafts, shared selection, cross-tab refresh, rollback/retry, and authorization without real action calls.

Performance evidence and final release results will be recorded after matching native Dell/Chrome baseline and candidate measurements. Focus is measured separately from presentation: the existing handler-to-layout-effect diagnostic is not evidence of painted readiness. Chrome Performance EventTiming and screenshots are used for presentation where available. Immediate typing is checked by sending text after the native click without waiting for or clicking the textarea, verifying exact text and persistence, and restoring the original synthetic note. Profiling/automation overhead and isolated fixtures must be labeled separately from full hosted measurements.

Protected local evidence: `%LOCALAPPDATA%/OutClass-staging-verification/demo-dashboard-fix-20261017/`. The earlier `demo-focus-diagnosis-20261017/findings.md` remains unchanged as reference evidence, not a controlled before/after claim.
