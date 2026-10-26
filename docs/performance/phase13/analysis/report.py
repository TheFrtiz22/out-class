"""Render Phase13 confirmation and diagnosis from complete retained observations."""
from pathlib import Path
import json,re
root=Path('docs/performance/phase13');read=lambda name:json.loads((root/name).read_text());data=read('BENCHMARK_RESULTS.json');transport=read('TRANSPORT_DETAILS.json');diag=read('DIAGNOSTIC_SUMMARY.json');tests=read('TEST_RESULTS.json');baseline=read('BASELINE_SOURCE.json');candidate=read('CANDIDATE_SOURCE.json')
def fmt(value):
 if not value or value.get('p50') is None:return 'unavailable'
 return f"{value['p50']:,.1f} / {value['p95']:,.1f}"
def delta(row,key):return fmt(row['variants']['B'].get(key))+' → '+fmt(row['variants']['A'].get(key))
def pick(profile,size,condition,path):return next(r for r in data['browser'] if r['profile']==profile and r['size']==size and r['condition']==condition and r['path']==path)
warm=pick('constrained',5000,'warm','recruiting → applicants');detail=pick('constrained',5000,'warm','applicants → applicantDetail')
small_warm=pick('constrained',1000,'warm','recruiting → applicants')
source_peak=next(r for r in read('SOURCE_PEAKS.json') if r['category']=='primary' and r['profile']=='local' and r['size']==1000 and r['path']=='applicants → applicantDetail' and r['condition']=='cold' and r['variant']=='A')
click_peak=next(r for r in read('PEAKS.json') if r['category']=='click' and r['group']==['constrained',1000,'recruiting → applicants','warm','A'])
click_read=next(q for q in click_peak['row']['requests'] if q['route']=='/api/workspace?kind=pipelinePage')
def phases(request):return {name:float(value) for name,value in re.findall(r'([a-z_]+);dur=([0-9.]+)',request.get('serverTiming') or '')}
source_reads=[{'route':q['route'],'traceId':q.get('traceId'),'ttfbMs':q.get('ttfbMs'),'phases':phases(q)} for q in source_peak['sourcePreparation']['requests'] if phases(q)]
source_identity_max=max(q['phases'].get('identity',0) for q in source_reads)
click_phases=phases(click_read)
(root/'PHASE_TAILS.json').write_text(json.dumps({'scope':'Selected adverse accepted measured rows, retained in their original quantiles; not separately instrumented and cannot isolate provider/dispatch execution. Indices are zero-based within raw samples.','coldSource':{'file':source_peak['profile']+'/'+source_peak['file'],'index':source_peak['index'],'sourceUsefulMs':source_peak['sourceUsefulMs'],'protectedReads':source_reads},'warmClick':{'file':click_peak['profile']+'/'+click_peak['file'],'index':click_peak['index'],'clickUsefulMs':click_peak['durationMs'],'protectedRead':{'route':click_read['route'],'traceId':click_read.get('traceId'),'ttfbMs':click_read.get('ttfbMs'),'phases':click_phases}}},indent=2)+'\n')
extra={v:sum(r['sourceOutcomes'] for r in transport['sourcePipelineReadMultiplicity'] if r['profile']=='constrained' and r['category']=='main' and r['variant']==v and r['protectedPipelineReads']>1) for v in ['B','A']}
account={v:next(r for r in transport['routeBodyAccounting'] if r['profile']=='constrained' and r['category']=='main' and r['variant']==v and r['stage']=='source' and r['route']=='/api/workspace?kind=pipelinePage') for v in ['B','A']}
s=f'''# OutClass performance — Phase 13

Phase13 confirms the existing Phase12 request-ordering change and adds separate local diagnosis of retained server waits. **No application files change in this phase.** In the complete constrained comparison, multiple-read source preparations change **{extra['B']} → {extra['A']}**, and captured source pipeline requests change **{account['B']['requests']} → {account['A']['requests']}**. The5,000-applicant warm-list click p50 / p95 is **{delta(warm,'clickMs')}ms**; its fresh source useful-content time is **{delta(warm,'sourceUsefulMs')}ms**. These are newly collected matched observations; previous Phase12 adverse/confounded rows remain immutable and are not pooled here.

Latency did not improve consistently. The constrained1,000-applicant warm-list click p50 / p95 changes **{delta(small_warm,'clickMs')}ms**. A candidate local cold source takes **{source_peak['sourceUsefulMs']:,.0f}ms**, with an identity phase as long as **{source_identity_max:,.2f}ms** despite passing the sampled host controls. Fewer requests is a repeatable finding here; broad tail-latency improvement and the cause of these stalls remain unproven.

Comparison: Phase11 `327f7de5d8dad3381f0db258956d0b8b6424a6af` versus Phase12 `{candidate['sourceRef']}`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Frozen builds: baseline `{baseline['buildId']}`, candidate `{candidate['buildId']}`. Branch `codex/performance-phase13-20261026`. No push, PR, merge or deployment.

## What changed and what remains protected

The new code is outside the production application: an async comparison runner, read-only host monitor, opt-in disposable-server preload, bounded diagnostic probes and three regression checks. The host sampler includes descendants of foreign development/test/build processes, records the original checkout baseline at the start of each profile and checks frozen sources/package manifests. The diagnostic preload correlates non-sensitive incoming request IDs with the UUID from the existing sanitized workspace phase log, and observes loopback Auth HTTP lifecycle stages. It refuses hosted/unreserved endpoints and does not modify response handling.

All913 candidate application files match Phase12. Only the same two application files differ between the comparison builds: `contexts/auth-context.tsx` and `components/selected-club-workspace.tsx`. The synchronous opaque epoch fence avoids an already-obsolete read before React commits and fences stale result settlement. Genuine later Auth changes still request fresh authorization; visits never borrow a previous successful authorization or protected result. Code/data still start together for a current scope. Phase10 fonts and Phase11 module boundaries, dirty-draft ownership and necessary live updates remain.

Remote identity verification, live session/revocation SQL, enabled accounts, membership/capabilities/suspension, support restrictions, anonymous interview protections, voting snapshot authority, private no-store/Cookie sensitivity and Demo isolation are unchanged. Mutations remain Server Actions. No production Supabase/Vercel configuration, database region/schema/index, security policy, dependency, cache library, Redis or Edge Function change.

## Verification

| Check | Result |
|---|---|
'''
for label,result in [('Ordinary suite',f"{tests['ordinary']['passed']:,} passed; {tests['ordinary']['skipped']} environment-gated skips; {tests['ordinary']['failed']} failures; {tests['ordinary']['total']:,} total"),('Full serialized live suite',f"{tests['live']['passed']} passed; {tests['live']['failed']} failures; {tests['live']['skipped']} skips"),('Dedicated native security/concurrency','3 passed'),('Normal signup/Auth/TOTP provisioning','38 passed'),('Fresh/legacy schema and browser-role denial','57 migrations; 78 RLS tables'),('Final diagnostics guard/privacy/context checks','3 passed; overlap ordinary coverage'),('Builds, types and lint','Both production builds and type checks passed; lint0 errors,22 existing warnings')]:s+=f'| {label} | {result} |\n'
s+='''
Counts overlap and must not be added. Existing transport, duplicate elimination, independent Interview Rooms dispatch, scheduler/settings/review draft continuity, rapid switching, mobile/pointer navigation, live authority, revocation, anonymous/support scopes and native metadata parity checks remain.63 optional gates are explicitly skipped in the ordinary suite; selected live/native suites are exercised separately, not every optional suite.

The first native-security invocation used the general disposable fixture. All three safety guards refused its database name before connecting or executing test SQL. The correct dedicated disposable runner then passes all three cases; both logs remain. Preflight development issues also remain: a preparation-time checkout baseline was too early for a measurement-start control, and Next response wrappers did not expose this trace header through the initial observer. The final monitor anchors each whole profile at its own start, and the final observer uses the already-sanitized phase log within the same async context. Final focused tests and a live private GET verify correlation before any accepted sample. No application assertion, readiness predicate or timeout was weakened.

## Controls and sample membership

The user confirmed an open lid and idle host. An unrelated development service was preserved. Five-second samples monitor known foreign Next build/Node test work, development-worker CPU, original checkout state, power source/mode, total host CPU and free memory. All source and runtime package manifests are checked at block boundaries. Sampling can miss brief activity and does not prove exclusive host access, fixed CPU frequency or controlled thermal state. No experiment-launched tests/builds or primary collector edits compete with accepted collection.

One startup attempt was rejected before any application start or outcome because its AC-only guard no longer matched battery power. The complete zero-row attempt is retained in `excluded-power-startup-1/`. Before collecting any timing row, the condition was declared as one recorded initial power source and low-power mode0 throughout each profile, using the user's earlier authorization to continue on battery. This does not remove or replace a slow row. Actual Sleep/Wake/DarkWake audits independently cover both accepted intervals. Excluded preflight observations are not performance data.

Synthetic independent1,000/5,000-applicant cohorts; identical within each build pair; BA then AB; local and CDP80ms,200,000B/s down,93,750B/s up,CPU4×. Main paths: one warmup plus five measured outcomes per build/block/path/condition. Each final main group has n10; nearest-rank p95 is its maximum. Extra feature paths retain the constrained1,000 cohort, one warmup plus three measured outcomes (n6,p95=max). Native primary reads remain bounded1/2/4, with eight connections per app client and25ms aggregate sampling.

Accepted membership:384 main browser outcomes (320 measured/64 warmups),128 feature outcomes (96/32),192 page/search interactions (160/32) and336 native HTTP outcomes (280/56). Fresh source navigation precedes the timed click; cold/warm describes the destination visit. Readiness and the original bounded non-SSE drain are unchanged. Body bytes are observed encoded bodies, excluding unavailable late/pending bytes and transport headers. Preparatory groups, details and existing Link intent/prefetch are outside click clocks. Source+click is each row's sum of two useful-content waits, excluding drains, preparation and warm visits; it is not uninterrupted elapsed time or a sum of percentiles.

| Profile | Start / end UTC | Host samples | Recorded power | Host controls / actual sleep |
|---|---|---:|---|---|
'''
for profile in ['local','constrained']:
 protocol=read(profile+'/PROTOCOL.json');host=read(profile+'/HOST_MONITOR.json');assert protocol['complete'] and host['valid'];power=host['powerBaseline'];s+=f"| {profile} | {protocol['startedAt']} / {protocol['completedAt']} | {len(host['samples'])} | {power['source']}, mode{power['lowPowerMode']}, {host['samples'][0]['batteryPercent']}% → {host['samples'][-1]['batteryPercent']}% | Passed / no actual sleep interruption |\n"
