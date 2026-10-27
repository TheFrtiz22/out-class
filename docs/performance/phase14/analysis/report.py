"""Render the complete Phase14 comparison, including adverse results and limits."""
from pathlib import Path
import json
root=Path('docs/performance/phase14');read=lambda n:json.loads((root/n).read_text());data=read('BENCHMARK_RESULTS.json');review=read('REVIEW_TIMELINES.json');diag=read('DIAGNOSTIC_SUMMARY.json');tests=read('TEST_RESULTS.json');retained=read('FINAL_VERIFICATION.json');baseline=read('BASELINE_SOURCE.json');candidate=read('CANDIDATE_SOURCE.json')
def fmt(d):return f"{d['p50']:,.1f} / {d['p95']:,.1f}" if d and d.get('p50') is not None else 'unavailable'
def delta(row,key):return fmt(row['variants']['B'].get(key))+' → '+fmt(row['variants']['A'].get(key))
def feature(profile,condition,path='settingsApplication → rounds'):return next(row for row in data['features'] if row['profile']==profile and row['condition']==condition and row['path']==path)
target=feature('constrained','cold');local=feature('local','cold');before=target['variants']['B']['clickMs'];after=target['variants']['A']['clickMs'];improved=after['p50']<before['p50'] and after['p95']<before['p95']
interpretation='Both target cold-click quantiles improve in this matched constrained collection; small groups do not establish a general or hosted speedup.' if improved else 'The target cold-click quantiles do not both improve. Download overlap did not establish a measurable navigation improvement. The application change is rejected and reverted; preserve the experiment and hold publication.'
s=f'''# OutClass performance — Phase 14

Phase 14 tested starting the Anonymous Review editor download alongside its selected, live-authorized rounds GET, then rejected that change. Constrained cold Review click p50 / p95 changes **{delta(target,'clickMs')}ms**; local changes **{delta(local,'clickMs')}ms**. {interpretation}

Comparison: Phase13 `{baseline['sourceRef']}` versus the frozen candidate hashes in `CANDIDATE_SOURCE.json`. Build IDs: baseline `{baseline['buildId']}`, candidate `{candidate['buildId']}`. Every before/after table describes this rejected experiment; the retained application/build is exactly baseline B, recorded in `FINAL_SOURCE.json`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase14-20261026`. In tables, B denotes the Phase13 baseline and A the Phase14 candidate. No push, PR, merge or deployment.

## Implementation and security

The measured experiment added three lines in the existing `RoundSettings` effect in `components/club-workspace.tsx`: initiate the public editor module import before requesting rounds. Previously the dynamic editor could begin downloading only after rounds settled. The same guarded dynamic component renders the editor and owns its load-error behavior; a speculative import rejection is consumed without bypassing the actual consumer. Code starts only on the selected review's mount/retry. There is no hover/idle prefetch, extra protected-data read or data/authorization cache. The other912 measured application files match Phase13. After rejecting the experiment, all913 retained application files match Phase13. This preserves earlier fonts, feature deferral, synchronous authority fencing, dirty-draft ownership and live updates.

Every protected read still performs remotely verified identity, live Auth session/revocation, account enablement, membership/capabilities/suspension, support restrictions, anonymous projections and voting snapshot authority as required. Private no-store/Cookie-sensitive behavior and Demo isolation remain. Mutations remain Server Actions. No production Supabase/Vercel configuration, region, schema/index, security policy, dependency, cache library, Redis or Edge Function change.

The investigation tools reuse the Phase13 host and sanitized request observer with reserved-loopback guards. The separate instrumented browser probes now use the existing Settings/Meetings/Decisions/Review workload, and `rounds` is a fixed non-sensitive category. No diagnostic preload runs in primary timing servers or ships in application code.

## Verification and development history

| Check | Result |
|---|---|
'''
for label,result in [('Measured candidate ordinary suite',f"{tests['ordinary']['passed']:,} passed; {tests['ordinary']['skipped']} environment-gated skips; {tests['ordinary']['failed']} failures; {tests['ordinary']['total']:,} total"),('Measured candidate complete serialized live suite',f"{tests['live']['passed']} passed; {tests['live']['failed']} failures; {tests['live']['skipped']} skips"),('Retained application ordinary suite',f"{retained['ordinary']['passed']:,} passed; {retained['ordinary']['skipped']} gated skips; {retained['ordinary']['failed']} failures; {retained['ordinary']['total']:,} total"),('Retained application complete serialized live suite',f"{retained['live']['passed']} passed; {retained['live']['failed']} failures; {retained['live']['skipped']} skips"),('Relocated opt-in experiment harness',f"{retained['relocatedExperiment']['passed']} passed against the measured frozen candidate"),('Dedicated native security/concurrency',f"{tests['nativeSecurityConcurrency']['passed']} passed"),('Normal signup/Auth/TOTP provisioning',f"{tests['provisioning']['passed']} passed"),('Fresh/legacy migrations and browser denial','57 migrations;78 RLS tables'),('Builds, types and lint','Both production builds and type checks passed; lint0 errors,22 existing warnings')]:s+=f'| {label} | {result} |\n'
s+='''
Counts overlap and must not be added. The new ordinary cases exercise local diagnostic guards, safe concurrent correlation and foreign-worker ownership. The two opt-in experimental built-browser cases prove code download while the rounds response is held, and absence of late protected UI after abandoning Review and logging out with code/data held. Captured cookies then receive401 on a rounds read. Existing tests retain explicit GET transport/allowlists, duplicate elimination, independent Interview Rooms dispatch, scheduler/settings/review draft continuity, rapid switching, mobile/pointer behavior, late-response fences, native metadata parity, revocation, anonymous/support scopes and signup privacy. Optional ordinary gates remain explicitly skipped; this is not a claim that every optional suite ran.

The unchanged overlap test fails on the baseline with its expected10-second wait-for-code timeout while rounds are held; it passes on the candidate. Response holding is exclusive to regression tests. The experiment harness lives under `tests/experiments/` and requires `OUTCLASS_PHASE14_EXPERIMENT=1` plus the reserved local configuration; it is excluded from ordinary retained-application test discovery. Both excluded development pilots contain eight outcomes. The initial pilot obtains earlier code dispatch but its single constrained cold Review observation is slower; it never enters accepted quantiles. This is why the complete matched comparison, including adverse rows, determines the performance conclusion.

The first selected live invocation passes65 cases but omits signup privacy. It is retained as `live-initial.log`; the complete69-case serialized rerun includes all prior Phase13 selected coverage and both new cases. No application assertion, readiness predicate, timeout or security policy was weakened. All measured-candidate checks and builds finish before accepted measurements. After capture and the rejection decision, separate ordinary/live/type/lint checks verify the retained Phase13 application. These later checks never compete with measurements. The retained build is the already-validated frozen baseline, with913 source hashes reverified.

## Controls and membership

Independent synthetic1,000/5,000-applicant cohorts, identical within each build pair; BA then AB order. Local unthrottled and CDP80ms,200,000B/s down,93,750B/s up,CPU4×. Main groups have one warmup plus five measured outcomes per build/block/path/condition (n10 per final variant group). Feature groups have one warmup plus three measured outcomes (n6) and run in both profiles for1,000 applicants. Nearest-rank p95 is a maximum in these small groups.

Membership:384 main browser outcomes (320 measured/64 warmups),256 feature outcomes (192/64),192 page/search interactions (160/32) and336 native HTTP outcomes (280/56). The two eight-outcome development pilots and separately instrumented probes are excluded whole. Phase13 observations remain immutable and are never pooled here. Fresh source document time and later click time remain separate. Source+click is a per-row sum of two useful-content waits, excluding drains, preparation and warm visits; it is not uninterrupted elapsed journey time. Cold/warm describes the destination in a fresh browser context with warm local Next/Auth/database services.

The user confirmed an open lid and idle host. Five-second samples monitor known foreign build/test work, development-worker CPU, original checkout state, total CPU/free memory and power source/mode. Frozen application/collector/plan/package hashes are checked at block boundaries. Observed violations invalidate whole profiles; slow rows are never selectively replaced. Battery use is authorized; one initial source and low-power mode0 must remain consistent within each profile. Temporary awake assertions do not change persistent settings. Actual Sleep/Wake/DarkWake is independently audited. Sampling can miss brief work and does not prove exclusive host access, fixed frequency or thermal conditions. Unrelated services and external checkout changes remain preserved.

| Profile | Start / end UTC | Host samples | Recorded power | Controls / actual sleep |
|---|---|---:|---|---|
'''
for name in ['local','constrained']:
 p=read(name+'/PROTOCOL.json');h=read(name+'/HOST_MONITOR.json');assert p['complete'] and h['valid'];s+=f"| {name} | {p['startedAt']} / {p['completedAt']} | {len(h['samples'])} | {h['powerBaseline']['source']}, mode{h['powerBaseline']['lowPowerMode']}; {h['samples'][0]['batteryPercent']}% → {h['samples'][-1]['batteryPercent']}% | Passed / no sleep interruption |\n"
