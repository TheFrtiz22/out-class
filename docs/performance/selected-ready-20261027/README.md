# Selected-workspace startup — isolated current-main integration

This patch improves cold entry into Members, Applicants, Tasks and Announcements while requiring a fresh guarded GET before each visit reveals private content. Base: main `06d3e93110d09fc564de7e28cf7dc3a71f081fe4`. **The candidate is accepted for integration, pending hosted checks. It is not merged by this report.** The broader Phase 2–15 experimental branch remains separate.

The complete valid comparison retains **320 measured outcomes plus 64 excluded warmups**, n=10 per variant/path/condition/profile. Cold p50 and p95 improve in all eight local/constrained cold groups. Local cold medians improve about80–84%; constrained about25–54%. This is a cold-startup improvement, not a universal warm/source latency or production guarantee. [DECISION.json](DECISION.json) records the tradeoffs and remaining risks.

## Implementation and security

Exactly nine application files differ; see [APPLICATION.diff](APPLICATION.diff), `CANDIDATE_SOURCE.json` and [implementation notes](IMPLEMENTATION_NOTES.md). Only the selected tab starts its public module import alongside its original private resource GET. The mounted child consumes that fresh result once. The previous30-second directory/pipeline retained reveal is removed. Opaque Auth epoch refs fence obsolete dispatch, settlement and render before React commits; genuine later Auth changes still revalidate. Fixed diagnostic labels export no identities/tokens/arguments and cannot block a read.

The existing full pipeline endpoint and current main UI remain. No server action/API/Auth SQL/query/schema/index/dependency/production configuration/region changes. Remotely verified identity, live session/revocation/not_after, enabled accounts, current membership/capabilities/suspension, support restrictions, anonymous/self-review protections and voting authority remain. Private no-store/Cookie behavior, Demo isolation, scheduler/settings drafts, mutation actions and live updates remain. No new caching library or successful-authorization cache. Failed Phase14/15 Settings experiments are excluded.

## Click-to-useful-content results

Milliseconds; nearest-rank p50/p95/maximum. At n=10, p95 equals the actual maximum. Useful content is the existing real-data DOM predicate plus two animation frames. Cold/warm describes destination browser state with warm services. Same synthetic100-applicant fixture, desktop1440×1000, local production Next/Auth/PostgreSQL and per-client pool8; BA then AB. Constrained CDP:80ms latency,200,000B/s down,93,750B/s up,CPU4×.

| Profile / path / visit | n/build | Before p50 / p95 / max ms | After p50 / p95 / max ms |
|---|---:|---:|---:|
| local / meetings → tasks / cold | 10 | 289.5 / 308.9 / 308.9 | 56.6 / 62.2 / 62.2 |
| local / meetings → tasks / warm | 10 | 63.4 / 64.3 / 64.3 | 63.9 / 80.6 / 80.6 |
| local / overview → members / cold | 10 | 289.9 / 304.9 / 304.9 | 53.8 / 70.7 / 70.7 |
| local / overview → members / warm | 10 | 25.4 / 29.2 / 29.2 | 60.2 / 62.4 / 62.4 |
| local / recruiting → applicants / cold | 10 | 402.1 / 404.8 / 404.8 | 65.6 / 78.5 / 78.5 |
| local / recruiting → applicants / warm | 10 | 29.8 / 32.4 / 32.4 | 64.6 / 74.1 / 74.1 |
| local / tasks → announcements / cold | 10 | 287.1 / 296.4 / 296.4 | 56.7 / 59.9 / 59.9 |
| local / tasks → announcements / warm | 10 | 47.6 / 63.6 / 63.6 | 62.8 / 64.3 / 64.3 |
| constrained / meetings → tasks / cold | 10 | 379.0 / 462.6 / 462.6 | 272.9 / 318.0 / 318.0 |
| constrained / meetings → tasks / warm | 10 | 139.3 / 155.4 / 155.4 | 140.2 / 201.5 / 201.5 |
| constrained / overview → members / cold | 10 | 396.7 / 427.5 / 427.5 | 277.8 / 290.3 / 290.3 |
| constrained / overview → members / warm | 10 | 36.0 / 44.6 / 44.6 | 154.3 / 163.1 / 163.1 |
| constrained / recruiting → applicants / cold | 10 | 637.2 / 663.3 / 663.3 | 476.8 / 484.9 / 484.9 |
| constrained / recruiting → applicants / warm | 10 | 107.7 / 140.8 / 140.8 | 287.1 / 304.3 / 304.3 |
| constrained / tasks → announcements / cold | 10 | 346.7 / 355.9 / 355.9 | 159.0 / 219.5 / 219.5 |
| constrained / tasks → announcements / warm | 10 | 121.1 / 137.0 / 137.0 | 122.2 / 133.7 / 133.7 |

Warm Members/Applicants pay for validation before reveal: local medians +34.8/+34.8ms; constrained +118.3/+179.4ms. The original early retained display was faster. This is an explicit security/freshness cost. Tasks/Announcements warm medians are nearly unchanged; **Tasks warm constrained p95 grows155.4→201.5ms** (local64.3→80.6ms). The maximum candidate Tasks request has identity76.67ms, total89.10ms; the baseline maximum identity23.12ms, total30.19ms. These phase observations account for observed waiting but do not identify a provider/SDK/pool root cause.