s+='''
## Main navigation

All timings are p50 / p95 ms; requests/bytes are also shown as p50 / p95. Full network, server, CPU, bytes, fonts/FCP/CLS, maxima and every worsening quantile remain in the JSON evidence.

| Profile | Applicants | Destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Click bytes before → after |
|---|---:|---|---:|---:|---:|---:|---:|
'''
for row in data['browser']:
 destination='Detail' if row['path'].endswith(' → applicantDetail') else 'List';s+=f"| {row['profile']} | {row['size']:,} | {destination} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourceRequests')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n|5,000 constrained warm clicks | List before → after p50 / p95 | Detail before → after p50 / p95 |\n|---|---:|---:|\n'
for metric,label in [('readTtfbMs','Protected-read TTFB ms'),('readTransferMs','Read transfer ms'),('server_totalMs','Server total ms'),('server_identityMs','Identity verification ms'),('server_live_sessionMs','Live-session check ms'),('server_transaction_acquireMs','Observable transaction acquisition ms'),('server_databaseMs','Database span ms'),('server_transactionMs','Transaction span ms'),('server_serializationMs','Serialization ms'),('scriptMs','Browser script ms'),('taskMs','Browser task ms')]:s+=f'| {label} | {delta(warm,metric)} | {delta(detail,metric)} |\n'
s+='\n| Constrained source pipelinePage accounting, including warmups | Baseline | Candidate |\n|---|---:|---:|\n'
for metric,label in [('requests','Requests'),('observedEncodedBodyBytes','Observed encoded body bytes'),('unknownBodySnapshots','Unknown-byte snapshots')]:s+=f"| {label} | {account['B'][metric]:,} | {account['A'][metric]:,} |\n"
s+='\nSource read multiplicities, Auth notifications/causes and their order against the first selected-effect dispatch marker remain in `TRANSPORT_DETAILS.json`. Auth-before-dispatch uses the last observed Auth notification, so a genuinely later change is not classified as already known. Each timed main entry/detail still sends one protected pipeline read. Database and transaction spans overlap; acquisition is not isolated pool-only waiting.\n'
s+='\n## Retained first-use feature costs\n\n| Destination / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Click requests before → after | Click bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for row in data['features']:s+=f"| {row['path']} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourcePlusClickMs')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\nThese paths are unchanged. Their variations do not prove that Settings first-use or anonymous review has been fixed. The Phase11 adverse evidence and Phase12 streamed/JavaScript-disabled diagnostic limits remain. No font, module, rendering or draft implementation changed in Phase13.\n'
s+='\n## Warm interactions and primary native reads\n\n| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |\n|---|---:|---|---:|---:|---:|\n'
for row in data['interactions']:s+=f"| {row['profile']} | {row['size']:,} | {row['kind']} | {fmt(row['variants']['B']['meaningfulMs'])} | {fmt(row['variants']['A']['meaningfulMs'])} | {delta(row,'requestCount')} |\n"
s+='\n| Applicants | Readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |\n|---:|---:|---:|---:|\n'
for row in data['http']:s+=f"| {row['size']:,} | {row['concurrency']} | {delta(row,'burstMs')} | {delta(row,'requestMs')} |\n"
s+='''
## Separate diagnosis of identity and transaction waits

These probes are outside primary quantiles:168 instrumented native GETs,56 direct SDK identity observations,16 instrumented browser outcomes and four read-only representative metadata plans. All native GETs correlate HTTP responses, existing workspace phase UUIDs, incoming diagnostic IDs and loopback Auth HTTP stages. None of these records authorizes another request or caches a successful authorization.

| Applicants / build | Native trace correlation | Metadata plan execution ms (one diagnostic) | Max observed event-loop delay ms | Max app-role active / connections / lock waiting |
|---|---:|---:|---:|---:|
'''
for case in diag['cases']:
 pool=case['poolAggregateMaxima']['app_role'];s+=f"| {case['size']:,} / {case['variant']} | {case['correlation']['matchedRequestTimelines']} /42 | {case['queryPlan']['executionMs']:,.2f} | {case['maxRecordedEventLoopDelayMs']:,.2f} | {pool['active']} / {pool['connections']} / {pool['lock_waiting']} |\n"
