"""Derive every declared group, warmup/error count and regression from raw rows."""
from pathlib import Path
import json, math, re, collections
root=Path('docs/performance/phase13')
def dist(values):
 v=sorted(x for x in values if isinstance(x,(int,float)))
 return {'n':len(v),'p50':v[max(0,math.ceil(len(v)*.5)-1)] if v else None,'p95':v[max(0,math.ceil(len(v)*.95)-1)] if v else None}
def phases(requests):
 result=collections.defaultdict(float)
 for r in requests:
  if re.fullmatch(r'/api/workspace\?kind=pipeline(?:Page|List)?',r['route']):
   for k,v in re.findall(r'([a-z_]+);dur=([0-9.]+)',r.get('serverTiming') or ''):result[k]+=float(v)
 return result
def cls(fonts):
 maximum=0;start=previous=None;current=0
 for shift in fonts['layoutShifts']:
  if shift['hadRecentInput']:continue
  at=shift['atMs']
  if previous is None or at-previous>=1000 or at-start>=5000:start=at;current=0
  current+=shift['value'];maximum=max(maximum,current);previous=at
 return maximum
all_comparisons=[];feature_comparisons=[];regressions=[];outcomes=[];features=[];interactions=[];http=[];source_peaks=[];peaks=[];pool_observations=[];interaction_file_errors=collections.Counter()
for profile in ['local','constrained']:
 protocol=json.loads((root/profile/'PROTOCOL.json').read_text());assert protocol['complete'] and not protocol['failures']
 for block in protocol['completed']:
  tag=re.search(r'size-(\d+)-pair-\d-\d-([AB])-(measure|warmup)',block['directory']);size=int(tag[1]);variant=tag[2];measured=tag[3]=='measure'
  data=json.loads((root/profile/block['directory']/'browser-samples.json').read_text())
  assert len(data['samples'])==block['planned']
  for i,row in enumerate(data['samples']):
   outcomes.append({'profile':profile,'size':size,'variant':variant,'measured':measured,'file':block['directory']+'/browser-samples.json','index':i,'row':row})
 for block in protocol['features']:
  tag=re.search(r'size-(\d+)-pair-\d-\d-([AB])-features-(measure|warmup)',block['directory']);data=json.loads((root/profile/block['directory']/'browser-samples.json').read_text());assert len(data['samples'])==block['planned']
  for i,row in enumerate(data['samples']):features.append({'profile':profile,'size':int(tag[1]),'variant':tag[2],'measured':tag[3]=='measure','file':block['directory']+'/browser-samples.json','index':i,'row':row})
 for block in protocol['interactions']:
  tag=re.search(r'size-(\d+)-pair-\d-\d-([AB])',block['file']);data=json.loads((root/profile/block['file']).read_text());interaction_file_errors[profile]+=len(data['errors'])
  for i,row in enumerate(data['samples']):interactions.append({'profile':profile,'size':int(tag[1]),'variant':tag[2],'measured':not row['warmup'],'file':block['file'],'index':i,'row':row})
 for block in protocol['concurrency']:
  tag=re.search(r'size-(\d+)-pair-\d-\d-([AB])',block['file']);data=json.loads((root/profile/block['file']).read_text())
  pool_observations.append({'profile':profile,'size':int(tag[1]),'variant':tag[2],'file':block['file'],'samples':len(data['poolSamples']),'maxima':{k:max(r[k] for r in data['poolSamples']) for k in ['connections','active','idle_in_transaction','lock_waiting']}})
  for index,row in enumerate(data['samples']):http.append({'profile':profile,'size':int(tag[1]),'variant':tag[2],'measured':not row['warmup'],'file':block['file'],'index':index,'row':row})
groups=collections.defaultdict(list)
for item in outcomes+features:
 if item['measured']:groups[('feature' if item in features else 'primary',item['profile'],item['size'],item['row']['path'],item['row']['condition'])].append(item)
