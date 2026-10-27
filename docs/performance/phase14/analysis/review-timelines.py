"""Observe code/data overlap and every selected Review outcome without new clocks."""
from pathlib import Path
import json,math,re,collections
root=Path('docs/performance/phase14');read=lambda p:json.loads(p.read_text());chunks=read(root/'FEATURE_CHUNKS.json');rows=[]
def distribution(values):
 values=sorted(v for v in values if isinstance(v,(int,float)))
 return {'n':len(values),'p50':values[math.ceil(len(values)*.5)-1] if values else None,'p95':values[math.ceil(len(values)*.95)-1] if values else None,'max':max(values) if values else None}
for profile in ['local','constrained']:
 protocol=read(root/profile/'PROTOCOL.json');assert protocol['complete'] and not protocol['failures']
 for block in protocol['features']:
  match=re.search(r'-([AB])-features-(measure|warmup)',block['directory']);variant=match[1];build='baseline' if variant=='B' else 'candidate';targets=set(chunks[build]['rounds'])
  for index,row in enumerate(read(root/profile/block['directory']/'browser-samples.json')['samples']):
   if row['path']!='settingsApplication → rounds':continue
   assert not row.get('failed');requests=row['requests'];rounds=[q for q in requests if q['route']=='/api/workspace?kind=rounds'];assert len(rounds)==1
   request=rounds[0];code=[q for q in requests if q['route'] in targets];first=min([q['startMs'] for q in code] or [float('inf')]);last=max([q['endMs'] for q in code if q.get('endMs') is not None] or [0]);round_end=request.get('endMs');server={name:float(ms) for name,ms in re.findall(r'([a-z_]+);dur=([0-9.]+)',request.get('serverTiming') or '')}
   rows.append({'profile':profile,'variant':variant,'condition':row['condition'],'measured':match[2]=='measure','file':block['directory']+'/browser-samples.json','index':index,'clickMs':row['meaningfulMs'],'sourceMs':row['preparation']['meaningfulMs'],'sourcePlusClickMs':row['preparation']['meaningfulMs']+row['meaningfulMs'],'requests':row['requestCount'],'encodedBodyBytes':row['encodedBodyBytes'],'reviewCodeRequests':len(code),'firstReviewCodeStartMs':first if code else None,'lastReviewCodeEndMs':last if code else None,'roundsStartMs':request['startMs'],'roundsEndMs':round_end,'codeStartedBeforeRoundsComplete':first<round_end if code and round_end is not None else None,'codeStartMinusRoundsEndMs':first-round_end if code and round_end is not None else None,'codeAndRoundsOverlapMs':max(0,min(last,round_end)-max(first,request['startMs'])) if code and round_end is not None else None,'roundsTtfbMs':request.get('ttfbMs'),'roundsTransferMs':request.get('transferMs'),'serverPhases':server})
groups=collections.defaultdict(list)
for row in rows:
 if row['measured']:groups[(row['profile'],row['condition'],row['variant'])].append(row)
summary=[]
for (profile,condition,variant),group in groups.items():
 assert len(group)==6
 metrics={field:distribution([row.get(field) for row in group]) for field in ['clickMs','sourceMs','sourcePlusClickMs','requests','encodedBodyBytes','firstReviewCodeStartMs','lastReviewCodeEndMs','roundsStartMs','roundsEndMs','codeStartMinusRoundsEndMs','codeAndRoundsOverlapMs','roundsTtfbMs','roundsTransferMs']}
 for phase in sorted({phase for row in group for phase in row['serverPhases']}):metrics['server_'+phase+'Ms']=distribution([row['serverPhases'].get(phase) for row in group])
 summary.append({'profile':profile,'condition':condition,'variant':variant,'measuredOutcomes':len(group),'outcomesWithReviewCodeRequests':sum(bool(row['reviewCodeRequests']) for row in group),'codeStartedBeforeRoundsComplete':sum(row['codeStartedBeforeRoundsComplete'] is True for row in group),'metrics':metrics})
assert len(rows)==64 and len(summary)==8
(root/'REVIEW_TIMELINES.json').write_text(json.dumps({'scope':'Existing selected-review requests, same useful-content predicate and clocks. Code/data overlap is a structural observation, not proof of shorter visible-content time. All measured, warmup, cold and warm rows retained; server phases overlap and are not exclusive CPU/pool time.','rows':rows,'summary':summary},indent=2)+'\n')
print('Review code/data timelines retained for all64 outcomes; measured groups n6.')
