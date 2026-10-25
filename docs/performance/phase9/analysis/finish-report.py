"""Fill Phase 9 report sections using accepted, separate collections."""
from pathlib import Path
import json

root=Path('docs/performance/phase9')
primary=json.loads((root/'comparison-final/COMPARISON.json').read_text())
supplement=json.loads((root/'supplement/COMPARISON.json').read_text())
counts=json.loads((root/'ACCEPTED_COUNTS.json').read_text())
work={name:json.loads((root/name/'BROWSER_WORK.json').read_text()) for name in counts}
latency=lambda d:f"{d['p50']:,.1f} / {d['p95']:,.1f}"

def table(groups,interaction=False):
    lines=['| Applicants | '+('Interaction' if interaction else 'Target / browser')+' | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |',
           '|---:|---|---:|---:|']
    for g in groups:
        label=('Next page' if g['kind']=='next-page' else 'Distant search') if interaction else ('List' if g['path'].endswith('applicants') else 'Detail')+' / '+g['condition']
        lines.append(f"| {g['size']:,} | {label} | {latency(g['B']['meaningfulMs'])} | {latency(g['A']['meaningfulMs'])} |")
    return '\n'.join(lines)

warm=next(g for g in primary['groups'] if g['size']==5000 and g['path'].endswith('applicants') and g['condition']=='warm')
next_page=next(g for g in primary['interactions']['groups'] if g['size']==5000 and g['kind']=='next-page')
headline=f'''The recognized metadata read uses **10 statements instead of 13** in the measured default page path, with the same payload and required live validation. At 5,000 applicants, local warm entry is **{latency(warm['B']['meaningfulMs'])} → {latency(warm['A']['meaningfulMs'])}ms p50 / p95**; warm next-page is **{latency(next_page['B']['meaningfulMs'])} → {latency(next_page['A']['meaningfulMs'])}ms**. The supplemental 5,000-applicant single-reader burst also worsens **211.1 / 343.8 → 348.5 / 1,046.8ms p50 / p95**. Keep this candidate local: primary improvements against Phase 8 do not resolve the complete series' resident-list/freshness tradeoff or establish production performance.'''
tests='''| Check | Result |
|---|---|
| Ordinary unit/component/contract suites | 1,405 passed; 55 environment-gated skips; 0 failures (1,460 total) |
| Live Auth/account/privacy/revocation/navigation/settings | 59 unique cases exercised across two runs; 0 failures |
| Initial live run | 54 passed; 5 skipped because the fixture contained only 100 applicants |
| Targeted 1,000-applicant followup | All 5 previously skipped page/search/draft/refresh cases passed; 0 skips |
| Native metadata scope differential | 86 complete/foreign/nested scopes, optional profiles, archived rounds; synthetic cases rolled back |
| Native security/concurrency | 3 passed |
| Normal disposable provisioning/signup/TOTP | 38 passed |
| Migrations / browser-role denial | All 57 fresh/legacy migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |

Counts overlap; do not add them. The 55 ordinary gated skips are explicit, and not every optional gated suite was exercised. `TEST_RESULTS.json` and `tests/` retain the final runs and development fixture failures. Final candidate build/source hashes are unchanged from the passing checks through both accepted collections.'''

results='''Accepted primary: **384 browser outcomes (320 measured, 64 warmups)** and **600 separate loader observations**. Separate supplement: **224 browser outcomes (176 measured, 48 warmups)** plus **336 HTTP outcomes (280 measured, 56 warmups)**. All planned rows remain. Both full collection intervals passed the power audit. The 200 exploratory loader samples are retained separately and excluded; no test suite or build from this task competed with accepted measurements.

### Unthrottled entry and detail

'''+table(primary['groups'])+'''

Both builds use the bounded page GET. Each timed entry/detail has one protected read. Complete timed list request count remains five cold / one warm; detail remains four. Expected common-page JSON and encoded-body bytes are compared directly below; the query optimization does not intentionally change the wire contract, page size or source ownership. Detail code was unchanged: mixed detail timing is not a demonstrated detail optimization.

| Applicants | Initial list encoded body bytes, Phase 8 → 9 |
|---:|---:|
'''
for size in [100,1000,5000]:
    g=next(g for g in primary['groups'] if g['size']==size and g['path'].endswith('applicants') and g['condition']=='warm')
    results+=f"| {size:,} | {g['B']['readBodyBytes']['p50']:,} → {g['A']['readBodyBytes']['p50']:,} |\n"
results+='''
These are encoded HTTP body bytes, excluding TLS/headers. Global facets/rounds and per-applicant child collections may grow, even though selected applications are capped at 100.

| 5,000 warm list measurement | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---|---:|---:|
'''
for key,label in [('readTtfbMs','Read TTFB'),('readServerMs','Server total'),('databaseMs','Database span'),('serializationMs','Serialization'),('readTransferMs','Transfer'),('networkCompleteMs','Timed network complete'),('scriptMs','Browser script'),('taskMs','Browser task')]:
    results+=f"| {label} | {latency(warm['B'][key])} | {latency(warm['A'][key])} |\n"