s+='\n|4-reader diagnostic, measured native requests | HTTP elapsed p50 / p95 ms | Identity phase p50 / p95 ms | Auth create→send p50 / p95 ms | Auth send→headers p50 / p95 ms | Auth headers→end p50 / p95 ms | Direct SDK getUser p50 / p95 ms |\n|---|---:|---:|---:|---:|---:|---:|\n'
for case in diag['cases']:
 group=next(g for g in case['groups'] if g['concurrency']==4);m=group['metrics'];s+=f"| {case['size']:,} / {case['variant']} | {fmt(m['elapsedMs'])} | {fmt(m.get('server_identityMs'))} | {fmt(m['auth_createdToSendMs'])} | {fmt(m['auth_sendToHeadersMs'])} | {fmt(m['auth_headersToEndMs'])} | {fmt(group['directSdkGetUserMs'])} |\n"
maximum=max((case['allIncomingAuthHttpTotalMs']['max'] or 0) for case in diag['cases']);s+=f'\nLargest completed incoming Auth HTTP timeline observed in the separate probes: **{maximum:,.1f}ms**. Raw incomplete timelines are retained and counted separately. The prior Phase12 multi-second identity span is neither discarded nor explained away by a faster diagnostic.\n'
s+=f'\nThe adverse constrained1,000 warm click retains {click_read["ttfbMs"]:,.2f}ms protected-read TTFB and {click_phases["total"]:,.2f}ms server time: identity {click_phases["identity"]:,.2f}ms, database {click_phases["database"]:,.2f}ms and observable transaction acquisition {click_phases["transaction_acquire"]:,.2f}ms. Its {click_peak["durationMs"]:,.1f}ms useful-content wait therefore includes a recorded server stall. The local cold source has three overlapping protected requests with identity phases around1.5s; its pipeline read alone records1,473ms identity and1,575.90ms total. These primary observations have no Undici substage instrumentation, so the faster separate probes cannot assign their cause. `PHASE_TAILS.json` identifies the exact accepted rows and phase values.\n'
s+='\n|4-reader diagnostic database spans | Database p50 / p95 ms | Observable transaction acquisition p50 / p95 ms |\n|---|---:|---:|\n'
for case in diag['cases']:
 m=next(g for g in case['groups'] if g['concurrency']==4)['metrics'];s+=f"| {case['size']:,} / {case['variant']} | {fmt(m['server_databaseMs'])} | {fmt(m['server_transaction_acquireMs'])} |\n"