for group,items in groups.items():
 pairs={}
 for variant in ['B','A']:
  rows=[i['row'] for i in items if i['variant']==variant];metrics=collections.defaultdict(list)
  for r in rows:
   s=r['preparation'];req=s['requests'];f=s['fonts'];main=[q for q in r['requests'] if re.fullmatch(r'/api/workspace\?kind=pipeline(?:Page|List)?',q['route'])]
   metrics['clickMs'].append(r.get('meaningfulMs'));metrics['networkCompleteMs'].append(r.get('networkCompleteMs'));metrics['requestCount'].append(r.get('requestCount'));metrics['encodedBodyBytes'].append(r.get('encodedBodyBytes'));metrics['scriptMs'].append(r.get('scriptMs'));metrics['taskMs'].append(r.get('taskMs'))
   metrics['sourcePlusClickMs'].append(s['meaningfulMs']+r['meaningfulMs'] if r.get('meaningfulMs') is not None else None);metrics['clickScriptBytes'].append(sum(q.get('encodedBodyBytes') or 0 for q in r['requests'] if q['type']=='script'));metrics['clickScriptRequests'].append(sum(q['type']=='script' for q in r['requests']));metrics['dataTtfbMs'].extend(q.get('ttfbMs') for q in r['requests'] if q['type']=='fetch' and not q.get('pending'));metrics['dataTransferMs'].extend(q.get('transferMs') for q in r['requests'] if q['type']=='fetch' and not q.get('pending'));
   metrics['sourceUsefulMs'].append(s['meaningfulMs']);metrics['sourceDrainedMs'].append(s['elapsedMs']);metrics['sourceRequests'].append(len(req));metrics['sourceBodyBytes'].append(sum(q.get('encodedBodyBytes') or 0 for q in req));metrics['sourceScriptBytes'].append(sum(q.get('encodedBodyBytes') or 0 for q in req if q['type']=='script'));metrics['sourceScriptRequests'].append(sum(q['type']=='script' for q in req));metrics['sourceFontBytes'].append(sum(q.get('encodedBodyBytes') or 0 for q in req if q['type']=='font'));metrics['sourceFontRequests'].append(sum(q['type']=='font' for q in req));metrics['fontReadyMs'].append(f['readyMs']);metrics['sourceCLS'].append(cls(f))
   for paint in f['paint']:metrics[paint['name']+'Ms'].append(paint['atMs'])
   for k,v in phases(r['requests']).items():metrics['server_'+k+'Ms'].append(v)
   for q in main:metrics['readTtfbMs'].append(q.get('ttfbMs'));metrics['readTransferMs'].append(q.get('transferMs'))
  pairs[variant]={k:dist(v) for k,v in metrics.items()}
 comparison={'category':group[0],'profile':group[1],'size':group[2],'path':group[3],'condition':group[4],'variants':pairs};(feature_comparisons if group[0]=='feature' else all_comparisons).append(comparison)
 for metric in pairs['B']:
  if metric not in pairs['A']:continue
  for quantile in ['p50','p95']:
   b=pairs['B'][metric][quantile];a=pairs['A'][metric][quantile]
   if a is not None and b is not None and a>b:regressions.append({**{k:v for k,v in comparison.items() if k!='variants'},'metric':metric,'quantile':quantile,'before':b,'after':a})
 for variant in ['B','A']:
  candidates=[i for i in items if i['variant']==variant];peak=max(candidates,key=lambda i:i['row']['preparation']['meaningfulMs']);source_peaks.append({'category':group[0],'profile':group[1],'size':group[2],'path':group[3],'condition':group[4],'variant':variant,'file':peak['file'],'index':peak['index'],'sourceUsefulMs':peak['row']['preparation']['meaningfulMs'],'sourcePreparation':peak['row']['preparation']})
for category,observations,keyfn,metric in [('click',outcomes+features,lambda i:(i['profile'],i['size'],i['row']['path'],i['row']['condition'],i['variant']),'meaningfulMs'),('interaction',interactions,lambda i:(i['profile'],i['size'],i['row']['kind'],i['variant']),'meaningfulMs'),('http-request',http,lambda i:(i['profile'],i['size'],i['row']['concurrency'],i['variant']),'elapsedMs')]:
 peak_groups=collections.defaultdict(list)
 for i in observations:
  if i['measured']:peak_groups[keyfn(i)].append(i)
 for key,items in peak_groups.items():
  peak=max(items,key=lambda i:i['row'].get(metric) or -1);row=peak['row'];peaks.append({'category':category,'group':key,'profile':peak['profile'],'file':peak['file'],'index':peak['index'],'durationMs':row.get(metric),'row':{k:v for k,v in row.items() if k not in ['preparation','authorityEvents']}})
interaction_groups=collections.defaultdict(list)
for i in interactions:
 if i['measured']:interaction_groups[(i['profile'],i['size'],i['row']['kind'])].append(i)
interaction_summary=[]
for key,items in interaction_groups.items():
 pairs={}
 for v in ['B','A']:
  rows=[i['row'] for i in items if i['variant']==v];metrics=collections.defaultdict(list)
  for row in rows:
   for metric_name in ['meaningfulMs','requestCount','encodedBodyBytes']:metrics[metric_name].append(row.get(metric_name))
   for q in row['requests']:metrics['readTtfbMs'].append(q.get('ttfbMs'));metrics['readTransferMs'].append(q.get('transferMs'))
   for phase_name,value in phases(row['requests']).items():metrics['server_'+phase_name+'Ms'].append(value)
  pairs[v]={key:dist(values) for key,values in metrics.items()}
 interaction_summary.append({'profile':key[0],'size':key[1],'kind':key[2],'variants':pairs})
http_groups=collections.defaultdict(list)
for i in http:
 if i['measured']:http_groups[(i['size'],i['row']['concurrency'])].append(i)