s+='\n## Selected Review timing and request order\n\n| Profile / visit | Source before → after p50 / p95 ms | Click before → after | Source+click before → after | Requests before → after | Encoded bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for profile in ['local','constrained']:
 for condition in ['cold','warm']:
  row=feature(profile,condition);s+=f"| {profile} / {condition} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourcePlusClickMs')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n| Cold measured Review | Code requested before rounds complete / observations with code | Code start minus rounds end p50 / p95 ms | Code/data overlap p50 / p95 ms |\n|---|---:|---:|---:|\n'
for row in review['summary']:
 if row['condition']=='cold':s+=f"| {row['profile']} / {row['variant']} | {row['codeStartedBeforeRoundsComplete']} / {row['outcomesWithReviewCodeRequests']} | {fmt(row['metrics']['codeStartMinusRoundsEndMs'])} | {fmt(row['metrics']['codeAndRoundsOverlapMs'])} |\n"
s+='\nNegative code-start-minus-rounds-end means dispatch before the rounds response completes. These offsets use the existing browser request clock; they do not establish when parsing/rendering completed. Warm visits may request no editor code. All64 Review rows, including warmups, are identified in `REVIEW_TIMELINES.json`. Public static module reuse never authorizes data.\n'
s+='\n| Constrained Review data timing | Cold B → A p50 / p95 ms | Warm B → A p50 / p95 ms |\n|---|---:|---:|\n'
for field,label in [('roundsTtfbMs','Rounds TTFB'),('roundsTransferMs','Rounds transfer'),('server_totalMs','Server total'),('server_identityMs','Identity verification'),('server_live_sessionMs','Live session'),('server_databaseMs','Database span'),('server_serializationMs','Serialization')]:
 pairs=[]
 for condition in ['cold','warm']:
  values=[next(r for r in review['summary'] if r['profile']=='constrained' and r['condition']==condition and r['variant']==v)['metrics'].get(field) for v in ['B','A']];pairs.append(fmt(values[0])+' → '+fmt(values[1]))
 s+=f'| {label} | {pairs[0]} | {pairs[1]} |\n'
