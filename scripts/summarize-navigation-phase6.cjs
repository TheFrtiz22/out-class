const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { distribution } = require('./navigation-audit.cjs');
const { enrich } = require('./summarize-pipeline-navigation.cjs');
const { summarizeGroup } = require('./summarize-pipeline-stress.cjs');

function sourceMetrics(row) {
  const source = row.preparation;
  assert.ok(source, 'Source observations are required for every outcome');
  const requests = source.requests.filter(r => r.type !== 'eventsource');
  const scripts = requests.filter(r => r.type === 'script');
  const completeBytes = requests.every(r => Number.isFinite(r.encodedBodyBytes));
  return {
    meaningfulMs: source.meaningfulMs,
    elapsedIncludingDrainMs: source.elapsedMs,
    documentTtfbMs: source.dom?.document?.ttfbMs ?? null,
    requestCount: source.requests.length,
    nonSsePending: requests.filter(r => r.pending).length,
    logoRequestCount: requests.filter(r => r.route.startsWith('/logos/')).length,
    httpErrors: requests.filter(r => r.status >= 400).length,
    encodedBodyBytes: completeBytes ? requests.reduce((n,r) => n+r.encodedBodyBytes,0) : null,
    scriptBytes: scripts.every(r => Number.isFinite(r.encodedBodyBytes)) ? scripts.reduce((n,r) => n+r.encodedBodyBytes,0) : null,
  };
}
function describe(rows) {
  const result = summarizeGroup(rows);
  const successful = rows.filter(r => !r.failed);
  assert.ok(successful.map(enrich).every(r => r.readCount === 1), 'Each successful selected list/detail navigation requires exactly one fresh read');
  const source = rows.map(sourceMetrics);
  const sourceMetricsNames = Object.keys(source[0]);
  const transfer = successful.map(r => r.requests.find(q => /^\/api\/workspace\?kind=pipeline(?:List|Page)?$/.test(q.route))?.transferMs);
  return {
    ...result,
    readTransferMs: distribution(transfer),
    timedHttpErrors: successful.flatMap(r => r.requests).filter(r => r.status >= 400).length,
    pendingSourceObservations: source.filter(r => r.nonSsePending > 0).length,
    source: {
      planned: rows.length,
      successful: source.filter(r => Number.isFinite(r.meaningfulMs)).length,
      latencyInterpretation: source.every(r => Number.isFinite(r.meaningfulMs)) ? 'All planned source preparations; visible DOM content predicate, before background drain.' : 'Successful source preparations only; full-cohort source p95 is not established.',
      ...Object.fromEntries(sourceMetricsNames.map(name => [name, distribution(source.map(r => r[name]))])),
    },
  };
}
function summarize(root) {
  const protocol = JSON.parse(fs.readFileSync(path.join(root,'PROTOCOL.json')));
  assert.equal(protocol.complete, true);
  assert.equal(protocol.failures.length, 0, 'Fatal collection failures must be reported separately');
  assert.equal(protocol.completed.length, 24);
  const entries = protocol.completed.map(block => {
    const m = /^size-(100|1000|5000)-pair-([12])-([12])-([AB])-(measure|warmup)$/.exec(block.directory);
    assert.ok(m, 'Unexpected block');
    const data = JSON.parse(fs.readFileSync(path.join(root,block.directory,'browser-samples.json')));
    assert.equal(data.samples.length, block.planned);
    assert.equal(data.samples.filter(r=>r.failed).length, block.failures);
    return {size:Number(m[1]),pair:Number(m[2]),variant:m[4],phase:m[5],samples:data.samples};
  });
  const measured = entries.filter(e=>e.phase==='measure');
  const warmups = entries.filter(e=>e.phase==='warmup').flatMap(e=>e.samples);
  const groups = [];
  for (const size of [100,1000,5000]) for (const route of ['recruiting → applicants','applicants → applicantDetail']) for (const condition of ['cold','warm']) {
    const group = {size,path:route,condition};
    for (const variant of ['B','A']) group[variant]=describe(measured.filter(e=>e.size===size&&e.variant===variant).flatMap(e=>e.samples).filter(r=>r.path===route&&r.condition===condition));
    group.pairedMedians = [1,2].map(pair=>Object.fromEntries(['B','A'].map(variant=>[variant,distribution(measured.find(e=>e.size===size&&e.pair===pair&&e.variant===variant).samples.filter(r=>r.path===route&&r.condition===condition&&!r.failed).map(r=>r.meaningfulMs))])));
    groups.push(group);
  }
  const all = measured.flatMap(e=>e.samples);
  return {
    protocol: {baseline:protocol.baseline,buildIds:protocol.buildIds,planned:all.length+warmups.length,measured:all.length,warmups:warmups.length,failedMeasured:all.filter(r=>r.failed).length,failedWarmups:warmups.filter(r=>r.failed).length,pageErrors:all.reduce((n,r)=>n+(r.pageErrorCount||0),0),timedSuccessfulHttpErrors:all.filter(r=>!r.failed).flatMap(r=>r.requests).filter(r=>r.status>=400).length,sourceHttpErrorsByVariant:Object.fromEntries(['B','A'].map(variant=>[variant,measured.filter(e=>e.variant===variant).flatMap(e=>e.samples).reduce((n,r)=>n+sourceMetrics(r).httpErrors,0)])),percentiles:'Nearest rank, n=10 per build/path/condition; p95 equals maximum. Local descriptive evidence, not a production percentile estimate.'},
    groups,
    interactions: summarizeInteractions(root, protocol),
    failures: measured.flatMap(e=>e.samples.filter(r=>r.failed).map(r=>({size:e.size,variant:e.variant,path:r.path,condition:r.condition,index:r.index,stage:r.stage,diagnostic:r.diagnostic,preparation:r.preparation,error:r.error}))),
  };
}
function summarizeInteractions(root, protocol) {
  assert.equal(protocol.interactions.length, 8);
  const blocks=protocol.interactions.map(block=>{
    const m=/^size-(1000|5000)-pair-([12])-([12])-([AB])-interactions.json$/.exec(block.file);assert.ok(m);
    const data=JSON.parse(fs.readFileSync(path.join(root,block.file)));assert.equal(data.samples.length,12);
    return {size:Number(m[1]),variant:m[4],samples:data.samples};
  });
  const groups=[];
  for(const size of [1000,5000])for(const kind of ['next-page','distant-search']){
    const group={size,kind,condition:'warm'};
    for(const variant of ['B','A']){
      const all=blocks.filter(b=>b.size===size&&b.variant===variant).flatMap(b=>b.samples).filter(r=>r.kind===kind&&!r.warmup);assert.equal(all.length,10);
      const successful=all.filter(r=>!r.failed),enriched=successful.map(enrich);
      group[variant]={planned:all.length,successful:successful.length,failed:all.length-successful.length,pageErrors:all.flatMap(r=>r.pageErrors).length,httpErrors:all.flatMap(r=>r.requests).filter(r=>r.status>=400).length,interpretation:successful.length===10?'All planned warm observations. Nearest-rank p95 equals maximum at n=10.':'Successful observations only; full-cohort p95 is not established.',...Object.fromEntries(['meaningfulMs','driverElapsedMs','requestCount','encodedBodyBytes','readCount','readStartMs','readTtfbMs','readServerMs','databaseMs','serializationMs','readBodyBytes'].map(metric=>[metric,distribution(enriched.map(r=>r[metric]))]))};
    }
    groups.push(group);
  }
  return {planned:96,warmups:16,measured:80,failed:blocks.flatMap(b=>b.samples).filter(r=>r.failed).length,groups};
}
module.exports = {sourceMetrics,describe,summarize};
if(require.main===module){const root=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/performance/phase6/comparison'),result=summarize(root);fs.writeFileSync(path.join(root,'COMPARISON.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.groups.map(g=>({size:g.size,path:g.path,condition:g.condition,before:g.B.meaningfulMs,after:g.A.meaningfulMs,failures:[g.B.failed,g.A.failed]})),null,2));}