Constrained Tasks cold source+click p95 grows5,028.6→5,299.0ms (+270.4ms,5.4%): its source useful-content maximum grows4,597→4,981ms, with source corkboard/invitations identity558.58/563.43ms and meetings identity445.59ms. Those waits occur before the selected task dispatch; server/guard/query contracts are unchanged. Candidate cold task p95 still improves462.6→318.0ms despite task identity165.88ms in that row. These adverse source observations remain in `TAILS.json`; no source-wide speedup or resolved identity cause is claimed. The materiality decision accepts the narrow cold-startup/fresh-reveal benefit while keeping these server waits open.

## Request counts, bytes and network/server timing

Median captured click request counts and encoded body bytes:

| Profile / path / visit | Requests before→after | Observed bytes before→after |
|---|---:|---:|
| local / meetings → tasks / cold | 3→3 | 26,138→26,175 |
| local / meetings → tasks / warm | 1→1 | 4,362→4,362 |
| local / overview → members / cold | 2→2 | 24,554→24,621 |
| local / overview → members / warm | 1→1 | 5,391→5,391 |
| local / recruiting → applicants / cold | 5→5 | 53,945→53,971 |
| local / recruiting → applicants / warm | 1→1 | 23,180→23,180 |
| local / tasks → announcements / cold | 2→2 | 5,011→5,056 |
| local / tasks → announcements / warm | 1→1 | 255→255 |
| constrained / meetings → tasks / cold | 4→3 | 26,138→26,175 |
| constrained / meetings → tasks / warm | 1→1 | 4,362→4,362 |
| constrained / overview → members / cold | 3→2 | 24,554→24,621 |
| constrained / overview → members / warm | 1→1 | 5,391→5,391 |
| constrained / recruiting → applicants / cold | 6→5 | 53,945→53,971 |
| constrained / recruiting → applicants / warm | 1→1 | 23,180→23,180 |
| constrained / tasks → announcements / cold | 2→2 | 5,011→5,056 |
| constrained / tasks → announcements / warm | 1→1 | 255→255 |

Each selected guarded resource GET is consumed once. Local request counts are unchanged. Constrained count differences are captured-window totals that include background/Flight traffic, not proof that this patch eliminates a specific request. The regression tests prove no duplicate selected mount read. The payload contract remains the same; tiny cold byte changes come from code/layout differences. Observed bodies exclude headers and unavailable/pending bytes. No work is deliberately moved before the click.

[COMPARISON.json](COMPARISON.json) contains all32 groups, exact source/useful/source+click metrics, start/end/TTFB/transfer/body distributions, server phases, sample counts and raw file/index references. [SELECTED_GET_TIMINGS.json](SELECTED_GET_TIMINGS.json) extracts the touched GET timings. Server phases overlap and must not be summed as exclusive CPU/pool/provider time. [ERROR_ACCOUNTING.json](ERROR_ACCOUNTING.json) retains every failed/pending/missing-body snapshot; all320 measured useful-content outcomes complete with zero page errors. HTTP error and transport snapshot totals are reported there without hiding background cancellations.

## Controls and excluded attempts

The valid local profile runs2026-10-27 17:02:49–17:05:40 UTC; valid constrained runs18:02:13–18:20:38 UTC. Both pass frozen source/build/fixture/tool/plan boundary checks, host sampling and independent actual Sleep/Wake/DarkWake audit. No builds/tests run during collection. Battery power and low-power mode0 stay consistent within each accepted profile; no charger or persistent setting change is required. Sampling cannot prove exclusive access or fixed CPU/thermal state.

`ATTEMPTS.json` preserves whole excluded attempts with verified unchanged file hashes. The first constrained attempt contains all192 planned outcomes and five source-page timeouts; actual Sleep/DarkWake cycles invalidate the whole profile, including successful rows. The second stops after eight warmups because power switches to AC; it contains zero measured visits. The third complete profile uses the same frozen plan/builds/fixture/collectors after the user confirms an open/idle Mac. No individual slow/error row is replaced and no attempt is pooled. A separately started network diagnosis is stopped after the sleep evidence is discovered; its partial data are diagnostic only and never performance evidence.

## Verification and publication gate

Before timing: **1,367 ordinary passed/44 gated skips/0 failures**, **45 live passed**, **three native security/concurrency suites passed**, **38 normal signup/Auth/TOTP baseline tests passed**, both builds/types/migrations passed,57 migrations/78 RLS tables, lint0 errors/22 existing warnings. Counts overlap and are not added. The initial obsolete retained-resource unit contract and missing diagnostic-module mock failures remain documented in `IMPLEMENTATION_NOTES.md`; all assertions for current security/loading behavior remain.

After timing, CI wiring adds the new selected-tab and constrained epoch acceptance suites to the disposable Auth job using an explicit guarded `--selected-navigation` mode. Its focused transport/diagnostic/CI guards pass seven checks; no application source changes after the frozen candidate. The exact positive CI entrypoint must pass hosted checks before main integration. Further hosted results/publication status are recorded separately when available.

[REPRODUCTION.md](REPRODUCTION.md) contains all commands. Evidence includes source manifests, full implementation/application diffs, complete raw observations, controls, failure histories, log redaction/privacy scan and scoped cleanup. This release does not approve the entire experimental series, resolve the historical4.2-second identity stall, establish multi-user pool capacity, or justify production infrastructure/security changes. Next investigate remaining source/background Auth waits and evaluate the list/detail projection/page contract in an independent current-main patch.
