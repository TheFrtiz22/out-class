"""Populate the report from accepted comparisons; never rewrite measurements."""
from pathlib import Path
import json

root=Path('docs/performance/phase8')
primary=json.loads((root/'comparison-final/COMPARISON.json').read_text())
supplement=json.loads((root/'supplement/COMPARISON.json').read_text())
report=(root/'PHASE8_REPORT.md').read_text()

def latency(value):
    return f"{value['p50']:,.1f} / {value['p95']:,.1f}"

def entries(groups):
    lines=['| Applicants | Target | Browser | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms |',
           '|---:|---|---|---:|---:|']
    for group in groups:
        target='List' if group['path'].endswith('applicants') else 'Detail'
        lines.append(f"| {group['size']:,} | {target} | {group['condition']} | {latency(group['B']['meaningfulMs'])} | {latency(group['A']['meaningfulMs'])} |")
    return '\n'.join(lines)

def interactions(groups):
    lines=['| Applicants | Interaction | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms | Read requests B → A |',
           '|---:|---|---:|---:|---:|']
    for group in groups:
        kind='Next page' if group['kind']=='next-page' else 'Distant search'
        lines.append(f"| {group['size']:,} | {kind} | {latency(group['B']['meaningfulMs'])} | {latency(group['A']['meaningfulMs'])} | 0 → 1 |")
    return '\n'.join(lines)

tests='''All final checks use candidate build `2ErH_X2IQiaRUYcsy3aBo` / the same 912 application-source hashes:

| Check | Result |
|---|---|
| Ordinary unit/component/contract suites | 1,401 passed; 54 environment-gated skips; 0 failures (1,455 total) |
| Real Auth, account privacy/revocation, navigation Phases 1/2/3/5/6/7/8 and settings acceptance | 58 passed, 0 skipped |
| Focused projection, page owner, transport and deterministic review regressions | 73 passed |
| Native security/concurrency runner | 3 passed |
| Disposable provisioning / verified signup / TOTP | 38 passed |
| Fresh and legacy migrations / browser-role denial | 57 migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |
| Real 5,000-applicant canonical/page parity | Exact result equality for the selected 100 |

Suite counts overlap and are not additive. The 54 gated skips are reported explicitly; not every optional gated suite was exercised. Full logs and runner descriptions are under `tests/`; `TEST_RESULTS.json` records the final totals.'''

results='''The accepted primary contains **384 browser outcomes (320 measured, 64 warmups)** and **600 separate loader observations**. The separate supplement contains **224 browser outcomes (176 measured, 48 warmups)** and **336 HTTP outcomes (280 measured, 56 warmups)**. Both complete intervals passed the sleep audit. All planned browser outcomes succeeded, with no page errors or HTTP 4xx/5xx. The excluded preliminary 384 browser / 600 loader outcomes and 42 HTTP preflight outcomes remain separate. No test suite or build ran during either accepted collection.

### Unthrottled local entry

'''+entries(primary['groups'])+'''

List read requests remain **1 → 1** on every timed entry. Complete timed list traffic is **5 → 5 requests cold** and **1 → 1 warm**. Detail traffic remains **4 → 4**, including one protected detail read, with identical detail response bytes. Detail server logic was not optimized; its mixed latency changes and retained 100-applicant tails do not establish a detail improvement.

| Applicants | Initial compressed list body, B → A bytes | Change |
|---:|---:|---:|
| 100 | 6,964 → 7,234 | +3.9% |
| 1,000 | 70,701 → 7,240 | −89.8% |
| 5,000 | 353,488 → 7,246 | −98.0% |

These are encoded HTTP body bytes, not total TLS/header bytes. At 5,000, raw loader JSON for the list/page is 3,003,626 / 59,257 bytes. Page envelopes add overhead at 100. Global facets, rounds and related rows per selected applicant can grow; the page size does not imply a universally constant payload.

| 5,000 warm list measurement | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms |
|---|---:|---:|
'''
warm=next(g for g in primary['groups'] if g['size']==5000 and g['path'].endswith('applicants') and g['condition']=='warm')
for key,label in [('readTtfbMs','Read TTFB'),('readServerMs','Server total'),('databaseMs','Database execution span'),('serializationMs','Serialization'),('readTransferMs','Read transfer'),('networkCompleteMs','Timed network complete'),('scriptMs','Timed browser script'),('taskMs','Timed browser task')]:
    results+=f"| {label} | {latency(warm['B'][key])} | {latency(warm['A'][key])} |\n"