results+='''
All individual phase distributions and selected maximum rows remain in `comparison-final/SERVER_PHASES.json` and `REGRESSION_OBSERVATIONS.json`. Overlapping phases must not be summed. Transaction acquisition includes BEGIN/transport and is not an isolated pool-only wait. Retained high-latency rows are not replaced or dismissed as host noise.

This change did not improve every measured path. Local 100 warm-list p50/p95 is **64.1 / 77.2 → 64.8 / 111.3ms**, although its database-span median falls **11.19 → 8.92ms**. The change does not optimize the remaining identity, render/paint or source work. At 1,000 cold list, median improves but p95 worsens **135.2 → 162.7ms**; next-page p95 worsens **201.4 → 237.0ms** despite a lower median. The unchanged 1,000 detail endpoint has cold p50/p95 **80.0 / 113.7 → 95.9 / 216.2ms** and warm p95 **134.9 → 479.6ms**. The warm maximum records server total 406.77ms, identity verification 381.60ms and database span 19.68ms. This locates the observed wait, but does not establish why identity verification slowed or a causal host diagnosis. No identity/live-session validation was removed to reduce that result. The remaining tiny 100 cold-detail p95 increase and all other groups are retained in `REGRESSIONS.json` and the tables.

### Warm interactions

'''+table(primary['interactions']['groups'],True)+'''

Both variants issue one fresh guarded GET for each accepted page/search query. Request count is **1 → 1**, rather than the Phase 7 resident design's historical zero. This backend change cannot make a fresh request equivalent to a local resident interaction. Phase 7 was not rebuilt in this matched Phase 9 experiment; its older timings are context, not a pooled comparison.

### Constrained browser

'''+table(supplement['groups'])+'\n\n'+table(supplement['interactions'],True)+'''

The payload remains bounded in both variants, so Phase 8's large transfer reduction is not a new Phase 9 gain. Constrained 1,000 warm entry has nearly unchanged median but p95 worsens **257.9 → 697.4ms**. Three of four constrained interaction p95s regress: 1,000 next-page **283.3 → 425.9ms**, 1,000 search **135.6 → 608.5ms**, and 5,000 next-page **417.2 → 738.7ms**. Constrained 5,000 next-page median improves **339.9 → 304.5ms**, while p95 worsens **417.2 → 738.7ms**. Other constrained regressions and their maximum-row references remain in `supplement/REGRESSIONS.json` and `PEAKS.json`. Source loading remains separate from the timed click. The unchanged browser code and small samples do not establish a general CPU, hydration or memory improvement.

### Bounded simultaneous initial reads

| Applicants | Readers per burst | Phase 8 burst p50 / p95 ms | Phase 9 burst p50 / p95 ms |
|---:|---:|---:|---:|
'''
for g in supplement['concurrent']:
    results+=f"| {g['size']:,} | {g['readers']} | {latency(g['B']['burstCompletionMs'])} | {latency(g['A']['burstCompletionMs'])} |\n"
results+='''
All 336 HTTP outcomes and their server/TTFB/body data are retained in `supplement/COMPARISON.json`. At 5,000/one reader, complete burst median/p95 worsens **211.14 / 343.84 → 348.52 / 1,046.84ms**. Its maximum has server total **1,040.90ms**, database span **951.06ms** and transaction acquisition **0.51ms**. Database-span median also worsens **167.87 → 201.46ms**. The span covers the instrumented Prisma operation and does not isolate PostgreSQL engine execution from transport/client scheduling. This is an unresolved regression, not a tail to remove. At four readers, median improves **361.70 → 286.56ms**, while p95 worsens **600.66 → 893.46ms**. One-actor bursts cap at four requests; they do not establish multi-user production saturation limits. The sampler observed up to **10 same-role connections, four active queries, four idle-in-transaction connections, and zero lock-waiting samples**. The nominal 25ms sampler can miss short peaks; same-role aggregate connections may include background clients and exceed the per-client pool setting without proving pool saturation.

### Loader, source and transport diagnostics

'''
loaders=json.loads((root/'comparison-final/LOADERS.json').read_text())
for variant in ['baseline','candidate']:
    g=next(g for g in loaders['groups'] if g['file']==f'size-5000-{variant}-loaders.json' and g['name']=='pipelinePage')
    results+=f"5,000 page loader ({'Phase 8' if variant=='baseline' else 'Phase 9'}): **{latency(g['elapsedMs'])}ms p50 / p95**; statement-count distribution **{g['queryCounts']}**.\n\n"