s+='\n## Other feature and main navigation outcomes\n\nTimings, requests and bytes are p50 / p95. Bytes are observed encoded bodies, excluding unavailable late/pending bytes and headers. Preparatory UI/pre-click prefetch traffic is outside the click clock. Server database/transaction spans may overlap; acquisition is not isolated pool-only waiting. Full CPU, network, server, fonts/FCP/CLS, payload and adverse quantiles remain in JSON.\n\n| Profile / feature / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Click bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for row in data['features']:
 if row['path']=='settingsApplication → rounds':continue
 s+=f"| {row['profile']} / {row['path']} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourcePlusClickMs')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n| Profile / applicants / destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Click bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for row in data['browser']:
 destination='Detail' if row['path'].endswith(' → applicantDetail') else 'List';s+=f"| {row['profile']} / {row['size']:,} / {destination} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourceRequests')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\nSettings module boundaries, its profile/draft reads, Meetings and scheduled decisions are unchanged. Variations there do not establish that Settings streamed rendering or the full first-use tradeoff is fixed. Main list/detail, page/search and native endpoint behavior are unchanged; their timings bound collateral effects and host variability.\n'
s+='\n## Page/search and bounded native concurrency\n\n| Profile / applicants / interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |\n|---|---:|---:|---:|\n'
for row in data['interactions']:s+=f"| {row['profile']} / {row['size']:,} / {row['kind']} | {fmt(row['variants']['B']['meaningfulMs'])} | {fmt(row['variants']['A']['meaningfulMs'])} | {delta(row,'requestCount')} |\n"
s+='\n| Applicants / readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |\n|---|---:|---:|\n'
for row in data['http']:s+=f"| {row['size']:,} / {row['concurrency']} | {delta(row,'burstMs')} | {delta(row,'requestMs')} |\n"
s+='\n## Separate server-tail diagnostics\n\nThe following are outside primary quantiles:168 instrumented native GETs,56 direct SDK identity observations,32 feature-browser outcomes and four read-only representative metadata plans. All native traces correlate existing workspace phase UUIDs with incoming diagnostic IDs and Auth HTTP lifecycle stages. Direct SDK observations do not replace application live-session checks or authorize a later request.\n\n| Applicants / build | Matched native traces | Largest completed Auth HTTP ms | Max event-loop delay ms | Metadata plan execution ms | App-role max active / connections / lock waiting |\n|---|---:|---:|---:|---:|---:|\n'
for case in diag['cases']:
 pool=case['poolAggregateMaxima']['app_role'];s+=f"| {case['size']:,} / {case['variant']} | {case['correlation']['matchedRequestTimelines']} /42 | {case['allIncomingAuthHttpTotalMs']['max']:,.2f} | {case['maxRecordedEventLoopDelayMs']:,.2f} | {case['queryPlan']['executionMs']:,.2f} | {pool['active']} / {pool['connections']} / {pool['lock_waiting']} |\n"