results+='''
The large-list median entry improves, but local p95 worsens: 5,000 cold **297.1 → 341.7ms**, warm **391.4 → 438.0ms**; 100 warm **64.4 → 106.1ms**. The retained 5,000 warm maximum includes a 395.44ms server total and 281.46ms database span. No sleep interruption explains it, and these observations do not identify a causal host diagnosis. No row was replaced. Server phase distributions and maximum-row references are in `comparison-final/SERVER_PHASES.json` and `REGRESSION_OBSERVATIONS.json`.

### Warm page and search cost

'''+interactions(primary['interactions']['groups'])+'''

The resident baseline uses already released summaries locally. Phase 8 makes a fresh guarded GET for each accepted query, so it adds network, live validation and an O(N) scalar ranking scan. This changes freshness as well as latency. It does not make the preceding resident data an authorization result reusable by a later request. Added waits are real regressions; no synthetic delay was introduced to either product.

### Constrained browser

'''+entries(supplement['groups'])+'''

At 5,000 warm entry, timed network completion falls **2,025.1 → 186.8ms p50**, while server total falls **212.20 → 127.15ms p50**. The much larger browser benefit is consistent with reduced transfer under this profile. It is not evidence of a faster hosted Auth or database connection. Initial source preparation for the same group still takes **5,863 → 5,873ms p50** and transfers about 1.04MB in both builds; this phase does not solve the general first-page bundle/source wait.

'''+interactions(supplement['interactions'])+'''

The constrained entry improvement survives BA/AB ordering, while later page/search regressions remain. Absolute interaction timing is specific to the retained browser predicate, typing path and emulation; do not infer cross-profile CPU speed from one comparison.

### Bounded simultaneous initial reads

| Applicants | Readers per burst | Phase 7 burst p50 / p95 ms | Phase 8 burst p50 / p95 ms |
|---:|---:|---:|---:|
'''
for g in supplement['concurrent']:
    results+=f"| {g['size']:,} | {g['readers']} | {latency(g['B']['burstCompletionMs'])} | {latency(g['A']['burstCompletionMs'])} |\n"
results+='''
All 336 HTTP outcomes succeeded; each was independently guarded. At 5,000/four readers, median server total is **398.35 → 258.33ms**, database **246.52 → 216.06ms**, serialization **26.41 → 0.38ms**. Median transaction acquisition is **0.58 → 0.58ms**; p95 **1.14 → 5.55ms**. At one reader the candidate's median complete request is slightly slower at both sizes. This is mixed evidence, not a universal throughput gain.

The aggregate sampler observed up to nine same-role connections, four active queries, four idle-in-transaction connections and zero lock-waiting samples. The configured eight is per Prisma client; aggregate role counts also include background clients. Sampling can miss short peaks. Four readers, one actor/club, local Auth/DB, and no mutations do not prove production saturation safety or authorize raising concurrency.

The 600 loader observations each perform one remote identity verification. List, page and complete-selection loaders use 13 statements per observation, including transaction control. Detail uses 18; the unchanged full loader normally uses 18, with one 19-statement setup observation in each 5,000 variant. The fast path did not reduce statement count. Separately from HTTP, 5,000 page-loader median elapsed time is **160.32 → 191.00ms**, despite reduced hydration. The additional canonical metadata planning/pass and relation predicates still cost work; exact attribution between them is not established. Full results are in `comparison-final/LOADERS.json`.

### Source ownership, browser work and errors

All timed entry/detail samples have exactly one selected read. Source preparation retains additional reads: primary has two candidate warm-detail preparations and one baseline warm-detail preparation with two summary reads. Both candidate cases record `selected: mount`, Auth `signed_in`, then `selected: readAuthority`. Under the constrained profile every detail source preparation (32 per build, including warmups) has two summary reads; candidate events again record authority rotation. This supports an authority-owner transition explanation for the observed candidate cases, without logging tokens or suppressing validation. The frozen baseline has no such diagnostic labels, so its cause is not established by those labels. These reads remain in complete source traffic and must not be described as eliminated duplicates.

At 5,000 warm unthrottled entry, source visible content is **280 / 540 → 332 / 968ms p50 / p95**, source requests **58 / 58 → 58 / 59**, and source script bytes **542,749 → 543,405**. Candidate bundle/source preparation did not improve. At 5,000 warm detail preparation, source bytes fall **1,422,529 → 1,077,108**, because the preceding list is smaller; that is separate from the unchanged detail click. Complete source observations are retained in each comparison.

Heap evidence is mixed: 5,000 warm entry after-heap p50 is **14.21 → 15.36MB** unthrottled and **34.34 → 19.29MB** constrained (decimal MB). No forced GC was used. These snapshots do not establish retained-memory savings. Browser script/task/layout/heap distributions for every group are in each collection's `BROWSER_WORK.json`.

Zero failed navigations does not mean every background transport completed. Primary retains **22 failed recruitment-cycle transports after HTTP 200** (13 baseline, 9 candidate, including warmups) and **288 pending source SSE streams**. The supplement retains **128 pending SSE streams**, plus two non-SSE source requests (`view-as` and `corkboard`) still pending at one candidate 1,000 cold-detail preparation snapshot; no failed transports. Their eventual completion is not proven by that snapshot. All flags and source cases remain in `COMPLETE_DIAGNOSTICS.json`; captured positive bytes/HTTP 200 alone do not prove full consumption.
'''