s+='\nDatabase spans grow with cohort size while measured acquisition remains small in these bounded probes. This supports investigating the existing metadata/query/ranking work before increasing concurrency or pool size; it does not prove that pool saturation cannot occur in hosted or multi-user workloads. No pool or query behavior changes in this phase.\n'
s+='''
Created→send bounds Undici dispatch/connection/scheduling before transmission; send→headers includes transport, provider work and scheduling; headers→end covers observable HTTP body completion. Direct SDK wall time also includes body parsing. These stages do not isolate provider CPU. Process CPU/utilization spans overlap concurrent requests, and per-second event-loop histogram maxima are not a whole-run p95. Role-aggregate DB samples exclude the monitor but may miss brief peaks and cannot assign exact per-request pool waits. Eight is a per-client pool limit; aggregate connections can exceed it across clients. Representative EXPLAIN node/timing/buffer facts retain no parameter values, SQL text or rows and do not establish the duration of the complete protected endpoint.

The diagnostic lifecycle fields follow the [Undici diagnostics documentation](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md). The application continues remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) plus its separate live-session SQL check. Neither behavior is replaced by these observations.

## Errors, regressions and remaining risks

'''
for label,key in [('main','countsAndTransportFlags'),('feature','featureCountsAndTransportFlags')]:
 for profile,flags in data[key].items():
  if not flags['allOutcomes']:continue
  s+=f"{profile} {label}: {flags['allOutcomes']} outcomes, {flags['failedOutcomes']} failed useful-content outcomes, {flags['pageErrors']} page errors and {flags['httpErrors']} HTTP errors. Background snapshots: {flags['failedTransports']} failed transports, {flags['pendingSSE']} pending SSE and {flags['pendingNonSSE']} other pending snapshots.\n\n"
