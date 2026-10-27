from pathlib import Path
import json,math,collections
root=Path('docs/performance/followup-20261027');study=root/'diagnosis-1';read=lambda p:json.loads(p.read_text())
def dist(values):
 a=sorted(v for v in values if isinstance(v,(int,float)) and math.isfinite(v));return {'n':len(a),'p50':a[math.ceil(len(a)*.5)-1] if a else None,'p95':a[math.ceil(len(a)*.95)-1] if a else None,'max':a[-1] if a else None}
p=read(study/'PROTOCOL.json');assert p['complete'] and not p['failures'] and p['samplerFailures']==0 and p['hostControl']['valid'];assert read(study/'POWER_AUDIT.json')['acceptedPowerInterval'];assert len(p['blocks'])==4
browser=[];trace_refs=collections.defaultdict(list)
for block in p['blocks']:
 file=study/block['directory']/'browser-samples.json';data=read(file);assert len(data['samples'])==40 and not data['failures']
 for index,row in enumerate(data['samples']):
  assert not row.get('failed');row['_evidence']={'file':str(file.relative_to(root)),'index':index};browser.append(row)
  for stage,requests in [('source',row['preparation']['requests']),('click',row['requests'])]:
   for request in requests:
    if request.get('traceId'):trace_refs[request['traceId']].append({'file':str(file.relative_to(root)),'index':index,'path':row['path'],'condition':row['condition'],'stage':stage,'route':request['route']})
assert len(browser)==160
server=read(study/'SERVER_EVENTS.json')['events'];requests=[e for e in server if e['event']=='followup.request'];phases={e['traceId']:e for e in server if e['event']=='workspace.phases'};gc=[e for e in server if e['event']=='followup.gc'];loops=[e for e in server if e['event']=='followup.event_loop'];provider=read(study/'PROVIDER_EVENTS.json')['events'];resources=read(study/'RESOURCE_SAMPLES.json')
auth=[]
for request in requests:
 phase=phases.get(request.get('traceId'));identity=phase.get('phases',{}).get('identity',{}).get('ms') if phase else None
 completed=[a for a in request['auth'] if a['category']=='auth_user' and isinstance(a.get('totalMs'),(int,float))]
 for event in request['auth']:
  if event['category']!='auth_user':continue
  row={'requestId':request['requestId'],'traceId':request.get('traceId'),'category':request['category'],'at':request['at'],'requestElapsedMs':request['elapsedMs'],'identityMs':identity,'http':event,'processWindow':request.get('processWindow'),'browserReferences':trace_refs.get(request.get('traceId'),[]),'identityMinusCompletedHttpMs':identity-sum(a['totalMs'] for a in completed) if identity is not None and completed else None}
  if isinstance(event.get('totalMs'),(int,float)) and isinstance(event.get('gatewayUpstreamMs'),(int,float)) and isinstance(event.get('gatewayProxyMs'),(int,float)):row['httpMinusGatewayHeaderStagesMs']=event['totalMs']-event['gatewayUpstreamMs']-event['gatewayProxyMs']
  start=request.get('startProcessMs',0)+event['startMs'];end=start+(event.get('totalMs') or 0)
  row['overlappingGc']=[{'startProcessMs':g['startProcessMs'],'durationMs':g['durationMs'],'kind':g['kind']} for g in gc if g['startProcessMs']<=end and g['startProcessMs']+g['durationMs']>=start]
  row['eventLoopWindows']=[{k:e[k] for k in ['processOffsetMs','utilization','delayP95Ms','delayMaxMs','memoryBytes','resourceUsage']} for e in loops if start<=e['processOffsetMs']<=end+1000]
  auth.append(row)
