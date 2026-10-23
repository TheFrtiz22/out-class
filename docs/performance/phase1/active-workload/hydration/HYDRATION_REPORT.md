# Initial hydration follow-up

October 22, 2026. This follows the [active-room audit](../ACTIVE_WORKLOAD_REPORT.md). The audit reference remains `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`; the measured application base is `cffb63cff78c9694b89ed7e26a82d21edb5421e5`. Subsequent user commit `43bb46429c817a2a0110a85475268cdf917b5e65` is preserved and receives a separate production build and acceptance run. No merge or deployment occurred.

## Outcome and implementation

The initial-page hydration failure is reproduced and fixed. There are **zero browser errors, zero HTTP/transport failures and all 24 authorized interview links in 400 follow-up navigations**: 160 in the comparable four-user scenario and 240 in a separate scenario that also starts four initial page loads together. These are local acceptance observations, not proof that every possible production hydration failure is eliminated.

`app/layout.tsx` retains its server-side identity, session, account and support checks. Its route wrapper delegates to the small client `RouteContent` component. A `RouteChildren` component reconciles streamed children inside that wrapper, so a pending Flight child suspends a component fiber rather than an already-claimed host div. The resulting DOM, support-banner padding, SSR content and streaming loading boundary remain the same. There is no timer, added loading delay, warning suppression, client-only rendering, runtime patch, dependency change or authorization cache.

The separate stale voting transport test now requires both `Cookie` and `Accept-Encoding` in `Vary`, matching the existing private gzip response. No application header behavior changed in this follow-up.

## Diagnosis

The original production diagnostic cohort contains three React 418 recoveries in 160 page lifetimes. Every recovery occurs during **initial page hydration**, before the destination click, rather than inside Interview Rooms. The component stack points to the root layout's route wrapper under `ClubCustomizationProvider`.

An opt-in browser-response probe captured React trying to claim the route div while its hydration cursor was already inside that div, at the streamed Suspense boundary. This matches the mechanism described in React's [hydration replay issue](https://github.com/react/react/issues/37584). The upstream [host-fiber replay fix](https://github.com/react/react/pull/35494) explains the cursor restoration missing from the installed runtime. The application workaround avoids this replay path without editing React or Next.js.

The deterministic browser regression exercises both installed React DOM and Next.js's bundled React runtime. Its control reproduces error 418 and replaces the original server node; the actual `RouteContent` preserves that same node and reports no recoverable error. The diagnostic observer also has a browser test proving that it forwards React's original reporting callback and omits private props, messages and URL query values.

The DOM-probe cohorts modify a browser response only for diagnosis and are **excluded from performance comparisons**. An interrupted development/restart diagnostic contains 12 partial navigation observations and 37 recorded failures, including errors after browser termination; it is preserved and excluded because it is not a stable production cohort. Normal application code never installs the probe.

## Before and after

Both comparable cohorts use 20 cold and 20 warm waves with four separately authenticated participants: 80 observations per condition. Both enable the same optional hydration observer and neither rewrites browser JavaScript. Cold means a fresh browser with a warm server/database. Readiness remains the existing content predicate plus two animation frames; no error observation was removed.

| Metric | Cold before → after | Warm before → after |
|---|---:|---:|
| Click to useful content p50 / p95, ms | 518.9 / 556.6 → 531.0 / 636.2 | 183.1 / 204.0 → 214.9 / 345.4 |
| Network completion p50 / p95, ms | 495.0 / 534.5 → 502.9 / 613.3 | 157.9 / 178.0 → 192.7 / 313.1 |
| Visible GET TTFB p50 / p95, ms | 104.35 / 202.46 → 116.04 / 232.86 | 89.08 / 163.11 → 117.74 / 267.64 |
| Visible GET server total p50 / p95, ms | 97.62 / 190.01 → 107.57 / 215.56 | 84.13 / 155.75 → 108.03 / 252.80 |
| Requests, median | 8 → 8 | 3 → 3 |
| Completed response-body bytes, median | 44,009 → 43,996 | 3,956 → 3,943 |
| Browser errors | 1 → 0 | 2 → 0 |
| HTTP / transport failures | 0 / 0 → 0 / 0 | 0 / 0 → 0 / 0 |

All 320 comparable observations have complete body-size counters and all 24 interview links. Per-request identity, live-session, database, acquisition, transaction and serialization distributions are retained in [COMPARISON.json](COMPARISON.json). Sampled connections peak at eight, with zero sampled lock-waiting backends; these samples do not establish pool capacity or rule out short waits.

