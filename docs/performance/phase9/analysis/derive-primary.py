from pathlib import Path
import json,collections,math
root=Path('docs/performance/phase9');out=root/'comparison-final';p=json.loads((out/'PROTOCOL.json').read_text());s=json.loads((out/'COMPARISON.json').read_text())
def save(name,data): (out/name).write_text(json.dumps(data,indent=2)+'\n')
def dist(values):
 v=sorted(x for x in values if x is not None)
 return {'samples':len(v),'p50':round(v[math.ceil(.5*len(v))-1],3) if v else None,'p95':round(v[math.ceil(.95*len(v))-1],3) if v else None,'max':round(max(v),3) if v else None}
rows=[];flags=[]
for block in p['completed']:
 for row in json.loads((out/block['directory']/'browser-samples.json').read_text())['samples']:
  info={'file':block['directory']+'/browser-samples.json','path':row['path'],'condition':row['condition'],'index':row['index'],'variant':block['directory'].split('-')[-2],'phase':block['directory'].split('-')[-1]}
  rows.append((info,row))
  for stage,requests in [('timed',row['requests']),('source',row['preparation']['requests'])]:
   for request in requests:
    if request.get('failed') or request.get('pending') or (request.get('status') or 0)>=400:
     flags.append({**info,'stage':stage,**{k:request.get(k) for k in ['route','type','method','status','failed','pending','failureReason','encodedBodyBytes']}})
for block in p['interactions']:
 for row in json.loads((out/block['file']).read_text())['samples']:
  for request in row['requests']:
   if request.get('failed') or request.get('pending') or (request.get('status') or 0)>=400:
    flags.append({'file':block['file'],'variant':block['file'].split('-')[-2],'phase':'warmup' if row['warmup'] else 'measure','stage':'interaction','kind':row['kind'],'index':row.get('index'),**{k:request.get(k) for k in ['route','type','method','status','failed','pending','failureReason','encodedBodyBytes']}})
counts=collections.Counter((f['variant'],f['phase'],f['stage'],f['route'],f['status']) for f in flags)
save('TRANSPORT_FLAGS.json',{'interpretation':'Every failed, pending or HTTP error request flag is retained separately from successful navigation outcomes. A request failure after HTTP 200 is not counted as an HTTP error; positive captured bytes do not prove full consumption. No rows removed.','flagCount':len(flags),'grouped':[dict(zip(['variant','phase','stage','route','status'],key),count=value) for key,value in sorted(counts.items(),key=str)],'flags':flags})
import re
phases=[]
for size in [100,1000,5000]:
 for variant in ['B','A']:
  selected=[row for info,row in rows if info['phase']=='measure' and info['variant']==variant and info['file'].startswith(f'size-{size}-') and row['path']=='recruiting → applicants' and row['condition']=='warm']
  observations=[]
  for row in selected:
   read=next(r for r in row['requests'] if re.match(r'^/api/workspace\?kind=pipeline(?:List|Page)$',r['route']))
   observations.append({name:float(value) for name,value in re.findall(r'([a-z_]+);dur=([\d.]+)',read['serverTiming'])})
  names=sorted(set().union(*(o.keys() for o in observations)))
  phases.append({'size':size,'variant':variant,'phases':{name:dist(o.get(name) for o in observations) for name in names}})
save('SERVER_PHASES.json',{'scope':'All 10 measured warm list reads per variant/cohort. Milliseconds from existing sanitized Server-Timing. Identity, transaction and database spans can overlap; do not sum phase medians. transaction_acquire observes interactive transaction acquisition, not an isolated pure pool metric.','groups':phases})
peaks=[]
for size,path,condition in [(size,path,condition) for size in [100,1000,5000] for path in ['recruiting → applicants','applicants → applicantDetail'] for condition in ['cold','warm']]:
 for v in ['B','A']:
  candidates=[(i,r) for i,r in rows if i['phase']=='measure' and i['variant']==v and i['file'].startswith(f'size-{size}-') and r['path']==path and r['condition']==condition]
  info,r=max(candidates,key=lambda item:item[1]['meaningfulMs']);read=next(q for q in r['requests'] if 'kind=pipeline' in q['route'])
  peaks.append({**info,'meaningfulMs':r['meaningfulMs'],'readTtfbMs':read['ttfbMs'],'serverTiming':read['serverTiming'],'readBytes':read['encodedBodyBytes']})
save('REGRESSION_OBSERVATIONS.json',{'interpretation':'Maximum rows retained without replacement. Both builds return the same bounded page contract; unchanged detail endpoints have local timing variation, not a demonstrated optimization. Correlation of individual server spans does not establish a causal host diagnosis.','peaks':peaks})
print('Transport flag groups:',[(k,v) for k,v in counts.items()]);print('Server phase groups:',len(phases))

regressions=[]
for stage,groups in [('initial',s['groups']),('interaction',s['interactions']['groups'])]:
 for group in groups:
  if any(group['A']['meaningfulMs'][key]>group['B']['meaningfulMs'][key] for key in ['p50','p95']):
   regressions.append({key:value for key,value in group.items() if key in ['size','path','condition','kind']}|{'stage':stage,'before':group['B']['meaningfulMs'],'after':group['A']['meaningfulMs']})
save('REGRESSIONS.json',regressions)
interaction_rows=[]
for block in p['interactions']:
 for row in json.loads((out/block['file']).read_text())['samples']:
  if not row['warmup']:interaction_rows.append((block['file'],row))
interaction_peaks=[]
for size in [1000,5000]:
 for kind in ['next-page','distant-search']:
  for variant in ['B','A']:
   selected=[(file,row) for file,row in interaction_rows if file.startswith(f'size-{size}-') and file.split('-')[-2]==variant and row['kind']==kind]
   file,row=max(selected,key=lambda item:item[1]['meaningfulMs'])
   request=next(q for q in row['requests'] if q['route']=='/api/workspace?kind=pipelinePage')
   interaction_peaks.append({'file':file,'size':size,'kind':kind,'variant':variant,'index':row['index'],'meaningfulMs':row['meaningfulMs'],'readTtfbMs':request['ttfbMs'],'serverTiming':request['serverTiming'],'encodedBodyBytes':request['encodedBodyBytes']})
save('INTERACTION_PEAKS.json',{'interpretation':'Maximum planned measured interaction per group retained, without replacement or a causal host diagnosis.','peaks':interaction_peaks})
