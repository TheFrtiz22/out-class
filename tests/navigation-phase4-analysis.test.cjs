const {test}=require('node:test'),assert=require('node:assert/strict');
const {sourceMetrics,describe}=require('../scripts/summarize-navigation-phase4.cjs');
const preparation=()=>({meaningfulMs:20,elapsedMs:30,dom:{document:{ttfbMs:5}},requests:[]});
const success=()=>({meaningfulMs:10,pageErrorCount:0,preparation:preparation(),requests:[{route:'/api/workspace?kind=pipelineList',status:200,encodedBodyBytes:100,serverTiming:'identity;dur=2, database;dur=3, total;dur=8'}]});
test('phase 4 source bytes stay unknown for incomplete resources and SSE is accounted separately',()=>{
 const row={preparation:preparation()};row.preparation.requests=[{type:'script',route:'/script.js',pending:true,encodedBodyBytes:null},{type:'eventsource',route:'/api/communications/stream',pending:true,encodedBodyBytes:null}];let result=sourceMetrics(row);assert.equal(result.encodedBodyBytes,null);assert.equal(result.scriptBytes,null);assert.equal(result.nonSsePending,1);assert.equal(result.requestCount,2);
 row.preparation.requests[0]={type:'script',route:'/script.js',pending:false,encodedBodyBytes:200};result=sourceMetrics(row);assert.equal(result.encodedBodyBytes,200);assert.equal(result.scriptBytes,200);assert.equal(result.nonSsePending,0);
});
test('phase 4 keeps all failures and distinguishes preparation failure from timed readiness failure',()=>{
 const rows=Array.from({length:9},success),failed={failed:true,stage:'source',preparation:{...preparation(),meaningfulMs:null},requests:[]};let result=describe([...rows,failed]);assert.equal(result.planned,10);assert.equal(result.successful,9);assert.equal(result.source.successful,9);assert.match(result.source.latencyInterpretation,/not established/);
 result=describe([...rows,{...failed,stage:'measured',preparation:preparation()}]);assert.equal(result.successful,9);assert.equal(result.source.successful,10);assert.equal(result.preparationFailures,0);assert.equal(result.measuredFailures,1);assert.equal(result.meaningfulMs.samples,9);assert.throws(()=>describe(rows));
});
