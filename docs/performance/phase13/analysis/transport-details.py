"""Retain sanitized route counts and background flags, independently of speed."""
from pathlib import Path
import json,re,collections
root=Path('docs/performance/phase13');groups=collections.defaultdict(collections.Counter);flags=collections.Counter();authority=collections.Counter();unknown=collections.Counter();multiplicity=collections.Counter();route_bytes=collections.defaultdict(collections.Counter)
def add(profile,category,variant,stage,rows):
 for q in rows:
  groups[(profile,category,variant,stage)][q['route']]+=1
  bucket=route_bytes[(profile,category,variant,stage,q['route'])];bucket['requests']+=1;bucket['observedEncodedBodyBytes']+=q.get('encodedBodyBytes') or 0;bucket['unknownBodySnapshots']+=q.get('encodedBodyBytes') is None
  if q.get('encodedBodyBytes') is None:unknown[(profile,category,variant,stage,q['type'])]+=1
  for state,yes in [('failed',q.get('failed')),('pending',q.get('pending')),('httpError',(q.get('status') or 0)>=400)]:
   if yes:flags[(profile,category,variant,stage,state,q['route'],str(q.get('status')),str(q.get('failureReason')))]+=1
for profile in ['local','constrained']:
 protocol=json.loads((root/profile/'PROTOCOL.json').read_text())
 for category,key in [('main','completed'),('feature','features')]:
  for block in protocol[key]:
   variant=re.search(r'-([AB])-(?:features-)?(?:measure|warmup)',block['directory'])[1]
   for row in json.loads((root/profile/block['directory']/'browser-samples.json').read_text())['samples']:
    size=int(re.search(r'size-(\d+)',block['directory'])[1]);source=row.get('preparation',{});multiplicity[(profile,category,variant,size,row['path'],row['condition'],sum(q['route']=='/api/workspace?kind=pipelinePage' for q in source.get('requests',[])),any('readAuthority' in e.get('causes',[]) for e in source.get('authorityEvents',[])),max([e['atMs'] for e in source.get('authorityEvents',[]) if e['kind']=='auth'] or [float('inf')])<min([e['atMs'] for e in source.get('authorityEvents',[]) if e['kind']=='selected'] or [float('-inf')]))]+=1
    add(profile,category,variant,'source',row.get('preparation',{}).get('requests',[]));add(profile,category,variant,'click',row.get('requests',[]))
    for stage,events in [('source',row.get('preparation',{}).get('authorityEvents',[])),('click',row.get('authorityEvents',[]))]:
     for event in events:authority[(profile,category,variant,stage,str(event.get('type') or event.get('reason') or event.get('kind') or 'event'),tuple(sorted(event.get('causes') or [])))]+=1
for profile in ['local','constrained']:
 protocol=json.loads((root/profile/'PROTOCOL.json').read_text())
 for block in protocol['interactions']:
  variant=re.search(r'-([AB])-interactions',block['file'])[1]
  for row in json.loads((root/profile/block['file']).read_text())['samples']:add(profile,'interaction',variant,'timed',row['requests'])
out={'scope':'All accepted main/feature rows including warmups; source and click observations separated. Auth-before-dispatch compares the last Auth notification with the first selected marker on the same browser clock, so a genuine later event is not classified as already known. Route labels redact fixture identifiers. Flag status/reason are retained without response bodies, SQL, credentials or actors.','sourcePipelineReadMultiplicity':[{'profile':k[0],'category':k[1],'variant':k[2],'size':k[3],'path':k[4],'condition':k[5],'protectedPipelineReads':k[6],'readAuthorityCauseObserved':k[7],'lastAuthBeforeFirstSelectedDispatch':k[8],'sourceOutcomes':v} for k,v in sorted(multiplicity.items())],'routeBodyAccounting':[{'profile':k[0],'category':k[1],'variant':k[2],'stage':k[3],'route':k[4],**dict(v)} for k,v in sorted(route_bytes.items())],'routeCounts':[{'profile':k[0],'category':k[1],'variant':k[2],'stage':k[3],'routes':dict(sorted(v.items()))} for k,v in sorted(groups.items())],'flags':[{'profile':k[0],'category':k[1],'variant':k[2],'stage':k[3],'state':k[4],'route':k[5],'status':k[6],'reason':k[7],'count':v} for k,v in sorted(flags.items())],'unknownBodySnapshotCounts':[{'profile':k[0],'category':k[1],'variant':k[2],'stage':k[3],'type':k[4],'count':v} for k,v in sorted(unknown.items())],'authorityEventCounts':[{'profile':k[0],'category':k[1],'variant':k[2],'stage':k[3],'kind':k[4],'causes':list(k[5]),'count':v} for k,v in sorted(authority.items())]}
(root/'TRANSPORT_DETAILS.json').write_text(json.dumps(out,indent=2)+'\n');print('Transport route counts and background flags retained.')
