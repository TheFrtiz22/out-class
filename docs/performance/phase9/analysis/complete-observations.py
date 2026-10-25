"""Derive complete-cohort diagnostics without editing or removing raw rows."""
from pathlib import Path
from collections import Counter
import json
import math

root = Path('docs/performance/phase9')

def dist(values):
    values = sorted(v for v in values if isinstance(v, (int, float)) and math.isfinite(v))
    return dict(samples=len(values), **{
        k: round(values[math.ceil(p * len(values)) - 1], 3) if values else None
        for k, p in [('p50', .5), ('p95', .95), ('max', 1)]
    })

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

counts = {}
for collection in ['comparison-final', 'supplement']:
    directory = root / collection
    protocol = json.loads((directory / 'PROTOCOL.json').read_text())
    assert protocol['complete'] and not protocol['failures']
    rows, interactions, flags, duplicates = [], [], [], []
    for block in protocol['completed']:
        file = block['directory'] + '/browser-samples.json'
        parts = block['directory'].split('-')
        for row in json.loads((directory / file).read_text())['samples']:
            info = dict(file=file, size=int(parts[1]), variant=parts[-2],
                        phase=parts[-1], path=row['path'], condition=row['condition'], index=row['index'])
            rows.append((info, row))
            reads = [q for q in row['preparation']['requests']
                     if q['route'].startswith('/api/workspace?kind=pipeline')]
            if len(reads) > (1 if row['path'].startswith('applicants') else 0):
                duplicates.append(dict(**info, reads=[{k:q.get(k) for k in
                    ['route', 'startMs', 'endMs', 'status', 'failed', 'pending']} for q in reads],
                    authorityEvents=row['preparation'].get('authorityEvents', [])))
            for stage, requests in [('source', row['preparation']['requests']), ('timed', row['requests'])]:
                for q in requests:
                    if q.get('failed') or q.get('pending') or (q.get('status') or 0) >= 400:
                        flags.append(dict(**info, stage=stage, **{k:q.get(k) for k in
                            ['route', 'type', 'method', 'status', 'failed', 'pending', 'failureReason', 'encodedBodyBytes']}))
    for block in protocol['interactions']:
        for row in json.loads((directory / block['file']).read_text())['samples']:
            interactions.append(row)
            for q in row['requests']:
                if q.get('failed') or q.get('pending') or (q.get('status') or 0) >= 400:
                    flags.append(dict(file=block['file'], variant=block['file'].split('-')[-2],
                        phase='warmup' if row['warmup'] else 'measure', stage='interaction',
                        kind=row['kind'], **{k:q.get(k) for k in
                            ['route', 'type', 'method', 'status', 'failed', 'pending', 'failureReason', 'encodedBodyBytes']}))
    counts[collection] = dict(browserOutcomes=len(rows)+len(interactions),
        measuredBrowserOutcomes=sum(i['phase']=='measure' for i,r in rows)+sum(not r['warmup'] for r in interactions),
        warmups=sum(i['phase']=='warmup' for i,r in rows)+sum(r['warmup'] for r in interactions),
        failedBrowserOutcomes=sum(bool(r.get('failed')) for i,r in rows)+sum(bool(r.get('failed')) for r in interactions),
        pageErrors=sum(r.get('pageErrorCount',0) for i,r in rows)+sum(len(r.get('pageErrors',[])) for r in interactions),
        httpErrors=sum((q.get('status') or 0)>=400 for i,r in rows for q in r['requests']+r['preparation']['requests'])+
            sum((q.get('status') or 0)>=400 for r in interactions for q in r['requests']),
        flaggedRequests=len(flags), failedRequests=sum(bool(f.get('failed')) for f in flags),
        pendingRequests=sum(bool(f.get('pending')) for f in flags), extraSourceReadOutcomes=len(duplicates))
    grouped=Counter((f['variant'], f['phase'], f['stage'], f['route'], f['status'], bool(f['failed']), bool(f['pending'])) for f in flags)
    save(directory/'COMPLETE_DIAGNOSTICS.json',dict(counts=counts[collection],
        interpretation='Includes all planned warmups and measurements. Pending source SSE is intentional. Failed transport after HTTP 200 remains flagged; status 200 does not establish full consumption. No rows excluded.',
        groupedFlags=[dict(zip(['variant','phase','stage','route','status','failed','pending'],k),count=v) for k,v in sorted(grouped.items(),key=str)],
        extraSourceReads=duplicates, flags=flags))
    groups=[]
    for size in sorted({i['size'] for i,r in rows}):
        for route in ['recruiting → applicants','applicants → applicantDetail']:
            for condition in ['cold','warm']:
                group=dict(size=size,path=route,condition=condition)
                for variant in ['B','A']:
                    selected=[r for i,r in rows if i['phase']=='measure' and i['size']==size and i['path']==route and i['condition']==condition and i['variant']==variant]
                    group[variant]={k:dist(r.get(k) for r in selected) for k in
                        ['scriptMs','taskMs','layoutMs','heapBeforeBytes','heapAfterBytes','requestCount','networkCompleteMs']}
                    group[variant]['sourceHeapBytes']=dist(r['preparation'].get('heapUsedBytes') for r in selected)
                groups.append(group)
    save(directory/'BROWSER_WORK.json', dict(interpretation='Timed work and point-in-time JS heap observations without forced GC; source and after heaps cannot establish retained application memory.',groups=groups))
save(root/'ACCEPTED_COUNTS.json', counts)
loaders=[]
for file in sorted((root/'comparison-final').glob('*-loaders.json')):
    for group in json.loads(file.read_text())['results']:
        samples=group['samples']
        loaders.append(dict(file=file.name, name=group['name'], samples=len(samples),
            elapsedMs=dist(row['elapsedMs'] for row in samples),
            queryCounts=dict(Counter(len(row['queries']) for row in samples)),
            remoteIdentityCounts=dict(Counter(len(row['auth']) for row in samples))))
assert sum(group['samples'] for group in loaders)==600
save(root/'comparison-final/LOADERS.json',dict(total=600,groups=loaders,
    interpretation='Real local Auth/DB loaders outside HTTP/RSC dispatcher; elapsed times are separate from browser latency and no row was removed. Counts include transaction control statements and occasionally an additional initial setup statement.'))
print(json.dumps(counts,indent=2))
