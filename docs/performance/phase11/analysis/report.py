"""Render Phase 11 conclusions from complete, unfiltered accepted observations."""
from pathlib import Path
import json,collections
root=Path('docs/performance/phase11');read=lambda f:json.loads((root/f).read_text());d=read('BENCHMARK_RESULTS.json');tests=read('TEST_RESULTS.json')
n=lambda v:f'{v:,.1f}'
def fmt(v):return 'unavailable' if not v or v['p50'] is None else f"{n(v['p50'])} / {n(v['p95'])}"
def clsdelta(r,key):
 v=r['variants'];return '{:.6f} / {:.6f} → {:.6f} / {:.6f}'.format(v['B'][key]['p50'],v['B'][key]['p95'],v['A'][key]['p50'],v['A'][key]['p95'])
def delta(r,key):return fmt(r['variants']['B'].get(key))+' → '+fmt(r['variants']['A'].get(key))
selected=lambda profile,size,condition='warm':next(r for r in d['browser'] if r['profile']==profile and r['size']==size and r['condition']==condition and r['path'].endswith(' → applicants'))
five=selected('constrained',5000);local=selected('local',5000);before=read('BASELINE_SOURCE.json');after=read('CANDIDATE_SOURCE.json')
s=f'''# OutClass performance — Phase 11

Phase 11 defers five inactive feature components from the main club workspace JavaScript. In the constrained 5,000-applicant warm-destination group, the preceding fresh source load changes **{delta(five,'sourceUsefulMs')}ms p50 / p95**; observed initial script body bytes change **{delta(five,'sourceScriptBytes')}**. The separate list click changes **{delta(five,'clickMs')}ms**. This is a client startup experiment. The full results include first-use penalties on the newly deferred screens below.

Baseline: Phase 10 `2c95b4dec8fa218274c37f9dd406a090c37e58e0`; original audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase11-20261025` in the attached managed worktree. Frozen build IDs: baseline `{before['buildId']}`, candidate `{after['buildId']}`. This phase remains local, with no push, PR, merge or deployment. The earlier unpublished series' database tails and resident-list/freshness decisions remain unresolved.

## Implementation and security

The sole application change is in `components/club-workspace.tsx`: `ClubSettingsWorkspace`, `ClubMeetingsWorkspace`, the member-only `MeetingList`, `DecisionSchedules` and `RecruitmentReviewSettings` use top-level `next/dynamic` imports with the existing `WorkspaceLoading` fallback. Default SSR is retained. Existing render guards, props, keys, state/draft ownership and actual data readers are unchanged. The other **912 application files** and four font files match Phase 10; its font deferral is retained. No eager hover/focus prefetch is added. Next's build summary estimates workspace initial JavaScript 524KB → 475KB, but observed browser wire bytes, rather than this estimate, determine the measured result.

The real built-browser test verifies feature-specific chunks are absent before selection and downloaded on actual selected visits. `FEATURE_CHUNKS.json` retains the public program-asset mapping used for this check. Public JavaScript module caching is distinct from authorization or protected-data caching. Every actual protected request retains remote identity verification, live Auth session validity/revocation, account enablement, club membership, capabilities, suspension, support-session restrictions, anonymous interview protections and voting snapshot authority. No successful authorization cache is added, and protected content still waits for required validation. Private no-store, Cookie-sensitive responses, Demo isolation and mutations are unchanged. No production configuration, infrastructure, schema/index, database region, dependency, cache library, Redis or Edge Function changes.

## Verification

| Check | Result |
|---|---|
'''
for name,value in [('Ordinary suites',f"{tests['ordinary']['passed']:,} passed, {tests['ordinary']['skipped']} explicitly environment-gated skips, {tests['ordinary']['failed']} failures; {tests['ordinary']['total']:,} total"),('Serialized live Auth/account/privacy/revocation/navigation/settings',f"{tests['live']['passed']} passed, {tests['live']['failed']} failures, {tests['live']['skipped']} skips"),('Native security/concurrency',str(tests['nativeSecurityConcurrency']['passed'])+' passed'),('Normal disposable verified signup/TOTP provisioning','38 passed'),('Fresh/legacy migrations and browser-role denial','57 migrations; 78 RLS tables'),('Production build / typecheck','Passed'),('Lint','0 errors; 22 existing warnings')]:s+=f'| {name} | {value} |\n'
s+='''
Counts overlap and must not be added. The five new built-browser cases cover selected feature loading; abandoning a tab during a held code download; actual logout during that download followed by a denied protected read; durable Settings draft restoration after leaving and reloading without publication; and direct member-only Meetings entry without management controls. The existing cases retain strict GET transport/allowlists, duplicate elimination, scheduler and review draft continuity, rapid switching, late-response fences, live revocation, authorization scopes, font behavior and native metadata parity. Other gated suites remain explicitly skipped.

Development failures remain in `tests/`: a pointer-based test navigation hit the expanded dock, the database correctly prevented demoting the only owner, and a follow-up browser case was cancelled. The host power log also contained Sleep/Wake events; causality was not isolated. The fixture now adds a normal verified replacement owner before testing the member role, and uses the existing keyboard navigation path. The ordinary Settings static-render harness initially replaced every dynamic component with null; it now resolves mocked modules before rendering and keeps all existing permission assertions. A first asynchronous mock attempt waited on a proxy's accidental `then` method; that development run was stopped, and the mock now behaves as a non-thenable module. No application safeguard was removed to make these cases pass. The focused 31-case suite and complete final candidate checks pass. Response holding occurs only in regression tests, never accepted timings.

## Measurement protocol

Matched frozen production builds and independently seeded 1,000/5,000-applicant synthetic cohorts; BA then AB order; local unthrottled and CDP 80ms latency, 200,000B/s down, 93,750B/s up, CPU4×. Main paths use one warmup and five measured outcomes per build/block/path/condition (n10 per comparison, nearest-rank p95=max). Extra feature paths use the 1,000-applicant constrained cohort only, one warmup and three measured outcomes per build/block/path/condition (n6; p95=max). The 16-outcome pilot is excluded whole. All slow rows, errors, warmups and failed/pending transports remain. No product or collector edits, tests or builds compete with accepted collection; temporary awake assertions and actual power-log audits cover each complete accepted set.

Accepted: **384 main browser outcomes (320 measured, 64 warmups)**, **128 extra feature outcomes (96 measured, 32 warmups)**, **192 warm page/search interactions (160 measured, 32 warmups)**, and **336 native HTTP outcomes (280 measured, 56 warmups)**. Cold/warm describes the later destination visit; even a warm-destination row begins from a fresh source browser context. Source starts at document navigation and the existing visible-content predicate. Click runs from the actual action to the actual content predicate plus two animation frames. Settings waits for the enabled real profile fields after draft reading; Meetings waits for fixture data, scheduled decisions for the fetched empty state, and anonymous review for its actual controls. Dock groups/details open before the timed action; anonymous review uses its existing Settings/Application link and real browser-history return. Existing Next Link behavior is retained. Preparatory UI actions and any resulting pre-click prefetch traffic fall outside the source/click capture windows; those intervals are not a complete uninterrupted journey or an accounting of all possible preparation traffic. No extra wait is added to complete prefetch.

Source observation includes the existing bounded non-SSE drain, reported separately from useful content. Pending request snapshots do not prove eventual termination or complete byte accounting: body/script totals are observed encoded bytes. Source+click below is the distribution of each row's sum of two useful-content waits; it excludes source drain, navigation preparation and any deliberate warmup visit. It is neither an uninterrupted elapsed clock nor a sum of percentiles. Font readiness, FCP and observed layout shifts retain Phase 10 instrumentation. No synthetic product delays, response interception or cosmetic clock changes occur in accepted benchmarks.

## Main source and destination

All timings are p50 / p95 ms. Complete network/server/CPU/payload distributions are in `BENCHMARK_RESULTS.json`; every worsening quantile is retained in `REGRESSIONS.json`. Maximum source request timelines and click/interaction/native rows remain in `SOURCE_PEAKS.json` / `PEAKS.json`.

| Profile | Applicants | Destination / visit | Source before → after | Click before → after |
|---|---:|---|---:|---:|
'''
for r in d['browser']:s+=f"| {r['profile']} | {r['size']:,} | {'List' if r['path'].endswith(' → applicants') else 'Detail'} / {r['condition']} | {delta(r,'sourceUsefulMs')} | {delta(r,'clickMs')} |\n"
s+='\n| Profile / applicants / destination / visit | Source requests before → after p50 / p95 | Click requests before → after p50 / p95 | Click bytes before → after p50 / p95 | Source observation incl. drain before → after ms |\n|---|---:|---:|---:|---:|\n'
for r in d['browser']:
 label=f"{r['profile']} / {r['size']} / {'List' if r['path'].endswith(' → applicants') else 'Detail'} / {r['condition']}";s+=f"| {label} | {delta(r,'sourceRequests')} | {delta(r,'requestCount')} | {delta(r,'encodedBodyBytes')} | {delta(r,'sourceDrainedMs')} |\n"
