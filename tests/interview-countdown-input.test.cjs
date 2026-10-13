const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,id}=require('./helpers/interview-harness.cjs');
test('published slot panels use their actual approving owner and never borrow legacy, foreign or revoked authority',async()=>{
 const {approvedBookingPanel}=harness().load('utils/interview-collaboration.ts'),scope={clubId:'club',applicationId:'app',roundId:'round'};let ownerActive=true;
 const tx={clubMember:{findFirst:async({where})=>ownerActive&&where.userId==='owner'&&where.clubId==='club'?{id:'owner-member'}:null}};
 const room={id:'room',clubId:'club',roundId:'round',isOpen:true,panelMemberIds:['legacy'],approvedPanelMemberIds:['legacy','outsider'],panelApprovedBy:'owner'};
 const booking={applicationId:'app',roundId:'round',slot:{room,panelScheduleVersionId:'version',publishedPanelMemberIds:['published'],panelScheduleVersion:{id:'version',clubId:'club',roundId:'round',publishedBy:'owner'}}};
 assert.deepEqual(await approvedBookingPanel(tx,scope,booking),['published']);
 assert.deepEqual(await approvedBookingPanel(tx,scope,{...booking,slot:{...booking.slot,panelScheduleVersionId:null,panelScheduleVersion:null}}),['legacy']);
 for(const bad of [{...booking,applicationId:'foreign'},{...booking,slot:{...booking.slot,panelScheduleVersion:{...booking.slot.panelScheduleVersion,clubId:'other'}}},{...booking,slot:{...booking.slot,panelScheduleVersion:null}},{...booking,slot:{...booking.slot,room:{...room,isOpen:false}}}])assert.equal(await approvedBookingPanel(tx,scope,bad),null);
 ownerActive=false;assert.equal(await approvedBookingPanel(tx,scope,booking),null);
});
test('opening and joining a published booking use its exact slot duration and deny removed panel or approval authority',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts'),{collaborationAccess}=h.load('utils/interview-collaboration.ts');h.as(11);h.round.configuration={duration:35};
 const owner=h.members[0],member=h.members[1];h.tx.clubMember.findFirst=async({where})=>h.members.find(m=>m.clubId===where.clubId&&m.userId===where.userId&&m.isOwner&&m.status==='ACTIVE'&&!m.user.disabledAt)||null;
 const booking={id:id(600),...h.scope,slot:{id:id(601),startTime:new Date('2026-10-13T12:00:00Z'),endTime:new Date('2026-10-13T12:20:00Z'),panelScheduleVersionId:id(602),publishedPanelMemberIds:[member.id],panelScheduleVersion:{id:id(602),clubId:h.scope.clubId,roundId:h.scope.roundId,publishedBy:owner.userId},room:{id:id(603),clubId:h.scope.clubId,roundId:h.scope.roundId,isOpen:true,panelMemberIds:[],approvedPanelMemberIds:[],panelApprovedBy:null,duration:30}}};h.tx.interviewBooking.findUnique=async()=>booking;
 assert.equal((await api.openInterviewSession(h.scope)).timing.durationMs,20*60000);assert.deepEqual((await collaborationAccess(h.tx,h.scope,member.userId)).panelIds,[member.id]);
 booking.slot.publishedPanelMemberIds=[];await assert.rejects(collaborationAccess(h.tx,h.scope,member.userId),/assignment/);assert.equal((await api.openInterviewSession(h.scope)).timing,null);
 booking.slot.publishedPanelMemberIds=[member.id];owner.status='INACTIVE';await assert.rejects(collaborationAccess(h.tx,h.scope,member.userId),/approval/);
});
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