s+='\n| Four-reader measured diagnostic | Identity p50 / p95 ms | Auth create→send | Auth send→headers | Auth headers→end | Database span | Observable acquisition |\n|---|---:|---:|---:|---:|---:|---:|\n'
for case in diag['cases']:
 m=next(g for g in case['groups'] if g['concurrency']==4)['metrics'];s+=f"| {case['size']:,} / {case['variant']} | {fmt(m.get('server_identityMs'))} | {fmt(m['auth_createdToSendMs'])} | {fmt(m['auth_sendToHeadersMs'])} | {fmt(m['auth_headersToEndMs'])} | {fmt(m['server_databaseMs'])} | {fmt(m['server_transaction_acquireMs'])} |\n"
s+='\n| Largest measured primary phase | Value ms | Location |\n|---|---:|---|\n'
for phase,values in read('SERVER_TAILS.json')['largestThreeByPhase'].items():
 if values:
  row=values[0];s+=f"| {phase} | {row['phases'][phase]:,.2f} | {row['profile']} / {row['variant']} / {row['path']} / {row['condition']} / {row['stage']} / {row['route']} |\n"
s+='\nThese maxima identify retained slow primary requests; they do not isolate provider or pool execution. Exact trace IDs, files and row indices remain in `SERVER_TAILS.json`.\n'
s+='''
The database phase sums elapsed query-call spans, including observable waiting/transport. Concurrent query spans overlap and can exceed response wall time; the1,899.29ms aggregate above is not a1.9-second response or isolated database execution.

Auth create→send includes dispatch/connection/scheduling; send→headers includes transport/provider work/scheduling; headers→end is observed HTTP body completion. These do not isolate provider CPU. Process-window CPU spans overlap concurrent requests; one-second histogram maxima are not a whole-run p95. Role-aggregate25ms DB samples can miss brief peaks and cannot assign per-request pool waits. Eight is a per-client pool limit, not a whole-system connection limit. The read-only representative plan exports only node/row-count/timing/buffer facts and does not represent the complete protected endpoint.

The lifecycle fields follow [Undici diagnostics](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md); remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and live-session SQL remain unchanged. Faster probes cannot explain away the prior Phase13 roughly1.5-second identity phases or older multi-second tails. This change touches no backend query, provider call, database pool or identity behavior.

## Errors and adverse outcomes

'''
for label,key in [('main','countsAndTransportFlags'),('feature','featureCountsAndTransportFlags')]:
 for profile,flags in data[key].items():
  if flags['allOutcomes']:s+=f"{profile} {label}: {flags['allOutcomes']} outcomes; {flags['failedOutcomes']} failed useful-content outcomes, {flags['pageErrors']} page errors, {flags['httpErrors']} HTTP errors. Transport snapshots: {flags['failedTransports']} failed, {flags['pendingSSE']} pending SSE, {flags['pendingNonSSE']} other pending.\n\n"