s+='\n| 5,000 warm-destination source | Local before → after p50 / p95 | Constrained before → after p50 / p95 |\n|---|---:|---:|\n'
for key,title in [('sourceRequests','Requests'),('sourceBodyBytes','Observed encoded body bytes'),('sourceScriptBytes','Observed script bytes'),('sourceScriptRequests','Script requests'),('sourceFontRequests','Font requests'),('sourceFontBytes','Font bytes'),('fontReadyMs','Font readiness ms'),('first-contentful-paintMs','First contentful paint ms'),('sourceCLS','CLS'),('sourceDrainedMs','Source observation elapsed ms incl. bounded drain')]:
 s+=f"| {title} | {delta(local,key) if key!='sourceCLS' else clsdelta(local,key)} | {delta(five,key) if key!='sourceCLS' else clsdelta(five,key)} |\n"
s+='\n| 5,000 warm list click | Local before → after p50 / p95 | Constrained before → after p50 / p95 |\n|---|---:|---:|\n'
for key,title in [('requestCount','Captured requests'),('encodedBodyBytes','Observed encoded body bytes'),('readTtfbMs','Protected read TTFB ms'),('server_totalMs','Server total ms'),('server_identityMs','Identity verification ms'),('server_databaseMs','Database span ms'),('server_serializationMs','Serialization ms'),('readTransferMs','Transfer ms'),('networkCompleteMs','Network drain ms'),('scriptMs','Browser script ms'),('taskMs','Browser task ms')]:s+=f'| {title} | {delta(local,key)} | {delta(five,key)} |\n'
s+='''
The constrained 5,000 cold list click worsens 435.7 / 442.8 → 593.6 / 600.0ms and captured requests rise 5 → 9: script requests rise 3 → 7 and script bytes 31,898 → 48,834. This is a real first-selection penalty even though its preceding source improves. In the warm-source group, FCP rises 580 / 612 → 748 / 780ms and observed CLS 0.000016 → 0.001919. The lower useful-content wait does not make every paint metric better.

Each main timed entry/detail still has exactly one protected pipeline read. This phase changes no data request/transport or server query. Later click, page/search and native server fluctuations are observations rather than evidence of backend improvement. Overlapping phases must not be summed; database spans include transport/Prisma/client scheduling, and transaction acquisition is not an isolated pool wait.

## First-use cost of deferred screens

Constrained, 1,000 applicants; n6 per build/path/condition. The earlier source and later click are shown independently. The real Settings/Application source for anonymous review already needs Settings code; savings on that source may differ from Recruiting/Overview.

| Destination / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Click requests before → after | Click encoded bytes before → after |
|---|---:|---:|---:|---:|---:|
'''
for r in d['features']:s+=f"| {r['path']} / {r['condition']} | {delta(r,'sourceUsefulMs')} | {delta(r,'clickMs')} | {delta(r,'sourcePlusClickMs')} | {delta(r,'requestCount')} | {delta(r,'encodedBodyBytes')} |\n"
s+='\n| Destination / visit | Initial script bytes before → after | Click script requests before → after | Click script bytes before → after | Data TTFB before → after ms | Data transfer before → after ms |\n|---|---:|---:|---:|---:|---:|\n'
for r in d['features']:s+=f"| {r['path']} / {r['condition']} | {delta(r,'sourceScriptBytes')} | {delta(r,'clickScriptRequests')} | {delta(r,'clickScriptBytes')} | {delta(r,'dataTtfbMs')} | {delta(r,'dataTransferMs')} |\n"
rounds_cold=next(r for r in d['features'] if r['path'].endswith(' → rounds') and r['condition']=='cold');rounds_warm=next(r for r in d['features'] if r['path'].endswith(' → rounds') and r['condition']=='warm')
s+=f"\nAnonymous review is the clear adverse path: cold source+click changes {delta(rounds_cold,'sourcePlusClickMs')}ms; warm-destination Settings source changes {delta(rounds_warm,'sourceUsefulMs')}ms even though the later warm click changes only {delta(rounds_warm,'clickMs')}ms. Keeping default SSR does not establish equal content timing. The initial Settings render/download sequence needs further investigation; these observations do not isolate its mechanism or establish a database cause.\n"
s+='''
A slower cold click on a deferred feature is an observed cost of moving public code downloads to selection. The table tests whether earlier startup savings offset that cost in these paths; it does not establish how often real users visit them or make every destination faster. Warm visits can reuse the downloaded program modules, but required protected reads still validate live authority. Server Actions without Server-Timing headers remain visible as request TTFB/transfer observations; no server phase is invented for them.

## Warm interactions and native diagnostic

| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---|---:|---:|---:|
'''
for r in d['interactions']:s+=f"| {r['profile']} | {r['size']:,} | {r['kind']} | {fmt(r['variants']['B']['meaningfulMs'])} | {fmt(r['variants']['A']['meaningfulMs'])} | {delta(r,'requestCount')} |\n"
s+='\n| Applicants | Simultaneous readers | Burst before → after p50 / p95 ms | Request before → after p50 / p95 ms |\n|---:|---:|---:|---:|\n'
for r in d['http']:s+=f"| {r['size']:,} | {r['concurrency']} | {delta(r,'burstMs')} | {delta(r,'requestMs')} |\n"
maxima={k:max(p['maxima'][k] for p in d['poolObservations']) for k in ['connections','active','idle_in_transaction','lock_waiting']}
s+=f"\nNative HTTP uses the identical pipelinePage GET in both builds, bounded 1/2/4 readers, eight connections per client and nominal 25ms aggregate sampling. There are ten measured bursts per group and 10/20/40 per-request observations. Aggregate observed maxima: {maxima['connections']} connections, {maxima['active']} active queries, {maxima['idle_in_transaction']} idle-in-transaction connections and {maxima['lock_waiting']} lock-waiting samples. The monitor is excluded, short peaks may be missed, and aggregate connections do not establish pool saturation. Fixed-order local same-role diagnostics do not establish hosted or multi-user behavior.\n"
s+='\n## Errors, regressions and next phase\n\n'
for category,key in [('main','countsAndTransportFlags'),('feature','featureCountsAndTransportFlags')]:
 for profile,f in d[key].items():
  if not f['allOutcomes']:continue
  s+=f"{profile} {category}: {f['allOutcomes']} outcomes; {f['failedOutcomes']} failed outcomes, {f['pageErrors']} page errors, {f['httpErrors']} HTTP errors. Captured background transports: {f['failedTransports']} failed, {f['pendingSSE']} pending SSE, {f['pendingNonSSE']} other pending snapshots; source preparations with additional pipeline reads: {f['sourcePreparationsWithAdditionalPipelineReads']}. "
  if category=='main':s+=f"Interactions: {f['interactionOutcomes']}, {f['failedInteractions']} failed, {f['interactionPageErrorsIncludingPreparation']} script errors including preparation. "
  s+='\n\n'