for profile,flags in data['countsAndTransportFlags'].items():s+=f"{profile} interactions: {flags['interactionOutcomes']} outcomes, {flags['failedInteractions']} failed, {flags['interactionPageErrorsIncludingPreparation']} page errors including preparation, {flags['interactionTimedHttpErrors']} timed HTTP errors, {flags['interactionTimedFailedTransports']} timed failed transports. Other preparation network accounting was not captured.\n\n"
s+=f"Primary native reads: {data['httpOutcomes']} outcomes, {data['httpFailed']} failures; every response retains private no-store and Cookie sensitivity. Pending snapshots and post-response abort flags are distinct from failed useful-content outcomes. Exact sanitized routes, failure reasons/statuses and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.\n\n"
s+='All worsening useful-content, paired-wait, interaction/burst, font/FCP and CLS quantiles are listed below, including small changes. Full other metrics remain in `REGRESSIONS.json`; small groups and p95=max do not establish statistical significance. No slow row is replaced.\n\n'
for row in read('REGRESSIONS.json'):
 if row['metric'] not in ['sourceUsefulMs','clickMs','sourcePlusClickMs','meaningfulMs','burstMs','sourceCLS','fontReadyMs','first-contentful-paintMs']:continue
 group=' / '.join(str(row[k]) for k in ['category','profile','size','path','condition','kind','concurrency'] if k in row);s+=f"- {group}, {row['metric']} {row['quantile']}: {row['before']:,.3f} → {row['after']:,.3f}.\n"
s+='''
## Recommendation

Retain the request-ordering fix with its deterministic regression coverage. Evaluate the latency tables by path; removing a duplicate request does not guarantee that source hydration, first-use code download, identity or database tails improve. This phase introduces no further application optimization, and claims no isolated provider-execution or pool-wait measurement.

Hold publication of the complete series pending the inherited Settings/anonymous-review first-use tradeoffs and the retained adverse tails. Next, isolate Settings streamed-render/code-loading and the review handoff while retaining the Recruiting bundle saving. For backend work, use the opt-in request-correlated probes to capture the intermittent long identity phase under the same browser workload before choosing a remedy. The controlled primary repeat still contains identity phases around1.5s; the separate probes peak below400ms and do not explain that event or the earlier Phase12 multi-second tail. Successful live authorization must remain request-specific.

The diagnostic database growth with small observed acquisition favors inspecting the O(N) pipeline metadata/ranking work over increasing concurrency or pool size. A bounded query improvement should be tested for metadata/ranking parity before adoption. No new application change was justified during this confirmation phase: removing obsolete reads saved requests/bytes, but warm medians and adverse tails did not improve consistently. Direct/public entry coverage beyond these cases, hosted regions/latency and multi-user pool behavior remain limits of this loopback study.

Implementation tools/tests, the confirmed Phase12 application diff, source/build/package manifests, plans, all raw observations, diagnostic bounds, test history, controls/power audits, exclusions, privacy scan, cleanup and checksums accompany this report. Original checkout changes made outside this task are recorded and preserved. No production changes or publication occurred.
'''
for before,after in [('Phase13','Phase 13'),('Phase12','Phase 12'),('Phase11','Phase 11'),('Phase10','Phase 10'),('The5,000','The 5,000'),('All913','All 913'),('independent1,000','independent 1,000'),('constrained1,000','constrained 1,000'),('CDP80ms','CDP 80ms'),('CPU4×','CPU 4×'),('n10','n=10'),('n6','n=6'),('lint0','lint 0'),('four42','four 42')]:s=s.replace(before,after)
(root/'PHASE13_REPORT.md').write_text('\n'.join(line.rstrip() for line in s.splitlines()).rstrip()+'\n');print('Phase13 report rendered from complete confirmation and separate diagnosis.')
