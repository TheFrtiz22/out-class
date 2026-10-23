const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const {inFlightWorkspaceReads}=load('lib/in-flight-workspace-reads.ts');
const {workspaceReadQueue}=load('lib/workspace-read-queue.ts');
const tick=()=>new Promise(r=>setImmediate(r));
test('identical pending resources share only within their owner; success/error always revalidate',async()=>{
 const a=inFlightWorkspaceReads(),b=inFlightWorkspaceReads();let calls=0,finish;
 const run=()=>{calls++;return new Promise(r=>finish=r)};
 const first=a.read('club:rooms',run),same=a.read('club:rooms',run);assert.equal(first,same);await tick();assert.equal(calls,1);finish('rooms');await first;
 await b.read('club:rooms',async()=>++calls);await a.read('club:rooms',async()=>++calls);assert.equal(calls,3);
 await assert.rejects(a.read('club:rooms',async()=>{throw Error('denied')}),/denied/);assert.equal(await a.read('club:rooms',async()=>4),4);
});
test('invalidating a pending scope fences old results and old cleanup cannot delete a newer read',async()=>{
 const a=inFlightWorkspaceReads();let finish,finishNew;
 const old=a.read('resource',()=>new Promise(r=>finish=r));await tick();a.invalidate();
 const fresh=a.read('resource',()=>new Promise(r=>finishNew=r));await tick();finish('stale private value');await assert.rejects(old,/access changed/);
 assert.equal(a.read('resource',async()=>{throw Error('duplicate')}),fresh);finishNew('current');assert.equal(await fresh,'current');
});
test('read queue permits three independent dispatches and bounds rapid switching; aborted queued reads never dispatch',async()=>{
 const schedule=workspaceReadQueue(3,2),signal=new AbortController().signal,finish=[];let active=0,max=0;
 const run=()=>{active++;max=Math.max(max,active);return new Promise(r=>finish.push(()=>{active--;r('ok')}))};
 const jobs=[schedule(run,signal),schedule(run,signal),schedule(run,signal)];await tick();assert.equal(active,3);
 const cancelled=new AbortController(),queued=schedule(run,cancelled.signal);cancelled.abort();await assert.rejects(queued,/cancelled/);
 jobs.push(schedule(run,signal),schedule(run,signal));await assert.rejects(schedule(run,signal),/Too many/);
 while(finish.length){finish.shift()();await tick()}await Promise.all(jobs);assert.equal(max,3);assert.equal(active,0);
 await assert.rejects(schedule(async()=>{throw Error('failure')},signal),/failure/);assert.equal(await schedule(async()=>true,signal),true);
});
