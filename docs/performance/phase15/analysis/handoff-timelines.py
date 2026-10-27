"""Locate the Settings→Review handoff using existing, unchanged browser clocks."""
from pathlib import Path
import json,re,math,collections
root=Path('docs/performance/phase15');read=lambda p:json.loads(p.read_text());rows=[]
def dist(values):
 values=sorted(v for v in values if isinstance(v,(int,float)))
 return {'n':len(values),'p50':values[math.ceil(len(values)*.5)-1] if values else None,'p95':values[math.ceil(len(values)*.95)-1] if values else None,'max':max(values) if values else None}
for profile in ['local','constrained']:
 protocol=read(root/profile/'PROTOCOL.json');assert protocol['complete'] and not protocol['failures']
 for block in protocol['features']:
  tag=re.search(r'-([AB])-features-(measure|warmup)',block['directory'])
  for index,row in enumerate(read(root/profile/block['directory']/'browser-samples.json')['samples']):
   if row['path']!='settingsApplication → rounds':continue
   assert not row.get('failed');requests=row['requests'];rounds=[q for q in requests if q['route']=='/api/workspace?kind=rounds'];assert len(rounds)==1;request=rounds[0]
   pages=[q for q in requests if q.get('method')=='GET' and q['type']=='fetch' and q['route'].startswith('/club/') and q['route'].endswith('/workspace')];scripts=[q for q in requests if q['type']=='script'];completed=[q['endMs'] for q in scripts if q.get('endMs') is not None];pre_useful=[ms for ms in completed if ms<=row['meaningfulMs']];last=max(pre_useful) if pre_useful else None
   rows.append({'profile':profile,'variant':tag[1],'condition':row['condition'],'measured':tag[2]=='measure','file':block['directory']+'/browser-samples.json','index':index,'clickMs':row['meaningfulMs'],'clickToUrlMs':row['clickToUrlMs'],'sourceMs':row['preparation']['meaningfulMs'],'sourcePlusClickMs':row['preparation']['meaningfulMs']+row['meaningfulMs'],'requests':row['requestCount'],'encodedBodyBytes':row['encodedBodyBytes'],'workspacePageFetches':len(pages),'observedWorkspacePageBytes':sum(q.get('encodedBodyBytes') or 0 for q in pages),'unknownWorkspacePageBodies':sum(q.get('encodedBodyBytes') is None for q in pages),'faviconRequests':sum(q['route']=='/brand/premium-board/07_favicon.svg' for q in requests),'roundsStartMs':request['startMs'],'roundsEndMs':request.get('endMs'),'roundsTtfbMs':request.get('ttfbMs'),'roundsTransferMs':request.get('transferMs'),'roundsToUsefulMs':row['meaningfulMs']-request['endMs'] if request.get('endMs') is not None else None,'capturedScriptRequests':len(scripts),'lastCapturedScriptBeforeUsefulMs':last,'scriptToUsefulMs':row['meaningfulMs']-last if last is not None else None,'capturedScriptsFinishingAfterUseful':sum(ms>row['meaningfulMs'] for ms in completed),'scriptMs':row['scriptMs'],'taskMs':row['taskMs'],'reactCommitCount':row['reactCommitCount'],'serverPhases':{k:float(v) for k,v in re.findall(r'([a-z_]+);dur=([0-9.]+)',request.get('serverTiming') or '')}})
groups=collections.defaultdict(list)
for row in rows:
 if row['measured']:groups[(row['profile'],row['condition'],row['variant'])].append(row)
summary=[]
for (profile,condition,variant),group in groups.items():
 assert len(group)==6
 metrics={field:dist([row.get(field) for row in group]) for field in ['clickMs','clickToUrlMs','sourceMs','sourcePlusClickMs','requests','encodedBodyBytes','workspacePageFetches','observedWorkspacePageBytes','unknownWorkspacePageBodies','faviconRequests','roundsStartMs','roundsEndMs','roundsTtfbMs','roundsTransferMs','roundsToUsefulMs','capturedScriptRequests','lastCapturedScriptBeforeUsefulMs','scriptToUsefulMs','capturedScriptsFinishingAfterUseful','scriptMs','taskMs','reactCommitCount']}
 for phase in sorted({p for row in group for p in row['serverPhases']}):metrics['server_'+phase+'Ms']=dist([row['serverPhases'].get(phase) for row in group])
 summary.append({'profile':profile,'condition':condition,'variant':variant,'measuredOutcomes':len(group),'metrics':metrics})
assert len(rows)==64 and len(summary)==8
(root/'HANDOFF_TIMELINES.json').write_text(json.dumps({'scope':'All64 Review rows, including warmups, derived from the unchanged harness. Measured groups n6. URL, rounds, captured script and useful-DOM/two-frame times locate observed waiting; gaps are not exclusive React render duration. Script/task deltas include bounded post-content drain. Sanitized primary routes omit query values, so aggregate workspace page GETs may include unrelated background navigation/prefetch; targeted Review absence is proven separately by the real browser regression. All other traffic and unknown-byte snapshots remain retained.','rows':rows,'summary':summary},indent=2)+'\n');print('Review URL/read/code/useful-content handoff timelines retained.')