http_summary=[]
for key,items in http_groups.items():
 pairs={}
 for v in ['B','A']:
  rows=[i['row'] for i in items if i['variant']==v];waves=collections.defaultdict(list)
  # File/block identity is needed because wave numbers restart in each block.
  # Two blocks each contain exactly 5 measured waves and concurrency rows.
  for j in range(0,len(rows),key[1]):
   wave=rows[j:j+key[1]];assert len(wave)==key[1] and len({r['wave'] for r in wave})==1;waves[j]=wave
  assert len(waves)==10
  server=collections.defaultdict(list)
  for r in rows:
   for k,value in re.findall(r'([a-z_]+);dur=([0-9.]+)',r.get('serverTiming') or ''):server[k].append(float(value))
  pairs[v]={**{'server_'+k+'Ms':dist(values) for k,values in server.items()},'requestMs':dist([r['elapsedMs'] for r in rows]),'burstMs':dist([max(r['endOffsetMs'] for r in wave)-min(r['startOffsetMs'] for r in wave) for wave in waves.values()]),'encodedBodyBytes':dist([r['encodedBodyBytes'] for r in rows])}
 http_summary.append({'size':key[0],'concurrency':key[1],'variants':pairs})
for category,comparisons in [('interaction',interaction_summary),('http',http_summary)]:
 for item in comparisons:
  for metric,b in item['variants']['B'].items():
   a=item['variants']['A'].get(metric)
   if not a:continue
   for quantile in ['p50','p95']:
    if a[quantile] is not None and b[quantile] is not None and a[quantile]>b[quantile]:regressions.append({**{k:v for k,v in item.items() if k!='variants'},'category':category,'metric':metric,'quantile':quantile,'before':b[quantile],'after':a[quantile]})
flags={}
feature_flags={}
for profile in ['local','constrained']:
 for category,observations,target in [('primary',outcomes,flags),('feature',features,feature_flags)]:
  items=[i for i in observations if i['profile']==profile];requests=[r for i in items for r in i['row'].get('requests',[])+i['row'].get('preparation',{}).get('requests',[])]
  target[profile]={'allOutcomes':len(items),'measured':sum(i['measured'] for i in items),'warmups':sum(not i['measured'] for i in items),'failedOutcomes':sum(bool(i['row'].get('failed')) for i in items),'pageErrors':sum(i['row'].get('pageErrorCount',0) for i in items),'httpErrors':sum((r.get('status') or 0)>=400 for r in requests),'failedTransports':sum(bool(r.get('failed')) for r in requests),'pendingSSE':sum(r.get('pending',False) and r['type']=='eventsource' for r in requests),'pendingNonSSE':sum(r.get('pending',False) and r['type']!='eventsource' for r in requests),'interactionOutcomes':sum(i['profile']==profile for i in interactions) if category=='primary' else 0,'failedInteractions':sum(i['profile']==profile and bool(i['row'].get('failed')) for i in interactions) if category=='primary' else 0,'interactionPageErrorsIncludingPreparation':interaction_file_errors[profile] if category=='primary' else 0,'sourcePreparationsWithAdditionalPipelineReads':sum(sum(r['route']=='/api/workspace?kind=pipelinePage' for r in i['row'].get('preparation',{}).get('requests',[]))>1 for i in items)}
for profile in ['local','constrained']:
 requests=[q for i in interactions if i['profile']==profile for q in i['row']['requests']]
 flags[profile].update(interactionTimedHttpErrors=sum((q.get('status') or 0)>=400 for q in requests),interactionTimedFailedTransports=sum(bool(q.get('failed')) for q in requests),interactionTimedPendingSnapshots=sum(bool(q.get('pending')) for q in requests),interactionTransportScope='Timed samples only; preparation script errors recorded separately, other preparation network accounting unavailable.')
summary={'baseline':'327f7de5d8dad3381f0db258956d0b8b6424a6af','quantiles':'Nearest rank; primary browser and HTTP-burst groups have n10, extra feature groups n6, so p95=max; HTTP per-request groups have 10/20/40 observations by reader count. Source is first navigation in a fresh browser context, including rows whose later destination is warm. No success-only filtering.','sourceAccounting':'Source observation includes existing bounded drain; late pending request bytes are unavailable, so source body bytes are observed totals, not proof of full eventual accounting. Complete font transfers are counted independently.','browser':all_comparisons,'features':feature_comparisons,'featureCountsAndTransportFlags':feature_flags,'pairedWaitAccounting':'sourcePlusClickMs is each row source useful duration plus its later click duration; excludes source bounded-drain time, deliberate warm visit and navigation preparation. It is a derived sum of two loading waits, not an uninterrupted wall-clock or sum of percentiles.','interactions':interaction_summary,'http':http_summary,'countsAndTransportFlags':flags,'httpOutcomes':len(http),'httpFailed':sum(bool(i['row'].get('failed')) for i in http),'httpAllPrivateNoStoreAndCookieSensitive':all(i['row'].get('privateNoStore') and i['row'].get('cookieSensitive') for i in http),'poolObservations':pool_observations}
(root/'PEAKS.json').write_text(json.dumps(peaks,indent=2)+'\n');(root/'BENCHMARK_RESULTS.json').write_text(json.dumps(summary,indent=2)+'\n');(root/'REGRESSIONS.json').write_text(json.dumps(regressions,indent=2)+'\n');(root/'SOURCE_PEAKS.json').write_text(json.dumps(source_peaks,indent=2)+'\n');print(json.dumps(flags));print('HTTP outcomes',len(http))
