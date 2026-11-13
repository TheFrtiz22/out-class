const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
const {harness:unitHarness}=require('./helpers/interview-harness.cjs');
const MIN=60000;
// Server actions read Date.now(); tests drive the server clock explicitly.
const realNow=Date.now;let serverNow=Date.UTC(2026,10,11,15,0,0);
function setServer(ms){serverNow=ms;Date.now=()=>serverNow;}
function restore(){Date.now=realNow;}
async function setup(){
 const h=await harness();const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts'),timer=h.load('actions/interview-timer.ts'),lib=h.load('lib/interview-shared-timer.ts');
 await h.db.query(`UPDATE "PipelineRound" SET configuration='{"duration":20}' WHERE id=$1`,[h.ids.round]);
 for(const member of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids[member+'Member'],h.ids.owner]);
 h.as(h.ids.panel);await kit.openInterviewSession(h.scope);h.as(h.ids.peer);await kit.openInterviewSession(h.scope);
 // Each "device" reads the room through the existing collaboration poll and keeps its clock offset.
 const device=(userId,skewMs)=>{const clientId=randomUUID();return{
  async read(){h.as(userId);const sentAt=serverNow+skewMs,v=await rooms.getInterviewCollaboration({...h.scope,clientId});return{...v.timer,clockOffsetMs:lib.clockOffsetMs(v.timer.serverNow,sentAt,serverNow+skewMs)};},
  async press(revision,command,requestId=randomUUID()){h.as(userId);return timer.controlInterviewTimer({...h.scope,revision,requestId,command});},
  remaining(view){return lib.timerRemainingMs(view,(serverNow+skewMs)+view.clockOffsetMs);},
 };};
 return{...h,rooms,kit,timer,lib,device};
}
test('two interviewers on different devices share one countdown; reload, pause/resume, adjust and reset sync; skewed clocks agree',async()=>{
 const h=await setup();try{setServer(serverNow);
 // Device A runs 5 minutes fast, device B 5 minutes slow: both must still show the server's remaining time.
 const a=h.device(h.ids.panel,5*MIN),b=h.device(h.ids.peer,-5*MIN);
 let va=await a.read(),vb=await b.read();
 assert.equal(va.revision,0);assert.equal(a.remaining(va),20*MIN);assert.equal(b.remaining(vb),20*MIN);
 assert.equal((await h.db.query('SELECT count(*)::int n FROM "InterviewTimer"')).rows[0].n,0,'reading never creates a timer row');
 const started=await a.press(0,{type:'start'});assert.equal(started.status,'ok');assert.equal(started.timer.revision,1);
 setServer(serverNow+90000);vb=await b.read();assert.equal(vb.revision,1);assert.equal(b.remaining(vb),20*MIN-90000);
 // A 5-minute skew computed naively from the local clock would be off by 5 minutes.
 assert.notEqual(h.lib.timerRemainingMs(vb,serverNow-5*MIN),b.remaining(vb));
 // Reload: a brand-new client (new clientId, no local state) continues the countdown.
 setServer(serverNow+30000);const reloaded=h.device(h.ids.panel,5*MIN);assert.equal(reloaded.remaining(await reloaded.read()),20*MIN-120000);
 // Pause on B; A sees it frozen however much later it looks.
 const pausedB=await b.press(1,{type:'pause'});assert.equal(pausedB.status,'ok');
 setServer(serverNow+10*MIN);va=await a.read();assert.equal(h.lib.timerPhase(va),'paused');assert.equal(a.remaining(va),20*MIN-120000);
 const resumed=await a.press(va.revision,{type:'resume'});assert.equal(resumed.status,'ok');assert.equal(resumed.timer.pausedMs,10*MIN);
 setServer(serverNow+60000);vb=await b.read();assert.equal(h.lib.timerPhase(vb),'running');assert.equal(b.remaining(vb),20*MIN-180000);
 // +1 / -1 minute and reset reach the other device.
 await b.press(vb.revision,{type:'adjust',deltaMs:MIN});va=await a.read();assert.equal(a.remaining(va),20*MIN-120000);
 await a.press(va.revision,{type:'adjust',deltaMs:-5*MIN});vb=await b.read();assert.equal(b.remaining(vb),20*MIN-420000);
 await b.press(vb.revision,{type:'reset'});va=await a.read();assert.equal(h.lib.timerPhase(va),'ready');assert.equal(a.remaining(va),20*MIN);assert.equal(va.revision,6);
 const [row]=(await h.db.query('SELECT * FROM "InterviewTimer"')).rows;assert.equal(row.revision,6);assert.equal(row.updatedBy,h.ids.peerMember);
 }finally{restore();await h.db.close();}
});
test('simultaneous presses: one wins, the stale device gets current state, retries are idempotent and the row is never corrupted',async()=>{
 const h=await setup();try{setServer(serverNow);
 const a=h.device(h.ids.panel,0),b=h.device(h.ids.peer,0);
 await a.read();await b.read();
 // Both saw revision 0 and press at once.
 const [ra,rb]=await Promise.all([a.press(0,{type:'start'}),b.press(0,{type:'start'})]);
 assert.deepEqual([ra.status,rb.status].sort(),['conflict','ok']);
 const loser=ra.status==='conflict'?ra:rb;assert.equal(loser.timer.revision,1,'the stale device is handed the current timer');assert.equal(h.lib.timerPhase(loser.timer),'running');
 // Both see revision 1: pause and +1 min at once. Exactly one applies.
 setServer(serverNow+60000);
 const [pa,pb]=await Promise.all([a.press(1,{type:'pause'}),b.press(1,{type:'adjust',deltaMs:MIN})]);
 assert.equal([pa,pb].filter(r=>r.status==='ok').length,1);
 let [row]=(await h.db.query('SELECT * FROM "InterviewTimer"')).rows;assert.equal(row.revision,2);
 // A lost response retried with the same request ID does not apply twice.
 const requestId=randomUUID(),first=await a.press(2,{type:'adjust',deltaMs:MIN},requestId),retry=await a.press(2,{type:'adjust',deltaMs:MIN},requestId);
 assert.equal(first.status,'ok');assert.equal(retry.status,'ok');assert.equal(retry.timer.revision,3);assert.equal(retry.timer.durationMs,first.timer.durationMs);
 // A command that no longer applies (already paused/running elsewhere) is a conflict, not a write.
 const v=await b.read();const wrong=await b.press(v.revision,{type:h.lib.timerPhase(v)==='running'?'resume':'pause'});assert.equal(wrong.status,'conflict');
 [row]=(await h.db.query('SELECT * FROM "InterviewTimer"')).rows;assert.equal(row.revision,3);
 // The database itself refuses a skipped revision or impossible state.
 await assert.rejects(h.db.query('UPDATE "InterviewTimer" SET revision=revision+2'),/revision/);
 await assert.rejects(h.db.query('UPDATE "InterviewTimer" SET revision=revision+1,"startedAt"=NULL,"pausedMs"=5'),/InterviewTimer_state/);
 }finally{restore();await h.db.close();}
});
test('only current panel members of this club, round and room can read or change the timer; the applicant never receives it',async()=>{
 const h=await setup();try{setServer(serverNow);
 const a=h.device(h.ids.panel,0);await a.press(0,{type:'start'});
 const control=(userId,scope=h.scope)=>{h.as(userId);return h.timer.controlInterviewTimer({...scope,revision:1,requestId:randomUUID(),command:{type:'pause'}});};
 const read=(userId,scope=h.scope)=>{h.as(userId);return h.rooms.getInterviewCollaboration({...scope,clientId:randomUUID()});};
 // The applicant (even if they knew every ID) and members without a panel assignment are refused.
 await assert.rejects(control(h.ids.student),/no longer have access/);await assert.rejects(read(h.ids.student),/no longer have access/);
 for(const user of [h.ids.scheduler,h.ids.owner]){await assert.rejects(control(user),/no longer have access/);await assert.rejects(read(user),/no longer have access/);}
 // Another club's scope and another round's scope are refused.
 const otherRound=randomUUID();await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order",configuration) VALUES ($1,$2,\'Final\',2,\'{"duration":30}\')',[otherRound,h.ids.club]);
 await assert.rejects(control(h.ids.panel,{...h.scope,roundId:otherRound}));await assert.rejects(read(h.ids.panel,{...h.scope,roundId:otherRound}));
 await assert.rejects(control(h.ids.panel,{...h.scope,clubId:randomUUID()}));await assert.rejects(read(h.ids.panel,{...h.scope,clubId:randomUUID()}));
 // A revoked panelist loses access immediately; the room is unchanged.
 await h.db.query('UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "memberId"=$1',[h.ids.peerMember]);
 await assert.rejects(control(h.ids.peer),/no longer have access/);
 const [row]=(await h.db.query('SELECT revision FROM "InterviewTimer"')).rows;assert.equal(row.revision,1);
 // Input is validated before any work: unknown commands and fields are refused.
 h.as(h.ids.panel);await assert.rejects(h.timer.controlInterviewTimer({...h.scope,revision:1,requestId:randomUUID(),command:{type:'set',startedAt:0}}));
 await assert.rejects(h.timer.controlInterviewTimer({...h.scope,revision:1,requestId:randomUUID(),command:{type:'pause'},startedAt:0}));
 // Browser database roles have no access to the table.
 for(const role of ['anon','authenticated'])assert.equal((await h.db.query(`SELECT has_table_privilege($1,'"InterviewTimer"','SELECT') ok`,[role])).rows[0].ok,false);
 }finally{restore();await h.db.close();}
});
test('timer math: offsets cancel device clock error, adjust clamps, long pauses rebase, stale responses never roll back',()=>{
 const lib=unitHarness().load('lib/interview-shared-timer.ts'),timing={durationMs:20*MIN,contextKey:'k'};
 const t0=1_800_000_000_000;let s=lib.applyTimerCommand(lib.freshTimerState(timing),{type:'start'},t0,timing);
 // Clock 5 minutes slow/fast: sent and received on the device clock, server stamped in between.
 for(const skew of [-5*MIN,5*MIN,0]){const offset=lib.clockOffsetMs(t0+60000,t0+59800+skew,t0+60200+skew);assert.ok(offset===-skew);assert.equal(lib.timerRemainingMs(s,(t0+60000+skew)+offset),19*MIN);}
 assert.equal(lib.applyTimerCommand(s,{type:'start'},t0,timing),null,'start only from ready');
 const expired=t0+25*MIN;assert.equal(lib.timerRemainingMs(s,expired),0);
 const plus=lib.applyTimerCommand(s,{type:'adjust',deltaMs:MIN},expired,timing);assert.equal(lib.timerRemainingMs(plus,expired),MIN,'+1 min on an expired timer shows 01:00');
 const minus=lib.applyTimerCommand(s,{type:'adjust',deltaMs:-60*MIN},t0+MIN,timing);assert.equal(lib.timerRemainingMs(minus,t0+MIN),0);
 const ready=lib.applyTimerCommand(lib.freshTimerState(timing),{type:'adjust',deltaMs:-60*MIN},t0,timing);assert.equal(ready.durationMs,MIN,'never 00:00 before starting');
 assert.equal(lib.applyTimerCommand(s,{type:'adjust',deltaMs:60*MIN},t0,timing).durationMs,80*MIN);
 const paused=lib.applyTimerCommand(s,{type:'pause'},t0+MIN,timing),longResume=lib.applyTimerCommand(paused,{type:'resume'},t0+30*86400000,timing);
 assert.equal(longResume.pausedMs,0);assert.equal(lib.timerRemainingMs(longResume,t0+30*86400000),19*MIN);
 assert.equal(lib.timerCommandSchema.safeParse({type:'adjust',deltaMs:0}).success,false);assert.equal(lib.timerCommandSchema.safeParse({type:'adjust',deltaMs:500}).success,false);
 // +1 min more than 4 hours after expiry: counts again from now (01:00 left), cap applies to what is left.
 const late=t0+5*60*MIN,again=lib.applyTimerCommand(s,{type:'adjust',deltaMs:MIN},late,timing);assert.equal(lib.timerRemainingMs(again,late),MIN);assert.equal(lib.timerRemainingMs(again,late+30000),30000);assert.equal(lib.timerPhase(again),'running');
 const latePaused=lib.applyTimerCommand(s,{type:'pause'},late,timing),againPaused=lib.applyTimerCommand(latePaused,{type:'adjust',deltaMs:MIN},late+MIN,timing);assert.equal(lib.timerPhase(againPaused),'paused');assert.equal(lib.timerRemainingMs(againPaused,late+10*MIN),MIN);
 const near=lib.applyTimerCommand({...s,durationMs:lib.TIMER_MAX_DURATION_MS},{type:'adjust',deltaMs:60*MIN},t0+MIN,timing);assert.equal(lib.timerRemainingMs(near,t0+MIN),lib.TIMER_MAX_DURATION_MS,'remaining is capped at 4 hours');assert.ok(near.durationMs<=lib.TIMER_MAX_DURATION_MS);
 const newer={...s,revision:3,serverNow:5},older={...s,revision:2,serverNow:9};assert.equal(lib.newerTimer(newer,older),newer);assert.equal(lib.newerTimer(older,newer),newer);
});
