"""Render the Phase15 result and its limits from complete retained evidence."""
from pathlib import Path
import json
root=Path('docs/performance/phase15');read=lambda n:json.loads((root/n).read_text());data=read('BENCHMARK_RESULTS.json');handoff=read('HANDOFF_TIMELINES.json');diag=read('DIAGNOSTIC_SUMMARY.json');tests=read('TEST_RESULTS.json');retained=read('FINAL_VERIFICATION.json');decision=read('DECISION.json');before=read('BASELINE_SOURCE.json');after=read('CANDIDATE_SOURCE.json')
def fmt(d):return f"{d['p50']:,.1f} / {d['p95']:,.1f}" if d and d.get('p50') is not None else 'unavailable'
def delta(row,key):return fmt(row['variants']['B'].get(key))+' → '+fmt(row['variants']['A'].get(key))
def feature(profile,condition):return next(r for r in data['features'] if r['profile']==profile and r['condition']==condition and r['path']=='settingsApplication → rounds')
def timing(profile,condition,variant):return next(r['metrics'] for r in handoff['summary'] if r['profile']==profile and r['condition']==condition and r['variant']==variant)
status='retained locally' if decision['adopted'] else 'rejected and reverted';target=feature('constrained','cold');warm=feature('constrained','warm')
s=f'''# OutClass performance — Phase 15

The Settings→Review handoff change is **{status}**. Constrained cold Review click p50 / p95 changes **{delta(target,'clickMs')}ms**; warm changes **{delta(warm,'clickMs')}ms**. Cold click requests change **{delta(target,'requestCount')}**, encoded bytes **{delta(target,'encodedBodyBytes')}**. {decision['reason']}

Comparison: Phase14 `{before['sourceRef']}` and its retained Phase13 application versus the exact candidate hashes in `CANDIDATE_SOURCE.json`. Baseline build `{before['buildId']}`, candidate `{after['buildId']}`. B denotes baseline and A candidate throughout the tables. Final chosen source/build is in `FINAL_SOURCE.json`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase15-20261026`. No push, PR, merge or deployment.

## Implementation and authority

Only `components/club-settings-workspace.tsx` differs in the measured application. **The final application has zero changes from baseline.** `EXPERIMENT_APPLICATION.diff` and `EXPERIMENT_IMPLEMENTATION.diff` preserve the measured candidate; `IMPLEMENTATION.diff` contains retained diagnostic tooling and opt-in tests. The Anonymous Review and Screening rules links retain the same leave/draft guard, delegate plain same-workspace clicks to the existing strict `handleClubLink` helper, and disable their unused server-page intent prefetch. The helper preserves modified and cross-page browser navigation. Existing history integration updates the query while the destination starts its fresh protected readers. The Phase14 speculative module preload remains rejected. Code deferral, animations, focus rules, layout, draft ownership, mutations and every other application file are unchanged.

The removed page request did not supply the rounds payload. In the measured candidate, the remaining explicit GET still remotely verifies identity and live Auth session/revocation, enabled account, club membership, capability and suspension. Other destination reads and mutations keep their original support-session, anonymous-interview and voting-snapshot authority checks. No successful authorization or protected result is cached between requests. Direct/new-tab entry retains the server page and its guards. Private no-store/Cookie sensitivity and Demo isolation remain. No production configuration, database region/schema/index, security policy, dependency, caching library, Redis or Edge Function change.

## Measured-candidate verification and setup history

| Check | Result |
|---|---|
'''
for label,value in [('Ordinary suite',f"{tests['ordinary']['passed']:,} passed; {tests['ordinary']['skipped']} environment-gated skips;0 failures;0 cancelled;{tests['ordinary']['total']:,} total"),('Complete selected live suite',f"{tests['live']['passed']} passed;0 failures;0 skips"),('Dedicated native security/concurrency',f"{tests['nativeSecurityConcurrency']['passed']} passed"),('Normal verified signup/Auth/TOTP',f"{tests['provisioning']['passed']} passed"),('Focused handoff checks',f"{tests['focusedHandoff']['passed']} passed; overlap live coverage"),('Existing migrations/browser denial','57 migrations;78 RLS tables'),('Builds, types and lint','Both production builds and types passed; lint0 errors,22 existing warnings')]:s+=f'| {label} | {value} |\n'
s+='''
Counts overlap and must not be added. New browser cases prove no redundant destination page GET for both handoffs, fresh rounds reads on history revisits, denial/no old editor after global provider-session revocation, blocked navigation during a real held draft save followed by the existing automatic replay, durable draft restoration without publishing, and ordinary modified-click new-tab entry. The final corrected handoff test is also run against baseline and fails for its actual redundant Review page request. The three ordinary diagnostics cases cover disposable guards, safe concurrent correlation and foreign-worker ownership. Existing suites retain GET allowlists/arguments, identity/session/account/membership/capability/suspension, support/anonymous scopes, voting authority, draft continuity, rapid switching, mobile/pointer behavior and native metadata parity. Optional gates remain explicit, not a claim that every optional suite ran.

Development failures remain recorded. The real textarea's accessible name includes its initial value, so the new test uses its actual name prefix. The request counter initially included legitimate browser-Back and unrelated Applicants prefetch; it now rejects only the two Review destination page GETs, while the complete benchmark retains all traffic. The shared autosave capture handler automatically retries navigation after a successful flush; the test verifies that contract rather than waiting for a status on an unmounted editor. No product guard, test timeout, animation or benchmark readiness rule changed.

The first ordinary attempt records1,416 passes,67 skips and one cancelled browser case, alongside repeated actual Mac Sleep/Wake events. It is retained as `unit-interrupted.log` and `QA_POWER_INTERRUPTION.json`. The entire suite is rerun under a temporary awake assertion before timing collection. `QA_AWAKE_AUDIT.json` retrospectively audits that complete QA resumption; it changes no primary row membership. Tests/builds finish before accepted timing collection. Both eight-outcome development pilots are excluded whole.

## Final retained-source verification

After diagnostics and rejection, all 913 application hashes match baseline and the existing baseline production build is restored. The complete ordinary suite passes again: **1,417 passed, 63 gated skips, zero failures/cancellations, 1,480 total**. The retained live selection passes **67 / 67**, with types and lint passing (22 existing warnings). Native security/concurrency already passed three cases; all relevant server/Auth/database sources and dependencies are identical. Counts overlap the earlier candidate verification.

The four candidate-only regression cases live in `tests/experiments/navigation-phase15-e2e.test.cjs`, require `OUTCLASS_PHASE15_EXPERIMENT=1` plus the disposable config, and pass again against the frozen candidate. A separate run with the live config but without that opt-in skips all four. They do not assert rejected behavior against the retained application. `FINAL_VERIFICATION.json` records every command interval/status.

## Measurement controls and membership

Same independent1,000/5,000 synthetic cohorts within each build pair, BA then AB order, local and CDP80ms/200,000B/s down/93,750B/s up/CPU4×. Main groups: one warmup plus five measured per build/block/path/condition, final n10 per variant. Feature groups: one warmup plus three measured in both profiles at1,000 applicants, n6. Nearest-rank p95 is a maximum for these small groups. Cold/warm refers to the destination in fresh browser contexts with warm local production Next/Auth/database services.

Membership:384 main browser outcomes (320 measured/64 warmups),256 feature outcomes (192/64),192 page/search interactions (160/32) and336 native HTTP outcomes (280/56). Prior phases, development pilots and separate instrumented probes are never pooled into these quantiles. Source and subsequent click are measured separately. Source+click is a per-row sum of two useful-content waits, excluding drains/preparation/warm visits; it is not uninterrupted elapsed journey time. Pre-click intent traffic outside capture windows is not fully accounted. Encoded bodies exclude unavailable late/pending bytes and headers.

Five-second read-only samples monitor known foreign build/test work, dev-worker CPU, original checkout changes, total CPU/free memory and power source/mode. Source/tool/plan/package manifests and actual Sleep/Wake/DarkWake are checked. An observed violation invalidates a whole profile; no slow row is selectively replaced. The user confirmed an idle/open-lid window and permits battery operation; one recorded initial source and low-power mode0 remain fixed within each profile. Temporary awake assertions change no persistent settings. Sampling can miss brief activity; exclusive access, CPU frequency and thermal state are not proven. Unrelated services and checkout changes remain preserved.

| Profile | Start / end UTC | Host samples | Power | Controls / actual sleep |
|---|---|---:|---|---|
'''
for name in ['local','constrained']:
 p=read(name+'/PROTOCOL.json');h=read(name+'/HOST_MONITOR.json');assert p['complete'] and h['valid'];s+=f"| {name} | {p['startedAt']} / {p['completedAt']} | {len(h['samples'])} | {h['powerBaseline']['source']}, mode{h['powerBaseline']['lowPowerMode']}; {h['samples'][0]['batteryPercent']}% → {h['samples'][-1]['batteryPercent']}% | Passed / no sleep interruption |\n"
