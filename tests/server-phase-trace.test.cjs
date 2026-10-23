const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const {traceWorkspaceRequest,serverPhase,tracePrismaTransactions,traceDatabaseQuery}=load('lib/server-phase-trace.ts');
test('traces isolate concurrent requests, contain fixed labels, and never emit caller data',async()=>{
 const one=traceWorkspaceRequest(async()=>{await serverPhase('identity',()=>Promise.resolve('secret'));return new Response('private')});
 const two=traceWorkspaceRequest(async()=>new Response('denied',{status:403}));
 const [a,b]=await Promise.all([one,two]);
 assert.notEqual(a.headers.get('x-outclass-trace-id'),b.headers.get('x-outclass-trace-id'));
 assert.match(a.headers.get('server-timing'),/identity;dur=/);assert.doesNotMatch(b.headers.get('server-timing'),/identity/);
 assert.doesNotMatch([...a.headers].flat().join(' '),/secret|private/);
});
test('Prisma tracing preserves batch laziness, callback identity, options and errors',async()=>{
 const tx={},options={timeout:1234},seen=[];
 const client=tracePrismaTransactions({$transaction:async(operation,opts)=>{seen.push(opts);return typeof operation==='function'?operation(tx):operation}});
 const response=await traceWorkspaceRequest(async()=>{
   assert.equal(await client.$transaction(value=>{assert.equal(value,tx);return 'ok'},options),'ok');
   await traceDatabaseQuery({strings:['SELECT secret FOR UPDATE']},()=>Promise.resolve('result'));
   await assert.rejects(serverPhase('live_session',()=>Promise.reject(Error('sensitive error'))),/sensitive error/);
   assert.deepEqual(await client.$transaction(['lazy promise'],options),['lazy promise']);
   return new Response();
 });
 assert.deepEqual(seen,[options,options]);
 const header=response.headers.get('server-timing');for(const phase of ['transaction','transaction_acquire','database','lock_query','live_session'])assert.match(header,new RegExp(phase+';dur='));
 assert.doesNotMatch(header,/secret|sensitive|SELECT/);
});
test('opt-in phase logs contain only a fresh trace ID, status, fixed phase labels and numeric measurements',async()=>{
 const prior=process.env.OUTCLASS_PHASE_TRACE,info=console.info,logs=[];process.env.OUTCLASS_PHASE_TRACE='1';console.info=value=>logs.push(value);
 try{await traceWorkspaceRequest(async()=>{await traceDatabaseQuery({strings:['SELECT sensitive_fixture FOR UPDATE']},()=>Promise.resolve('sensitive_result'));return new Response('sensitive_body',{status:403})})}finally{console.info=info;if(prior===undefined)delete process.env.OUTCLASS_PHASE_TRACE;else process.env.OUTCLASS_PHASE_TRACE=prior}
 assert.equal(logs.length,1);assert.doesNotMatch(logs[0],/sensitive|SELECT|cookie|token|userId|clubId|error/);const record=JSON.parse(logs[0]);assert.equal(record.event,'workspace.phases');assert.equal(record.status,403);assert.equal(typeof record.totalMs,'number');assert.deepEqual(Object.keys(record.phases).sort(),['database','lock_query']);
});