recommendation='''**Hold publication.** This is a validated local candidate with a useful large-list entry and constrained-network benefit, not a blanket navigation optimization. At 5,000, initial body bytes fall 98% and local median entry falls about 32%, but local entry tails and every measured warm page/search comparison regress. Keep the resident baseline and this candidate reviewable until a product decision weighs repeated interactions against entry transfer and fresh-query requirements.'''
limits='''Recommend a focused next experiment, rather than another broad replacement: set entry, repeated-page/search and freshness budgets for representative workflows; then reduce the remaining scalar scan/planning cost while retaining canonical anonymous filtering, collation, global facets and review-dependent fallbacks. Profile the candidate page-loader regression and local tail rows before adding concurrency. A local read-plan experiment or removal of provably unused scalar metadata can be compared without infrastructure changes; moving ranking into SQL would require explicit privacy/order parity evidence, not assumed equivalence.

Separately investigate source preparation/bundle work and the observed authority transition, with the new fixed-label evidence. Any attempt to coalesce source reads must preserve the required authority rotation and fresh live guard. Do not suppress `SIGNED_IN`, revocation/account/membership checks, serve old rows as authorized, or turn a prepared page into a cache to improve this benchmark.

Unresolved limits: synthetic enriched cohorts, one local host/actor, warmed server, small descriptive percentile samples, local DB/Auth RTT, no genuine low-end mobile device, no mixed production mutation workload, and the full canonical fallback for review/score selectors. No production improvement, isolated Prisma pool-wait reduction, universal memory saving, or elimination of all source duplicate reads is established. No production schema/index, Supabase/Vercel configuration, dependency, push, merge or deployment change was made.

Evidence entry points: `BENCHMARK_RESULTS.json`, `TEST_RESULTS.json`, both `COMPARISON.json` files, source/build manifests, `IMPLEMENTATION.diff`, `PRIVACY_SCAN.json`, `CLEANUP.json`, `EVIDENCE.json` and `SHA256SUMS`. Disposable credentials/build snapshots are removed after the privacy scan; the ignored final build is retained for review. The original checkout, main/origin-main and 21 pre-existing unrelated containers are checked against initial state.'''
for token,text in [('FINAL_RECOMMENDATION_PENDING',recommendation),('FINAL_TESTS_PENDING',tests),('FINAL_RESULTS_PENDING',results),('FINAL_LIMITS_PENDING',limits)]:
    if token in report:
        report=report.replace(token,text)
    else:
        assert text in report, token
assert '_PENDING' not in report
(root/'PHASE8_REPORT.md').write_text(report)
