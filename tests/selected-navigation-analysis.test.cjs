const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {interval,enriched,summarize}=require('../scripts/summarize-selected-navigation.cjs');
test('paired block intervals preserve direction and missing/duplicate critical reads are rejected',()=>{
 const pairs=Array.from({length:4},()=>({A:Array.from({length:5},()=>({meaningfulMs:100})),B:Array.from({length:5},()=>({meaningfulMs:300}))}));assert.deepEqual(interval(pairs,'meaningfulMs'),{low:-200,high:-200});
 const request={route:'/api/workspace?kind=tasks',serverTiming:'identity;dur=10.5, database;dur=2, total;dur=13',startMs:4,ttfbMs:15,encodedBodyBytes:100};
 const row=enriched({path:'meetings → tasks',requests:[request]});assert.equal(row.readServerMs,13);assert.equal(row.identityMs,10.5);assert.equal(row.readStartMs,4);assert.throws(()=>enriched({path:'meetings → tasks',requests:[]}),/exactly one/);assert.throws(()=>enriched({path:'meetings → tasks',requests:[request,request]}),/exactly one/);
});
test('an incomplete or failed study cannot become an accepted comparison',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-selected-analysis-'));try{fs.writeFileSync(path.join(root,'PROTOCOL.json'),JSON.stringify({collectionComplete:false,failures:[]}));assert.throws(()=>summarize(root));fs.writeFileSync(path.join(root,'PROTOCOL.json'),JSON.stringify({collectionComplete:true,failures:[{phase:'measure'}]}));assert.throws(()=>summarize(root));}finally{fs.rmSync(root,{recursive:true})}
});