**This fix did not demonstrate an additional navigation speedup.** The measured click interval starts after initial hydration, so avoiding the initial recovery does not remove one of its three protected GETs. Observed latency is higher and is reported above. Server phase timings also increase: assigned-room warm identity p95 rises from 81.50 to 152.70 ms and database p95 from 85.40 to 146.72 ms, although this change edits neither loader. Sequential cohorts on a shared laptop cannot establish the cause or rule out a real regression.

The after cohort uses a newly created equivalent fixture following destructive security tests, so identifiers, booking dates, database history and compressed bytes differ. A 1.8-second focused regression run overlapped part of the after warm cohort; its observations remain included. Other host activity was not controlled. The 13-byte median difference is not an optimization claim. A randomized, isolated crossover is needed before attributing latency changes to this wrapper.

The additional parallel-initial-load scenario has 30 waves per condition, 120 observations each, and zero recoveries or browser/request failures. Its click p50/p95 is 565.5/729.5 ms cold and 247.2/341.6 ms warm. This is a different stress scenario and is not substituted for the comparable cohort.

## Fixture validity and failed attempts

The existing security suite disables an owner and correctly revokes all 96 booking grants and clears all three room approvals. Re-enabling that owner does not restore authorization. Three subsequent benchmark attempts produced zero navigation samples while waiting for the now-empty interview list. Their failures remain in `after-startup-incomplete`, `after-readiness-incomplete` and `after-readiness-probe`; they are not latency observations. The two interrupted runs also record subsequent browser-closed errors as their loops finish; the raw files retain all 40 failure entries per run.

The active fixture now checks all 96 live grants and three approvals before reusing a saved fixture. A fresh fixture was created through the existing normal verified signup and guarded local seeding path. No revoked grants or approvals were reactivated. The fixture remains confined to the explicit disposable `outclass-hydration-e2e` profile and ports, separate from other local tasks.

## Verification and remaining work

[Test results](TEST_RESULTS.json), [raw evidence manifest](EVIDENCE.json) and [implementation diff](HYDRATION_FOLLOWUP.diff) identify the exact artifacts and scopes. The full workspace suite passes 1,321 tests with 37 environment-gated skips; eight focused hydration/transport/diagnostic checks pass. All 58 production Auth/browser checks pass against current HEAD plus the fix, using real local Auth, PostgreSQL, MFA and captured mail. They include settings/history/responsive navigation, three concurrent reads, rapid switching, anonymity, Demo isolation, capability removal, suspension, disabled accounts and session revocation. Build, type and lint results are recorded separately; existing build warnings remain identified as such.

The 400 follow-up navigation observations measure the frozen Phase 1 application plus the two-file layout fix. The newer application-writing/logo changes in `43bb464` receive build and acceptance coverage but are not silently included in those performance numbers. All earlier raw benchmarks and the original implementation patch are preserved.

The deterministic regression is reproducible without database credentials:

```sh
node --test tests/route-content-hydration-browser.test.cjs tests/hydration-diagnostics-browser.test.cjs tests/navigation-audit-harness.test.cjs tests/workspace-reliability.test.cjs
```

For real workloads, start the existing disposable onboarding fixture, finish its security tests, and then seed a fresh navigation/active-room fixture before benchmarking. The captured run used a private archive and test-only copies of the runner/helper with `outclass-onboarding-e2e` → `outclass-hydration-e2e`, ports `553xx` → `583xx`, and app port `3107` → `3117`; no application environment file was read. The `--hydration-fixture` flag selects that fixed profile. The comparable command uses `--diagnose-hydration --active-rooms --clients=4 --samples=20` and an explicit new output directory. The stress command adds `--parallel-initial-loads` and uses 30 waves. Keep `--probe-hydration-dom` out of performance runs. The standalone diff applies to `43bb464` and includes the required fixture/diagnostic tooling; use the frozen application base plus only the two layout files to reproduce the measured application scope.

Retain Phase 1's request reductions and this verified hydration correction for review. Before release, obtain an isolated crossover for the observed latency increase and extend acceptance to published slot-panel versions, mobile and sustained workloads. The next performance implementation candidate remains the assigned-room loader's repeated per-booking projections, batched only within the existing live authorization transaction. Preserve remote identity verification, revocation, enablement, membership, capability, suspension, support, anonymity and voting-snapshot checks on every protected request. No production infrastructure, database region, schema, index or security behavior was changed.
