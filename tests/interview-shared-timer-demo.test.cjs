const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/demo-harness.cjs');
test('Demo shared timer: same transitions and revision checks in the demo store, never a live action or device storage',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts'),lib=h.load('lib/interview-shared-timer.ts');
 demoStore.start();demoStore.mutate(s=>s.perspective.role='leader');const club=demoStore.get().clubs[0],round=club.rounds.find(r=>r.name==='Interview');
 const app=(await api.getInterviewWorkspace(club.id)).applications.find(a=>a.roundId===round.id&&!a.completedRoundIds.includes(round.id));
 const scope={clubId:club.id,roundId:round.id,applicationId:app.id};await api.openInterviewSession(scope);
 const read=async()=>(await api.getInterviewCollaboration({...scope,clientId:crypto.randomUUID()})).timer;
 const fresh=await read();assert.equal(fresh.revision,0);assert.equal(lib.timerPhase(fresh),'ready');assert.ok(fresh.durationMs>0);
 const press=(revision,command)=>api.controlInterviewTimer({...scope,revision,requestId:crypto.randomUUID(),command});
 assert.equal((await press(0,{type:'start'})).status,'ok');assert.equal((await press(0,{type:'start'})).status,'conflict','a stale press gets current state');
 assert.equal((await press(1,{type:'pause'})).timer.revision,2);assert.equal((await press(2,{type:'adjust',deltaMs:60000})).timer.durationMs,fresh.durationMs+60000);
 assert.equal((await press(3,{type:'reset'})).timer.durationMs,fresh.durationMs);
 // A reload (new store session) keeps the demo room's timer.
 demoStore.stop();demoStore.start();demoStore.mutate(s=>s.perspective.role='leader');assert.equal((await read()).revision,4);
 assert.equal(h.calls(),0,'no live server action was called');
 for(const k of global.localStorage.data.keys())assert.doesNotMatch(k,/timer/i);
 demoStore.stop();
});
test('live timer component keeps no device copy and imports no demo code',()=>{
 const src=fs.readFileSync('components/interview-timer.tsx','utf8');
 assert.doesNotMatch(src,/localStorage|sessionStorage|lib\/demo/);
 for(const f of ['components/interview-timer.tsx','actions/interview-timer.ts','lib/interview-shared-timer.ts','hooks/use-interview-workspace.ts'])assert.doesNotMatch(fs.readFileSync(f,'utf8'),/from ["']@\/lib\/demo\//,f);
});