s+=f"Native HTTP: {d['httpOutcomes']} outcomes, {d['httpFailed']} failures; all retain private no-store and Cookie sensitivity. Background failures after an HTTP response, pending snapshots and failed useful-content navigation are distinct. Authority events and extra source reads are retained. `TRANSPORT_DETAILS.json` groups their sanitized routes/statuses for inspection.\n\n"
reg=read('REGRESSIONS.json');material=[r for r in reg if r['metric'] in ['sourceUsefulMs','clickMs','meaningfulMs','burstMs','sourcePlusClickMs','sourceCLS','first-contentful-paintMs','fontReadyMs']]
s+='''The 11 local main failed transports are recruitment-cycle Server Action responses after HTTP 200 (baseline 5, candidate 6). The 23 feature failures are workspace RSC responses aborted after HTTP 200 (baseline 11, candidate 12), with successful visible navigation. Main constrained non-SSE pending snapshots are view-as and corkboard reads: baseline 8 each, candidate 48 each. The feature series adds baseline 1 each and candidate 2 each. Their eventual completion is not established.

All 43 main source preparations with an additional pipeline read occur in candidate rows, alongside 43 recorded `readAuthority` causes. These are not proven to be identical reads within one authorization scope: the live authority fence can require a fresh read. The timing/order correlation needs investigation before release; suppressing that signal or caching successful authorization would be a security shortcut. Required source refreshes and the background-pending gap remain unresolved despite lower aggregate source requests.

All worsening useful-content, paired-wait, interaction/burst, font/FCP and CLS quantiles are enumerated below; every other metric is retained in the complete machine-readable regression inventory. These small samples do not establish causality for unchanged code paths.

'''
for r in material:
 label=' / '.join(str(r[k]) for k in ['category','profile','size','path','condition','kind','concurrency'] if k in r);value=(lambda v:f'{v:.6f}') if r['metric']=='sourceCLS' else n;s+=f"- {label}, {r['metric']} {r['quantile']}: {value(r['before'])} → {value(r['after'])}.\n"
s+='''
Retain this as a measured local client-startup experiment and hold publication of the complete series. The smaller initial script transfer is real, but anonymous-review and first-use delays need refinement before release. Prioritize tracing the new source authority-refresh ordering and the Settings initial-render/code-download sequence, then test a bounded change that preserves the Recruiting startup saving while reducing first-use and anonymous-review penalties. Any deduplication must retain complete authorization scopes and necessary live refreshes. Profile the unchanged live-authorized source sequence and 5,000-applicant server tails separately, retaining the adverse earlier collections. The resident pipeline's O(N) scalar scan and freshness policy, direct-entry/public-page behavior outside these samples, hosted latency, multi-user pool behavior and all earlier adverse server tails remain explicit risks. Do not extend data or authorization caching to hide them.

`IMPLEMENTATION.diff` contains application, harness and test changes. Source/build manifests, declared protocol, excluded pilot, raw observations, derived comparisons, regressions, test logs, power audits, privacy scan, cleanup, evidence inventory and checksums accompany this report. No production changes or publication occurred.
'''
(root/'PHASE11_REPORT.md').write_text('\n'.join(line.rstrip() for line in s.splitlines()).rstrip()+'\n');print('Report rendered from accepted observations.')