s+='\n## Targeted Review handoff\n\nAll timings, requests and bytes are p50 / p95.\n\n| Profile / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for profile in ['local','constrained']:
 for condition in ['cold','warm']:
  row=feature(profile,condition);s+=f"| {profile} / {condition} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourcePlusClickMs')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n| Constrained observed stage | Cold B → A p50 / p95 | Warm B → A p50 / p95 |\n|---|---:|---:|\n'
for field,label in [('clickToUrlMs','Click→query URL ms'),('roundsStartMs','Rounds request start ms'),('roundsEndMs','Rounds response end ms'),('roundsToUsefulMs','Rounds-end→useful DOM ms'),('workspacePageFetches','All captured workspace page GETs'),('observedWorkspacePageBytes','Observed page body bytes'),('unknownWorkspacePageBodies','Unknown page-body snapshots'),('faviconRequests','Favicon requests'),('roundsTtfbMs','Rounds TTFB ms'),('roundsTransferMs','Rounds transfer ms'),('server_totalMs','Rounds server total ms'),('server_identityMs','Identity verification ms'),('server_live_sessionMs','Live session ms'),('server_databaseMs','Database span ms'),('capturedScriptRequests','Captured script requests'),('lastCapturedScriptBeforeUsefulMs','Last captured pre-useful script end ms'),('scriptToUsefulMs','Script-end→useful DOM ms'),('scriptMs','Browser script delta ms'),('taskMs','Browser task delta ms'),('reactCommitCount','Observed page React commits')]:
 values=[fmt(timing('constrained',c,'B').get(field))+' → '+fmt(timing('constrained',c,'A').get(field)) for c in ['cold','warm']];s+=f'| {label} | {values[0]} | {values[1]} |\n'
