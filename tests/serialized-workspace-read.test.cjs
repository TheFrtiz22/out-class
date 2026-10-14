const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const {serializedWorkspaceRead}=load('lib/serialized-workspace-read.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const waiting=[],values=[],errors=[];let calls=0,active=0,max=0;
 const reader=serializedWorkspaceRead(async()=>{calls++;active++;max=Math.max(max,active);try{return await new Promise((resolve,reject)=>waiting.push({resolve,reject}))}finally{active--}},value=>values.push(value),error=>errors.push(error));
 return{reader,waiting,values,errors,calls:()=>calls,max:()=>max};
}
test('slow polls share one read, accept its result, and do not starve under repeated ticks',async()=>{
 const f=fixture(),pending=f.reader.poll();for(let i=0;i<20;i++)f.reader.poll();
 assert.equal(f.calls(),1);f.waiting.shift().resolve({session:{id:'persisted-draft'}});await pending;
 assert.deepEqual(f.values,[{session:{id:'persisted-draft'}}]);assert.equal(f.max(),1);
});
test('post-command refresh drains the older read then loads current persisted state without stale publication',async()=>{
 const f=fixture();f.reader.poll();const refreshed=f.reader.refresh();f.reader.refresh();
 f.waiting.shift().resolve('before creation');await flush();assert.deepEqual(f.values,[]);assert.equal(f.calls(),2);
 f.waiting.shift().resolve('new draft');await refreshed;assert.deepEqual(f.values,['new draft']);assert.equal(f.max(),1);
});
test('errors clear protected data through the caller; retry reauthorizes and disposal ignores old account/session responses',async()=>{
 const f=fixture();f.reader.poll();f.waiting.shift().reject(Error('Access revoked'));await flush();assert.equal(f.errors.length,1);
 const retry=f.reader.refresh();f.waiting.shift().resolve('authorized again');await retry;assert.deepEqual(f.values,['authorized again']);
 const old=f.reader.poll();f.reader.dispose();f.waiting.shift().resolve('old account secret');await old;
 assert.deepEqual(f.values,['authorized again']);await f.reader.refresh();assert.equal(f.calls(),3);
});
