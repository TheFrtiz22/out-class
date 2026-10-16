const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./helpers/communications-loader.cjs');
test('claim errors are sanitized, distinct from deferrals, and leave work untouched even if logging throws',async()=>{
 for(const brokenLogger of [false,true]){
  const logged=[],prior={error:console.error,info:console.info};let mutations=0;
  console.error=(...args)=>{if(brokenLogger)throw Error('sink failure');logged.push(args)};console.info=()=>{if(brokenLogger)throw Error('sink failure')};
  try{
   const failure=Object.assign(Error('password=secret cookie=secret SQL private@example.invalid'),{code:'P2024',meta:{password:'secret'}});
   const prisma={$transaction:async(fn,options)=>{if(options.timeout===3000)return [{count:1n,age:12345}];throw failure},$queryRaw:async()=>[{count:1n,age:12345}],scheduledCommunication:{update:()=>mutations++}};
   const worker=loader({'@/utils/prisma':{prisma}})('utils/scheduled-communications.ts');
   const result=await worker.processScheduledCommunications(3);
   assert.equal(result.claimErrors,3);assert.equal(result.skipped,0);assert.equal(result.claimed,0);assert.equal(result.dueCount,1);assert.equal(result.oldestDueAgeMs,12345);assert.equal(mutations,0);
   assert.ok(!JSON.stringify(logged).includes('secret'));if(!brokenLogger)for(const [event,detail] of logged){assert.equal(event,'scheduler.failure');assert.equal(detail.stage,'claim');assert.equal(detail.code,'P2024');assert.equal(detail.sqlState,null);assert.equal(detail.phase,'acquisition');assert.equal(detail.transactionMs,null);assert.equal(detail.maxWaitMs,1000);assert.equal(detail.timeoutMs,4000);}
  }finally{Object.assign(console,prior)}
 }
});
test('ordinary no-candidate deferral is not a claim exception',async()=>{
 let query=0;const prior=console.info;console.info=()=>{};
 try{
  const tx={$queryRaw:async()=>{query++;return query%4===3?[{total:0n,decisions:0n}]:[]}};
  const worker=loader({'@/utils/prisma':{prisma:{$transaction:async(fn,options)=>options.timeout===3000?[{count:1n,age:1000}]:fn(tx),$queryRaw:async()=>[{count:1n,age:1000}]}}})('utils/scheduled-communications.ts');
  const result=await worker.processScheduledCommunications(1);assert.equal(result.claimErrors,0);assert.equal(result.skipped,1);assert.equal(result.deferrals.noCandidate,1);assert.equal(result.dueCount,1);
 }finally{console.info=prior}
});
test('authenticated cron reports claim failure as 503 without treating it as an empty queue',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='local-test';
 try{
  const route=loader({'@/utils/scheduled-communications':{processScheduledCommunications:async()=>({claimErrors:1,published:0})}})('app/api/internal/scheduled-communications/route.ts');
  const response=await route.POST(new Request('http://localhost',{headers:{authorization:'Bearer local-test'}}));assert.equal(response.status,503);assert.deepEqual(await response.json(),{claimErrors:1,published:0});
 }finally{if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior}
});

test('claim phase diagnostics distinguish callback acquisition, query failure and commit, without raw messages',async()=>{
 const {createSchedulerClaimTrace,schedulerErrorCodes}=loader({})('lib/scheduler-claim-diagnostics.ts');
 const trace=createSchedulerClaimTrace();assert.equal(trace.snapshot().phase,'acquisition');assert.equal(trace.snapshot().transactionMs,null);
 trace.enter();trace.step('advisory_lock');assert.equal(trace.snapshot().phase,'advisory_lock');assert.equal(typeof trace.snapshot().transactionMs,'number');
 trace.step('commit');assert.equal(trace.snapshot().phase,'commit');
 assert.deepEqual(schedulerErrorCodes({code:'P2010',meta:{code:'55P03',message:'secret'}}),{code:'P2010',sqlState:'55P03'});
 assert.deepEqual(schedulerErrorCodes({code:'password=secret',meta:{code:'SQL secret'}}),{code:'UNKNOWN',sqlState:null});
 assert.deepEqual(schedulerErrorCodes({get code(){throw Error('secret')}}),{code:'UNKNOWN',sqlState:null});
});