for profile,flags in data['countsAndTransportFlags'].items():s+=f"{profile} interactions: {flags['interactionOutcomes']} outcomes; {flags['failedInteractions']} failed, {flags['interactionPageErrorsIncludingPreparation']} page errors including preparation, {flags['interactionTimedHttpErrors']} timed HTTP errors and {flags['interactionTimedFailedTransports']} timed failed transports. Other preparation network accounting is unavailable.\n\n"
s+=f"Native primary: {data['httpOutcomes']} reads; {data['httpFailed']} failures; all preserve private no-store and Cookie sensitivity. Failed/pending transport snapshots are distinct from failed useful-content outcomes. Exact sanitized routes, failure/status details and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.\n\n"
s+='All worsening quantiles remain in `REGRESSIONS.json`. The largest useful-content/source/paired-wait regressions of at least50ms appear below; omitted small differences remain fully retained. These small groups do not establish statistical significance.\n\n'
adverse=[r for r in read('REGRESSIONS.json') if r['metric'] in ['clickMs','sourceUsefulMs','sourcePlusClickMs','meaningfulMs'] and r['after']-r['before']>=50]
for row in sorted(adverse,key=lambda r:r['after']-r['before'],reverse=True)[:20]:
 group=' / '.join(str(row[k]) for k in ['category','profile','size','path','condition','kind'] if k in row);s+=f"- {group}, {row['metric']} {row['quantile']}: {row['before']:,.1f} → {row['after']:,.1f}ms.\n"
s+=f'''
## Recommendation

{interpretation} Keep publication of the complete series on hold pending the inherited Settings/review first-use costs and retained adverse tails. Do not generalize earlier code dispatch into broader prefetching or successful authorization reuse. The existing guarded render, ownership and live validation remain authoritative.

The experiment proves earlier dispatch in every measured cold Review case but saves no requests: constrained rounds TTFB p50 increases86.4→109.6ms while server total stays near27ms. This is consistent with browser/network scheduling contention or a later rendering/handoff cost, but does not isolate a cause. Warm constrained visits also worsen despite no editor-code request. Do not attribute that warm difference to a cold code download. The next frontend step should follow actual module-evaluation/component-commit/visible-content stages around Settings and Review, preserving the initial Recruiting bundle saving. Overlap can leave parsing, rendering, route handoff, other protected reads or browser scheduling on the critical path; this comparison alone does not isolate which dominates. For backend work, capture long identity phases with request-correlated substages under the affected browser workload before selecting a remedy. Investigate growing metadata/query/ranking work with parity tests before increasing concurrency or pool size. Hosted network/region behavior, multi-user saturation, direct/public entry coverage outside these cases and unmeasured preparation intervals remain limits.

Implementation/application diffs, exact source/build/package manifests, plan and controls, all raw accepted/pilot/diagnostic observations, test history, transport details, privacy scan, owned cleanup and checksums accompany this report. External checkout changes and unrelated services are preserved. No production changes or publication occurred.
'''
for a,b in [('Phase13','Phase 13'),('other912','other 912'),('all913','all 913'),('with913','with 913'),('the1,899','the 1,899'),('a1.9','a 1.9'),('increases86','increases 86'),('near27','near 27'),('Phase14','Phase 14'),('receive401','receive 401'),('expected10','expected 10'),('passes65','passes 65'),('complete69','complete 69'),('independent1,000','independent 1,000'),('Synthetic1,000','Synthetic 1,000'),('synthetic1,000','synthetic 1,000'),('CDP80','CDP 80'),('CPU4','CPU 4'),('n10','n=10'),('n6','n=6'),('for1,000','for 1,000'),('Membership:384','Membership: 384'),('quantiles:168','quantiles: 168'),('roughly1.5','roughly 1.5'),('least50','least 50'),('aggregate25','aggregate 25'),('lint0','lint 0'),('migrations;78','migrations; 78')]:s=s.replace(a,b)
for a,b in [('errors,22','errors, 22'),('All64','All 64'),('and336','and 336'),('mode0','mode 0'),('42 /42','42 / 42')]:s=s.replace(a,b)
(root/'PHASE14_REPORT.md').write_text('\n'.join(line.rstrip() for line in s.splitlines()).rstrip()+'\n');print('Phase14 report derived from complete retained observations.')