s+='\nTimeline gaps locate observed waiting; they are not exclusive React render duration. Script/task deltas include bounded post-content drain. Sanitized primary page routes omit query values and may include unrelated prefetch or Back traffic. The targeted browser test independently proves that the two Review destination page GETs disappear; it does not suppress other requests. All64 targeted rows and script completions after useful content remain in `HANDOFF_TIMELINES.json`.\n'
s+='\n## Other feature and main navigation\n\n| Profile / feature / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for row in data['features']:
 if row['path']!='settingsApplication → rounds':s+=f"| {row['profile']} / {row['path']} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourcePlusClickMs')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n| Profile / applicants / destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Bytes before → after |\n|---|---:|---:|---:|---:|---:|\n'
for row in data['browser']:
 destination='Detail' if row['path'].endswith(' → applicantDetail') else 'List';s+=f"| {row['profile']} / {row['size']:,} / {destination} / {row['condition']} | {delta(row,'sourceUsefulMs')} | {delta(row,'clickMs')} | {delta(row,'sourceRequests')} | {delta(row,'requestCount')} | {delta(row,'encodedBodyBytes')} |\n"
s+='\n## Page/search and bounded native reads\n\n| Profile / applicants / interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |\n|---|---:|---:|---:|\n'
for row in data['interactions']:s+=f"| {row['profile']} / {row['size']:,} / {row['kind']} | {fmt(row['variants']['B']['meaningfulMs'])} | {fmt(row['variants']['A']['meaningfulMs'])} | {delta(row,'requestCount')} |\n"
s+='\n| Applicants / readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |\n|---|---:|---:|\n'
for row in data['http']:s+=f"| {row['size']:,} / {row['concurrency']} | {delta(row,'burstMs')} | {delta(row,'requestMs')} |\n"
s+='''
## Why the cold-tail requirement failed

All six measured candidate cold clicks remain included: 463.1, 464.5, 465.0, 466.2, 493.5 and 1,463.2ms. In the slow row (`constrained/size-1000-pair-2-1-A-features-measure/browser-samples.json`, index 19), the query URL changes after 1.7ms, but rounds dispatch starts at 169ms and ends at 1,126ms. Rounds reports 932.40ms identity, 17.54ms summed database spans and 956.12ms server total. The editor scripts subsequently finish around 1,276ms; useful content arrives at 1,463.2ms. The preceding source also stalls: 8,314ms useful-content time, including identity spans of 4,221.61ms on corkboard, 4,199.79ms on invitations and 3,895.65ms on tutorial. Those spans overlap and must not be added.

The unchanged primary collector locates server identity waiting; it does not distinguish provider execution, connection/dispatch or process scheduling during this row. Host and sleep controls pass, which rules out observed protocol violations but does not establish exclusive access or thermal/frequency stability. The separate instrumented diagnostics observe completed Auth HTTP maxima below 92ms and therefore do not reproduce or explain the primary multi-second stall. This prevents claiming a cold-p95 win or dismissing the row as unrelated. The frozen interpretation rule is unmet despite real median and structural request improvements. No repeat was used to replace this result.

## Separate server diagnostics and tails\n\nOutside primary quantiles:168 instrumented native GETs,56 direct SDK identity observations,32 feature-browser outcomes and four read-only representative metadata plans. Native request IDs correlate with the existing phase UUIDs and Auth HTTP substages. Direct SDK observations never authorize an application request or replace live-session SQL.\n\n| Applicants / build | Native trace matches | Max completed Auth HTTP ms | Max event-loop delay ms | Metadata plan execution ms | App-role max active / connections / lock waiting |\n|---|---:|---:|---:|---:|---:|\n'''
for case in diag['cases']:
 pool=case['poolAggregateMaxima']['app_role'];s+=f"| {case['size']:,} / {case['variant']} | {case['correlation']['matchedRequestTimelines']} /42 | {case['allIncomingAuthHttpTotalMs']['max']:,.2f} | {case['maxRecordedEventLoopDelayMs']:,.2f} | {case['queryPlan']['executionMs']:,.2f} | {pool['active']} / {pool['connections']} / {pool['lock_waiting']} |\n"
