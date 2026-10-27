"""Retain maxima of measured request phase observations; spans are not additive."""
from pathlib import Path
import json,re,collections
root=Path('docs/performance/phase15');read=lambda p:json.loads(p.read_text());observations=[];captured=0
for profile in ['local','constrained']:
 protocol=read(root/profile/'PROTOCOL.json');assert protocol['complete'] and not protocol['failures']
 for category,key in [('main','completed'),('feature','features')]:
  for block in protocol[key]:
   directory=block['directory'];measured=directory.endswith('-measure');variant=re.search(r'-([AB])-(?:features-)?(?:measure|warmup)$',directory)[1]
   for index,row in enumerate(read(root/profile/directory/'browser-samples.json')['samples']):
    captured+=1
    if not measured:continue
    for stage,requests in [('source',row.get('preparation',{}).get('requests',[])),('click',row.get('requests',[]))]:
     for request in requests:
      phases={name:float(ms) for name,ms in re.findall(r'([a-z_]+);dur=([0-9.]+)',request.get('serverTiming') or '')}
      if phases:observations.append({'category':category,'profile':profile,'variant':variant,'path':row['path'],'condition':row['condition'],'file':directory+'/browser-samples.json','index':index,'stage':stage,'route':request['route'],'traceId':request.get('traceId'),'status':request.get('status'),'ttfbMs':request.get('ttfbMs'),'phases':phases})
assert captured==640
# A source observation can be retained by more than one browser row. Use a
# trace once for maxima, while preserving raw captured observations separately.
unique={}
for row in observations:
 key=row['traceId'] or (row['profile'],row['file'],row['index'],row['stage'],row['route']);unique.setdefault(key,row)
maxima={phase:sorted([row for row in unique.values() if phase in row['phases']],key=lambda row:row['phases'][phase],reverse=True)[:3] for phase in ['identity','live_session','transaction_acquire','database','transaction','serialization','total']}
(root/'SERVER_TAILS.json').write_text(json.dumps({'scope':'Maxima from measured main/feature source and click request observations. Warmups excluded here, retained in raw artifacts. Repeated source traces counted once for maxima; source/click windows are separate. Database/transaction/other spans may overlap and are not exclusive pool/provider/CPU time. Separate instrumented probes never enter this file.','browserOutcomesIncludingWarmups':captured,'capturedMeasuredPhaseObservations':len(observations),'uniqueMeasuredPhaseTraces':len(unique),'largestThreeByPhase':maxima},indent=2)+'\n');print('Measured source/click server phase tails retained without pooling diagnostics.')
