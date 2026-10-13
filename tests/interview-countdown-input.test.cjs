const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,id}=require('./helpers/interview-harness.cjs');
test('countdown uses the exact booked slot, explicit stable round configuration, and no missing-duration default',()=>{
 const {interviewTiming}=harness().load('lib/interview-session-timing.ts'),scope={clubId:'club',applicationId:'app',roundId:'round'},config={duration:35};
 const booking={id:'booking',applicationId:'app',roundId:'round',slot:{id:'slot',startTime:'2026-10-12T12:00:00Z',endTime:'2026-10-12T12:20:00Z',room:{id:'room',clubId:'club',roundId:'round',duration:30}}};
 assert.equal(interviewTiming(scope,config,booking).durationMs,1200000);assert.equal(interviewTiming(scope,config,null).durationMs,2100000);for(const invalid of [null,{}, {duration:0},{duration:NaN},{duration:20.5},{duration:'20'}])assert.equal(interviewTiming(scope,invalid,null),null);
 for(const wrong of [{...booking,applicationId:'other'},{...booking,roundId:null},{...booking,slot:{...booking.slot,room:{...booking.slot.room,clubId:'other'}}},{...booking,slot:{...booking.slot,endTime:booking.slot.startTime}}])assert.equal(interviewTiming(scope,config,wrong),null);
 assert.notEqual(interviewTiming(scope,config,booking).contextKey,interviewTiming(scope,config,{...booking,slot:{...booking.slot,startTime:'2026-10-12T13:00:00Z',endTime:'2026-10-12T13:20:00Z'}}).contextKey);
});
test('timestamp countdown survives pause, background elapsed, refresh, zero and explicit schedule reset without extending time',()=>{
 const {freshCountdown,parseCountdown,pauseCountdown,countdownRemaining}=harness().load('lib/interview-timer.ts'),timing={durationMs:1200000,contextKey:'first'};
 const first=freshCountdown(timing);assert.equal(countdownRemaining(first,99999),1200000);const running={...first,startedAt:10000};assert.equal(countdownRemaining(parseCountdown(JSON.stringify(running),timing),610000),600000);const paused=pauseCountdown(running,20000);assert.equal(countdownRemaining(paused,999999),1190000);assert.equal(countdownRemaining({...paused,startedAt:30000},40000),1180000);assert.equal(countdownRemaining(running,99999999),0);
 const changed={durationMs:2100000,contextKey:'changed'};assert.equal(parseCountdown(JSON.stringify(running),changed).contextKey,'first');assert.equal(freshCountdown(changed).remainingMs,2100000);assert.equal(parseCountdown('{bad',changed).remainingMs,2100000);assert.equal(parseCountdown(JSON.stringify({elapsed:24000,startedAt:null}),timing).remainingMs,1176000);
});
test('highlight input preserves shortcuts, interactive controls, unicode and native composition',()=>{
 const {resumeCommentInput}=harness().load('lib/resume-comment-input.ts');for(const key of ['a','é','中','🙂',' '])assert.equal(resumeCommentInput({key},false).text,key);
 for(const key of ['Escape','ArrowDown','Tab','Enter','F5','Shift'])assert.equal(resumeCommentInput({key},false),null);
 for(const e of [{key:'c',ctrlKey:true},{key:'v',metaKey:true},{key:'x',altKey:true},{key:'a',defaultPrevented:true}])assert.equal(resumeCommentInput(e,false),null);assert.equal(resumeCommentInput({key:'a'},true),null);
 assert.equal(resumeCommentInput({key:'@',ctrlKey:true,altKey:true,altGraph:true},false).text,'@');for(const e of [{key:'Dead'},{key:'Process'},{key:'Unidentified',keyCode:229},{key:'x',isComposing:true}])assert.deepEqual(resumeCommentInput(e,false),{text:'',nativeComposition:true});
});
test('live timing metadata honors authorization and does not rely on the schema default for missing configuration',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');h.app.round.configuration={duration:35};assert.equal((await api.openInterviewSession(h.scope)).timing.durationMs,2100000);h.app.round.configuration={};assert.equal((await api.openInterviewSession(h.scope)).timing,null);h.assignments[0].revokedAt=new Date();await assert.rejects(api.openInterviewSession(h.scope),/panel/);await assert.rejects(api.openInterviewSession({...h.scope,clubId:id(99)}));
});