results+='''Loader calls each repeat remote identity verification. These non-HTTP timings are not browser latency. Default page paths use 10 statements versus 13, including transaction control; empty pages, populated member relations, unknown metadata scopes and full review-dependent fallbacks can have different counts. The unchanged full/list/selection/detail results are retained, including initial setup-statement variations. The sanitized 5,000-row plan (`METADATA_PLAN.json`) demonstrates the remaining full metadata scan; its single execution is not a comparative latency estimate.

'''
for collection in ['comparison-final','supplement']:
    d=json.loads((root/collection/'COMPLETE_DIAGNOSTICS.json').read_text())
    results+=f"{collection}: **{d['counts']['browserOutcomes']} browser outcomes, {d['counts']['failedBrowserOutcomes']} failed, {d['counts']['pageErrors']} page errors, {d['counts']['httpErrors']} HTTP errors**. Retained background flags: **{d['counts']['failedRequests']} failed transports**, **{d['counts']['pendingRequests']} pending requests**, and **{d['counts']['extraSourceReadOutcomes']} source preparations with additional summary reads**.\n\n"
results+='''Pending SSE and request failures after HTTP 200 remain distinct from navigation outcomes and HTTP errors. Additional source reads and their fixed-label authority events remain visible in `COMPLETE_DIAGNOSTICS.json`. This phase did not suppress authority rotation or coalesce a later live validation. Non-SSE pending snapshots do not establish eventual request completion.

| 5,000 warm list source/browser observation | Phase 8 p50 / p95 | Phase 9 p50 / p95 |
|---|---:|---:|
'''
for key,label in [('meaningfulMs','Source useful content ms'),('requestCount','Source requests'),('encodedBodyBytes','Source encoded body bytes'),('scriptBytes','Source script bytes')]:
    results+=f"| {label} | {latency(warm['B']['source'][key])} | {latency(warm['A']['source'][key])} |\n"
for collection in ['comparison-final','supplement']:
    g=next(g for g in work[collection]['groups'] if g['size']==5000 and g['path'].endswith('applicants') and g['condition']=='warm')
    results+=f"\n{collection} after-heap p50: **{g['B']['heapAfterBytes']['p50']/1e6:.2f} → {g['A']['heapAfterBytes']['p50']/1e6:.2f}MB** (decimal). No forced GC; these point samples do not measure retained application memory.\n"

constrained_warm=next(g for g in supplement['groups'] if g['size']==5000 and g['path'].endswith('applicants') and g['condition']=='warm')
results+=f"\nThe preceding constrained 5,000 warm-list source preparation still takes **{latency(constrained_warm['B']['source']['meaningfulMs'])} → {latency(constrained_warm['A']['source']['meaningfulMs'])}ms p50 / p95**, with approximately 1.04MB of source body traffic in both builds. This wait is outside the timed click table and remains user-visible; the original multi-second first-load problem is not solved.\n"

recommendation='''Keep the implementation and evidence local. Assess Phase 9 as a database-shape improvement against Phase 8, with every measured regression called out alongside gains. The series still needs a product decision about fresh-query requirements versus resident interaction speed; this phase changes neither policy nor transport. No automatic push, merge or deployment was performed.

Before considering publication, reproduce and profile the 5,000 single-reader regression and the constrained page/search tails with phase/query-level evidence; preserve this complete collection rather than replacing its bad rows. The HTTP levels were collected after constrained browser blocks in fixed 1/2/4 order, so they are not isolated database microbenchmarks. For the next optimization experiment, also prioritize the initial source/bundle and hydration critical path, using retained source requests/bytes and authority events to choose a concrete dependency or waterfall. Preserve remotely verified identity and required live authority transitions. Also retain the Phase 9 query's scalar-scan cost as a known large-cohort limit; true SQL paging would require proof of canonical anonymous filtering, JS collation, facets and review/score equivalence. Do not assume it from a faster JOIN.

Remaining limits: local desktop and loopback Auth/database, synthetic enriched cohorts, one actor/club per burst, warmed servers, small descriptive percentiles, no real low-end mobile hardware, no production mixed-mutation load, and a hand-maintained SQL allowlist coupled to the selected Prisma shape. Strict scope recognition falls back on unfamiliar predicates, and native differential tests must remain when the query/schema evolves. No universal tail, isolated pool-wait, bundle, memory or hosted-production improvement is established.

Review `BENCHMARK_RESULTS.json`, `TEST_RESULTS.json`, both accepted `COMPARISON.json` files, `IMPLEMENTATION.diff`, source/build manifests, `PRIVACY_SCAN.json`, `CLEANUP.json`, `EVIDENCE.json` and `SHA256SUMS`. The original checkout and main refs remain unchanged; disposable credentials/services/build snapshots are removed after privacy checks, with the ignored final build retained.'''
report=(root/'analysis/report-template.md').read_text()
for token,text in [('RESULTS_PENDING',headline),('TESTS_PENDING',tests),('TABLES_PENDING',results),('RECOMMENDATION_PENDING',recommendation)]:
    if token in report:report=report.replace(token,text)
    else:assert text in report,token
assert '_PENDING' not in report
(root/'PHASE9_REPORT.md').write_text(report)