s+='\n| Four-reader diagnostic | Identity p50 / p95 ms | Auth create→send | Auth send→headers | Database span | Observable acquisition |\n|---|---:|---:|---:|---:|---:|\n'
for case in diag['cases']:
 m=next(g for g in case['groups'] if g['concurrency']==4)['metrics'];s+=f"| {case['size']:,} / {case['variant']} | {fmt(m['server_identityMs'])} | {fmt(m['auth_createdToSendMs'])} | {fmt(m['auth_sendToHeadersMs'])} | {fmt(m['server_databaseMs'])} | {fmt(m['server_transaction_acquireMs'])} |\n"
s+='\n| Largest measured primary phase | Value ms | Location |\n|---|---:|---|\n'
for phase,values in read('SERVER_TAILS.json')['largestThreeByPhase'].items():
 if values:
  row=values[0];s+=f"| {phase} | {row['phases'][phase]:,.2f} | {row['profile']} / {row['variant']} / {row['path']} / {row['condition']} / {row['stage']} / {row['route']} |\n"
s+='''
Database spans sum elapsed query calls, including observable waiting/transport, and may overlap or exceed response wall time. Transaction acquisition includes BEGIN/transport and is not pool-only waiting. Auth create→send includes dispatch/connection/scheduling; send→headers includes provider/transport/scheduling; headers→end is body completion. Process-window CPU overlaps other requests; per-second histogram maxima are not whole-run p95. Aggregate25ms DB samples may miss brief peaks, and eight is a per-client pool limit. The representative plan is not the complete endpoint and exports no SQL parameter values or rows.

The lifecycle observations follow [Undici diagnostics](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md). Remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and live-session SQL remain unchanged. These diagnostics do not explain away prior intermittent identity/database tails or establish hosted/multi-user capacity.

## Errors and adverse observations

'''
for label,key in [('main','countsAndTransportFlags'),('feature','featureCountsAndTransportFlags')]:
 for profile,f in data[key].items():
  if f['allOutcomes']:s+=f"{profile} {label}: {f['allOutcomes']} outcomes; {f['failedOutcomes']} failed useful-content outcomes, {f['pageErrors']} page errors, {f['httpErrors']} HTTP errors. Transport snapshots: {f['failedTransports']} failed, {f['pendingSSE']} pending SSE, {f['pendingNonSSE']} other pending.\n\n"
