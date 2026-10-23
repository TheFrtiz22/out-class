const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {distribution}=require('./navigation-audit.cjs');
function interval(pairs,metric,statistic='p50',seed=20261023){
 let state=seed>>>0;const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296},values=[];
 for(let n=0;n<10000;n++){const a=[],b=[];for(let i=0;i<pairs.length;i++){const pair=pairs[Math.floor(random()*pairs.length)];a.push(...pair.A);b.push(...pair.B)}values.push(distribution(a.map(r=>r[metric]))[statistic]-distribution(b.map(r=>r[metric]))[statistic])}
 values.sort((a,b)=>a-b);return{low:Math.round(values[249]*100)/100,high:Math.round(values[9749]*100)/100};
}
const kindForPath={'overview → members':'members','recruiting → applicants':'pipeline','meetings → tasks':'tasks','tasks → announcements':'announcements'};
function enriched(row){
 const requests=row.requests.filter(r=>r.route==='/api/workspace?kind='+kindForPath[row.path]);assert.equal(requests.length,1,'Every visit makes exactly one selected resource read');const request=requests[0],phases={};
 for(const match of(request.serverTiming||'').matchAll(/([a-z_]+);dur=([\d.]+)/g))phases[match[1]]=Number(match[2]);
 return{...row,readStartMs:request.startMs,readTtfbMs:request.ttfbMs,readServerMs:phases.total,identityMs:phases.identity,databaseMs:phases.database,acquisitionMs:phases.transaction_acquire,serializationMs:phases.serialization,readBodyBytes:request.encodedBodyBytes};
}
function summarize(root){
 const protocol=JSON.parse(fs.readFileSync(path.join(root,'PROTOCOL.json')));assert.equal(protocol.collectionComplete,true);assert.equal(protocol.failures.length,0);assert.equal(protocol.completed.length,20);
 const entries=protocol.completed.map(block=>{const match=/^pair-(\d+)-(\d+)-([AB])-(measure|warmup)$/.exec(block.directory);assert.ok(match);const data=JSON.parse(fs.readFileSync(path.join(root,block.directory,'browser-samples.json')));assert.equal(data.failures.length,0);assert.equal(data.samples.length,block.planned);return{pair:Number(match[1]),position:Number(match[2]),variant:match[3],phase:match[4],samples:data.samples.map(enriched)}});
 const primary=entries.filter(e=>e.phase==='measure'&&e.pair!==3),control=entries.filter(e=>e.phase==='measure'&&e.pair===3),warmups=entries.filter(e=>e.phase==='warmup');
 const metrics=['meaningfulMs','interactiveMs','networkCompleteMs','requestCount','encodedBodyBytes','initialScriptBytes','scriptMs','taskMs','readStartMs','readTtfbMs','readServerMs','identityMs','databaseMs','acquisitionMs','serializationMs','readBodyBytes'];
 const groups=[];for(const route of Object.keys(kindForPath))for(const condition of ['cold','warm']){
  const variants={};for(const variant of ['B','A']){const rows=primary.filter(e=>e.variant===variant).flatMap(e=>e.samples).filter(r=>r.path===route&&r.condition===condition);assert.equal(rows.length,20);variants[variant]=Object.fromEntries(metrics.map(metric=>[metric,distribution(rows.map(r=>r[metric]))]));}
  const pairs=[1,2,4,5].map(pair=>Object.fromEntries(['A','B'].map(variant=>[variant,primary.find(e=>e.pair===pair&&e.variant===variant).samples.filter(r=>r.path===route&&r.condition===condition)])));
  const sameBuild=Object.fromEntries(control.map(e=>[e.position,distribution(e.samples.filter(r=>r.path===route&&r.condition===condition).map(r=>r.meaningfulMs))]));
  groups.push({path:route,condition,...variants,medianDifferenceInterval:interval(pairs,'meaningfulMs'),tailDifferenceInterval:interval(pairs,'meaningfulMs','p95'),sameBuildControl:sameBuild,pairedMedians:pairs.map(p=>({A:distribution(p.A.map(r=>r.meaningfulMs)),B:distribution(p.B.map(r=>r.meaningfulMs))}))});
 }
 return{protocol:{baseline:protocol.baseline,buildIds:protocol.buildIds,primaryObservations:primary.flatMap(e=>e.samples).length,controlObservations:control.flatMap(e=>e.samples).length,warmupObservations:warmups.flatMap(e=>e.samples).length,errors:0},groups};
}
module.exports={interval,enriched,summarize};
if(require.main===module){const root=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/performance/phase2/comparison'),result=summarize(root);fs.writeFileSync(path.join(root,'COMPARISON.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.groups.map(g=>({path:g.path,condition:g.condition,before:g.B.meaningfulMs,after:g.A.meaningfulMs,interval:g.medianDifferenceInterval})),null,2));}
