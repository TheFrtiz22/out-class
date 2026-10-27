"""Summarize separately instrumented loopback observations without pooling them."""
from pathlib import Path
import json,re,math,collections
root=Path('docs/performance/phase15');read=lambda p:json.loads(p.read_text())
def dist(values):
 values=sorted(v for v in values if isinstance(v,(int,float)))
 return {'n':len(values),'p50':values[math.ceil(len(values)*.5)-1] if values else None,'p95':values[math.ceil(len(values)*.95)-1] if values else None,'max':max(values) if values else None}
results=[]
for case in read(root/'PLAN.json')['diagnostics']['cases']:
 file=root/'diagnostics'/f"{case['size']}-{case['variant']}.json";data=read(file);assert data['acceptedPerformanceData'] is False;assert len(data['httpSamples'])==42 and len(data['directIdentitySamples'])==14
 assert all(not q['failed'] and q['privateNoStore'] and q['cookieSensitive'] for q in data['httpSamples']);assert all(q['valid'] and q['status']==200 for q in data['directIdentitySamples'])
 assert data['correlation']=={'nativeRequests':42,'matchedRequestTimelines':42,'requestsWithAuthTimeline':42}
 request_by_trace={e['traceId']:e for e in data['serverEvents'] if e['event']=='phase15.request' and e['traceId']};phase_by_trace={e['traceId']:e for e in data['serverEvents'] if e['event']=='workspace.phases'};groups=[]
 for concurrency in [1,2,4]:
  native=[q for q in data['httpSamples'] if not q['warmup'] and q['concurrency']==concurrency];metrics=collections.defaultdict(list)
  for q in native:
   request=request_by_trace[q['traceId']];auth=[a for a in request['auth'] if a['category']=='auth_user'];assert len(auth)==1
   for field in ['elapsedMs','ttfbMs','encodedBodyBytes']:metrics[field].append(q[field])
   for field in ['createdToSendMs','sendToHeadersMs','headersToEndMs','totalMs']:metrics['auth_'+field].append(auth[0][field])
   for phase,span in phase_by_trace[q['traceId']]['phases'].items():metrics['server_'+phase+'Ms'].append(span['ms'])
   identity=phase_by_trace[q['traceId']]['phases'].get('identity',{}).get('ms');metrics['identitySpanMinusCapturedHttpMs'].append(identity-auth[0]['totalMs'] if identity is not None else None)
   for field in ['cpuUserMs','cpuSystemMs','eventLoopUtilization']:metrics['processWindow_'+field].append(request['processWindow'][field])
  direct=[q['elapsedMs'] for q in data['directIdentitySamples'] if q['concurrency']==concurrency];groups.append({'concurrency':concurrency,'nativeMeasured':len(native),'metrics':{field:dist(values) for field,values in metrics.items()},'directSdkGetUserMs':dist(direct)})
 loop=[e for e in data['serverEvents'] if e['event']=='phase15.event_loop'];pool={}
 for category in ['app_role','auth_role','other_role']:
  rows=[r for sample in data['poolSamples'] for r in sample['rows'] if r['category']==category];pool[category]={field:max([r[field] for r in rows] or [0]) for field in ['connections','active','idle_in_transaction','lock_waiting','io_waiting','lwlock_waiting','client_waiting']}
 all_auth=[(e,a) for e in data['serverEvents'] if e['event']=='phase15.request' for a in e['auth'] if a['category']=='auth_user'];complete_auth=[pair for pair in all_auth if pair[1]['totalMs'] is not None];peak=max(complete_auth,key=lambda pair:pair[1]['totalMs']) if complete_auth else None
 browser=read(root/'diagnostics'/f"{case['size']}-{case['variant']}-browser/browser-samples.json");assert len(browser['samples'])==8 and not browser['failures']
 results.append({'size':case['size'],'variant':case['variant'],'file':str(file.relative_to(root)),'groups':groups,'correlation':data['correlation'],'queryPlan':data['queryPlan'],'poolAggregateMaxima':pool,'eventLoopIntervals':len(loop),'maxOneSecondP95DelayMs':max([e['delayP95Ms'] for e in loop if e['delayP95Ms'] is not None] or [0]),'maxRecordedEventLoopDelayMs':max([e['delayMaxMs'] for e in loop if e['delayMaxMs'] is not None] or [0]),'incomingAuthTimelineCount':len(all_auth),'incomingAuthIncompleteTimelines':len(all_auth)-len(complete_auth),'allIncomingAuthHttpTotalMs':dist([a['totalMs'] for _,a in all_auth]),'largestAuthTimeline':{'requestId':peak[0]['requestId'],'traceId':peak[0]['traceId'],'category':peak[0]['category'],'at':peak[0]['at'],'auth':peak[1]} if peak else None,'instrumentedBrowserOutcomes':8})
(root/'DIAGNOSTIC_SUMMARY.json').write_text(json.dumps({'acceptedPerformanceData':False,'scope':'Four separate instrumented cases. Native groups n5/10/20 measured requests, direct SDK groups n2/4/8. Nearest-rank p95 is often a maximum. SDK wall time includes response parsing; Auth HTTP phases do not isolate provider CPU. Process-window CPU overlaps requests; histogram summaries are maxima of1-second windows, not whole-run p95. Role aggregates and representative plans cannot prove per-request pool wait.','cases':results,'nativeOutcomes':168,'directIdentityOutcomes':56,'instrumentedBrowserOutcomes':32,'readOnlyPlans':4},indent=2)+'\n');print('Separate diagnostic traces, stage bounds, plan facts and pool/event-loop observations summarized.')