for profile,f in data['countsAndTransportFlags'].items():s+=f"{profile} interactions: {f['interactionOutcomes']} outcomes, {f['failedInteractions']} failed, {f['interactionPageErrorsIncludingPreparation']} page errors including preparation, {f['interactionTimedHttpErrors']} timed HTTP errors and {f['interactionTimedFailedTransports']} timed failed transports. Other preparation network accounting is unavailable.\n\n"
s+=f"Native primary: {data['httpOutcomes']} reads, {data['httpFailed']} failures; all preserve private no-store and Cookie sensitivity. Pending/failed transport snapshots are distinct from failed useful-content outcomes. Exact routes/statuses/failure reasons and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.\n\n"
s+='Every worsening quantile remains in `REGRESSIONS.json`. Largest useful-content/source/paired-wait regressions of at least50ms are listed below, including unchanged paths. Small groups do not establish statistical significance or causality.\n\n'
adverse=[r for r in read('REGRESSIONS.json') if r['metric'] in ['clickMs','sourceUsefulMs','sourcePlusClickMs','meaningfulMs'] and r['after']-r['before']>=50]
for row in sorted(adverse,key=lambda r:r['after']-r['before'],reverse=True)[:20]:
 group=' / '.join(str(row[k]) for k in ['category','profile','size','path','condition','kind'] if k in row);s+=f"- {group}, {row['metric']} {row['quantile']}: {row['before']:,.1f} → {row['after']:,.1f}ms.\n"
s+=f'''
## Recommendation

{decision['recommendation']}

Keep publication of the complete series on hold until the remaining Settings first-use tradeoff and server-tail risks are resolved. This change does not alter Settings module loading, profile/draft reads, animations or backend queries. Diagnose remaining module/data/render/frame stages without assuming a gap is pure React time. Preserve the Recruiting bundle saving. Capture intermittent identity stalls with request-correlated substages under the affected workload; investigate growing metadata/query/ranking work with parity tests before increasing concurrency or pool size. No successful authorization reuse is justified.

The next phase should prioritize a request-correlated diagnosis of the affected constrained source-and-Review workload before another optimization attempt. Retest the preserved candidate only after that cause is understood, using a fresh complete paired protocol.

All source/build/package manifests, diffs, controls, test history, accepted/pilot/diagnostic observations, timings, privacy scan, chosen-source cleanup and checksums accompany this report. Original checkout changes and unrelated services remain preserved. No live production resources or deployments changed.
'''
for a,b in [('Phase14','Phase 14'),('Phase13','Phase 13'),('failures;0','failures; 0'),('skips;0','skips; 0'),('cancelled;','cancelled; '),('lint0','lint 0'),('errors,22','errors, 22'),('migrations;78','migrations; 78'),('records1,416','records 1,416'),('passes,67','passes, 67'),('attempt records1','attempt records 1'),('independent1,000','independent 1,000'),('CDP80','CDP 80'),('CPU4','CPU 4'),('n10','n=10'),('n6','n=6'),('at1,000','at 1,000'),('Membership:384','Membership: 384'),('and336','and 336'),('mode0','mode 0'),('All64','All 64'),('quantiles:168','quantiles: 168'),('aggregate25','aggregate 25'),('Aggregate25','Aggregate 25'),('least50','least 50'),('42 /42','42 / 42')]:s=s.replace(a,b)
(root/'PHASE15_REPORT.md').write_text('\n'.join(line.rstrip() for line in s.splitlines()).rstrip()+'\n');print('Phase15 report derived from complete evidence and adoption decision.')