groups=collections.defaultdict(list)
for row in browser:groups[(row['path'],row['condition'])].append(row)
browser_summary=[]
for (path,condition),rows in groups.items():
 assert len(rows)==20
 request_groups=collections.defaultdict(list)
 for row in rows:
  for stage,requests in [('source',row['preparation']['requests']),('click',row['requests'])]:
   for request in requests:request_groups[(stage,request['route'],request.get('method'),request.get('type'))].append(request)
 request_timings=[]
 for (stage,route,method,kind),requests in request_groups.items():
  phases=collections.defaultdict(list)
  import re
  for request in requests:
   for label,value in re.findall(r'([a-z_]+);dur=([0-9.]+)',request.get('serverTiming') or ''):phases[label].append(float(value))
  request_timings.append({'stage':stage,'route':route,'method':method,'type':kind,'observations':len(requests),'timings':{field:dist([r.get(field) for r in requests]) for field in ['startMs','endMs','ttfbMs','transferMs','encodedBodyBytes']},'serverPhasesMs':{label:dist(values) for label,values in phases.items()},'failedSnapshots':sum(bool(r.get('failed')) for r in requests),'pendingSnapshots':sum(r.get('endMs') is None and not r.get('failed') for r in requests),'unknownBodySnapshots':sum(r.get('encodedBodyBytes') is None for r in requests)})
 browser_summary.append({'path':path,'condition':condition,'n':20,'clickMs':dist([r['meaningfulMs'] for r in rows]),'sourceMs':dist([r['preparation']['meaningfulMs'] for r in rows]),'requestCount':dist([r['requestCount'] for r in rows]),'metrics':{field:dist([r.get(field) for r in rows]) for field in ['clickToUrlMs','interactiveMs','networkCompleteMs','encodedBodyBytes','scriptMs','taskMs','layoutMs','pageErrorCount']},'requestTimings':request_timings,'sampleReferences':[r['_evidence'] for r in rows]})
metrics={k:dist([r['http'].get(k) for r in auth]) for k in ['totalMs','createdToSendMs','sendToHeadersMs','headersToEndMs','gatewayUpstreamMs','gatewayProxyMs']};metrics['workspaceIdentityPerRequestMs']=dist([r.get('phases',{}).get('identity',{}).get('ms') for r in phases.values()]);metrics['httpMinusGatewayHeaderStagesMs']=dist([r.get('httpMinusGatewayHeaderStagesMs') for r in auth]);metrics['identityMinusCompletedHttpMs']=dist(list({r['requestId']:r.get('identityMinusCompletedHttpMs') for r in auth}.values()))
resource_max={}
for sample in resources['poolSamples']:
 for row in sample['rows']:
  target=resource_max.setdefault(row['category'],{})
  for k,v in row.items():
   if k!='category':target[k]=max(target.get(k,0),v)
container_max={}
for sample in resources['containerSamples']:
 for row in sample['rows']:
  target=container_max.setdefault(row['category'],{})
  for k,v in row.items():
   if k!='category' and isinstance(v,(int,float)):target[k]=max(target.get(k,0),v)
summary={'acceptedPerformanceData':False,'scope':'All160 instrumented browser outcomes, one retained build, no before/after claim. Existing primary results remain immutable.','browser':browser_summary,'incomingRequests':len(requests),'workspacePhaseRecords':len(phases),'authHttpUserObservations':len(auth),'providerUserLogObservations':len(provider),'providerExactRequestIdJoinAvailable':False,'authMetrics':metrics,'providerDurationMs':dist([r['providerDurationMs'] for r in provider]),'providerStatuses':dict(collections.Counter(r['status'] for r in provider)),'gcEvents':len(gc),'gcDurationMs':dist([r['durationMs'] for r in gc]),'eventLoopMaxima':{k:max((r[k] or 0 for r in loops),default=None) for k in ['delayP95Ms','delayMaxMs','utilization']},'poolAggregateMaxima':resource_max,'containerAggregateMaxima':container_max,'authHttpFailures':sum(bool(r['http']['failed']) for r in auth),'authHttpIncompleteSnapshots':sum(r['http'].get('totalMs') is None for r in auth),'gatewayTimingMissing':sum(r['http'].get('gatewayUpstreamMs') is None for r in auth),'largestAuthHttp':sorted(auth,key=lambda r:r['http'].get('totalMs') or -1,reverse=True)[:30],'largestIdentity':sorted(list({r['requestId']:r for r in auth if r['identityMs'] is not None}.values()),key=lambda r:r['identityMs'],reverse=True)[:30],'limits':['Auth HTTP/gateway/provider durations are nested/overlapping and include different transport/scheduling/body boundaries. Signed differences are descriptive gaps, not pure network or SDK CPU.','Provider logs have no response UUID join in this fixture; complete duration aggregates are separate, not invented per-request matches.','GC overlap is temporal, not exclusive pause attribution; per-second event-loop windows and role/container samples can miss brief events.','One controlled app process supplies monotonic clocks; process-wide CPU/resource counters overlap concurrent requests.','All observations are instrumented local diagnosis and cannot establish hosted causes or production capacity.']}
(root/'DIAGNOSTIC_SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');(root/'AUTH_HTTP_OBSERVATIONS.json').write_text(json.dumps({'scope':summary['scope'],'rows':auth},indent=2)+'\n');print(json.dumps({k:summary[k] for k in ['authHttpUserObservations','providerUserLogObservations','authMetrics','providerDurationMs','eventLoopMaxima','gcDurationMs','poolAggregateMaxima','containerAggregateMaxima']}))
