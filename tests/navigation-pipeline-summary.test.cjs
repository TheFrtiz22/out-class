const {test}=require('node:test'),assert=require('node:assert/strict');
const {accepted,phaseValues,errorCounts,summarize,delta,verifyInputs}=require('../scripts/summarize-navigation-pipeline-ready.cjs');
test('sealed raw inputs reject changed evidence and paths outside the artifact root',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-summary-input-'));
 try{fs.writeFileSync(path.join(dir,'row.json'),'{}');const hash=createHash('sha256').update('{}').digest('hex');fs.writeFileSync(path.join(dir,'INPUT_SHA256SUMS'),hash+'  row.json\n');verifyInputs(dir);fs.writeFileSync(path.join(dir,'row.json'),'{"changed":true}');assert.throws(()=>verifyInputs(dir));fs.writeFileSync(path.join(dir,'INPUT_SHA256SUMS'),hash+'  ../row.json\n');assert.throws(()=>verifyInputs(dir));}finally{fs.rmSync(dir,{recursive:true})}
});
test('acceptance rejects whole attempts with sleep, missing rows, failed commands or missing controls',()=>{
 const good={complete:true,valid:true,hostControl:{valid:true},sleepAudit:{valid:true,events:[]},blocks:[{planned:4,observed:4,status:0}]};
 assert.equal(accepted(good),good);
 assert.doesNotThrow(()=>accepted({...good,blocks:[{planned:4,observed:4,status:1,failures:1}]}),'A recorded failed outcome is retained, not silently removed as an invalid command');
 for(const patch of [{complete:false},{valid:false},{hostControl:{valid:false}},{sleepAudit:{valid:true,events:[{kind:'Wake'}]}},{sleepAudit:{valid:false,events:[]}},{blocks:[]},{blocks:[{planned:4,observed:3,status:0}]},{blocks:[{planned:4,observed:4,status:1}]}])assert.throws(()=>accepted({...good,...patch}));
});
test('summary retains zero and tails, excludes failed latency, and combines source plus click per row',()=>{
 const result=summarize([{meaningfulMs:0,encodedBodyBytes:0,preparation:{elapsedMs:100},requests:[]},{meaningfulMs:100,encodedBodyBytes:null,preparation:{elapsedMs:0},requests:[]},{failed:true,meaningfulMs:999,requests:[]}],'navigation');
 assert.equal(result.attempted,3);assert.equal(result.successful,2);assert.equal(result.errors.failedOutcomes,1);
 assert.deepEqual(result.metrics.meaningfulMs,{samples:2,p50:0,p95:100,max:100});
 assert.deepEqual(result.metrics.sourcePlusClickMs,{samples:2,p50:100,p95:100,max:100});
 assert.equal(result.metrics.encodedBodyBytes.samples,1);assert.equal(result.metrics.encodedBodyBytes.p50,0);
 assert.equal(result.byteCoverage.windowObserved,1);assert.equal(result.byteCoverage.windowAttempted,2);
 assert.equal(summarize([{failed:true}],'workflow').metrics.meaningfulMs.p50,null);
});
test('request errors, unknown bytes and overlapping phases remain explicit, including capacity reads',()=>{
 const row={concurrency:2,transport:'pipelinePage',status:500,failed:true,serverTiming:'identity;dur=2.5, database;dur=7, total;dur=5, unsafe;dur=999',encodedBodyBytes:null,startOffsetMs:1,endOffsetMs:10};
 assert.deepEqual(phaseValues(row.serverTiming),{identity:2.5,database:7,total:5});
 const errors=errorCounts([row]);assert.equal(errors.httpErrors,1);assert.equal(errors.failedRequests,1);assert.equal(errors.unknownResponseBodySizes,1);
 const s=summarize([{...row,status:200,failed:false,encodedBodyBytes:40,elapsedMs:9,ttfbMs:8}],'capacity');
 assert.equal(s.requests[0].route,'/api/workspace?kind=pipelinePage');assert.equal(s.requests[0].serverPhases.database.p50,7);assert.equal(s.requests[0].serverPhases.total.p50,5);
 assert.equal(s.requests[0].requestDurationMs.p50,9);assert.deepEqual(delta({p50:1,p95:3,max:null},{p50:2,p95:1,max:0}),{p50:1,p95:-2,max:null});
});
