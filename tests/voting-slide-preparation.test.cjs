const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const lib=load('lib/voting-slide-preparation.ts');
const hash=t=>createHash('sha256').update(t,'utf8').digest('hex');
const clubId=uuid(1),sessionId=uuid(2),appId=uuid(3),roundId=uuid(4),cycleId=uuid(5),leaderId=uuid(6),voterId=uuid(7);
const src=(type,id,text,extra={})=>({type,id,version:hash(text),revision:null,label:'Label',author:null,roundId:null,roundName:null,text,...extra});

test('quotes must be verbatim, summaries are labelled leader writing, at most three, and changed sources are never silently refreshed',()=>{
 const thought=src('INTERVIEW_THOUGHT','thought:r1','Led the case discussion and asked precise follow-up questions.',{author:'Avery Interviewer',roundId,roundName:'Round 2'});
 const quote={id:uuid(10),mode:'QUOTE',text:'asked precise follow-up questions',source:{type:thought.type,id:thought.id,version:thought.version}};
 const [stored]=lib.buildSlideHighlights([quote],[thought],'Lee Leader');
 assert.equal(stored.text,quote.text);assert.equal(stored.source.author,'Avery Interviewer');assert.equal(stored.source.roundName,'Round 2');assert.equal(stored.source.text,thought.text);assert.equal(stored.writtenBy,null);
 assert.throws(()=>lib.buildSlideHighlights([{...quote,text:'asked very precise questions'}],[thought],'Lee Leader'),/exactly/);
 const summary=lib.buildSlideHighlights([{...quote,id:uuid(11),mode:'SUMMARY',text:'Strong, curious interviewer presence.'}],[thought],'Lee Leader')[0];
 assert.equal(summary.writtenBy,'Lee Leader');assert.equal(lib.highlightAttribution(summary),'Final interview thoughts · Avery Interviewer · Round 2');
 assert.throws(()=>lib.saveSlidePreparationSchema.parse({clubId,sessionId,applicationId:appId,requestId:uuid(12),revision:0,highlights:[1,2,3,4].map(n=>({...quote,id:uuid(20+n)}))}),/up to 3/);
 assert.throws(()=>lib.slideHighlightInput.parse({...quote,mode:'SUMMARY',text:'x'.repeat(281)}),/280/);
 // Source edited after selection: an unchanged saved highlight keeps its original version; a new save of the stale version is refused.
 const edited={...thought,text:thought.text+' Revised.',version:hash(thought.text+' Revised.')};
 assert.deepEqual(lib.buildSlideHighlights([quote],[edited],'Lee Leader',[stored]),[stored]);
 assert.throws(()=>lib.buildSlideHighlights([{...quote,id:uuid(13)}],[edited],'Lee Leader'),/changed/);
 assert.equal(lib.slideHighlightStatus(stored,[edited]),'UPDATED');assert.equal(lib.slideHighlightStatus(stored,[]),'UNAVAILABLE');assert.equal(lib.slideHighlightStatus(stored,[thought]),'CURRENT');
 assert.equal(lib.preparationGap(0,4),'No highlights selected');assert.equal(lib.preparationGap(1,4),'Consider one more highlight');assert.equal(lib.preparationGap(1,1),null);assert.equal(lib.preparationGap(0,0),'No source material yet');assert.equal(lib.preparationGap(3,9),null);
});

function interviewMock(state){return{
 votingInterviewEvidence:async(_tx,_c,_a,userId,selected)=>{const ok=state.interviewUsers.includes(userId);return{score:{byRound:ok&&selected.score?[{roundId,roundName:'Round 2',average:8.5,submitted:2}]:[]},thoughts:ok&&selected.thoughts?state.thoughts:[],authorized:ok,roundIds:ok?[roundId]:[]};},
 votingHighlightChoices:async()=>state.resume,
};}
function observationMock(state){return{
 listObservations:async(_tx,_s,userId)=>{if(!state.observationUsers.includes(userId))throw Error('Additional observations are unavailable.');return state.observations.filter(o=>!o.deletedAt);},
 authorizeObservation:async(_tx,_s,userId)=>{if(!state.observationUsers.includes(userId))throw Error('Additional observations are unavailable.');},
};}

test('gathering cites submitted/shared sources with attribution, excludes sensitive profile fields, and viewers see only highlights they may access',async()=>{
 const state={interviewUsers:[leaderId],observationUsers:[leaderId,voterId],thoughts:[{id:'rec1',roundId,roundName:'Round 2',interviewer:'Avery Interviewer',text:'Submitted final thoughts.'}],resume:[{id:'ann1',documentId:'doc',page:1,quote:'Treasurer, 2025'}],
  observations:[{id:'obs1',revision:2,body:'Helped set up the fair without being asked.',interactionContext:'Club fair',author:'Sam Member',roundId,roundName:'Round 2'}]};
 const util=load('utils/voting-slide-preparation.ts',{'@/utils/voting-room-presentation':interviewMock(state),'@/utils/additional-observations':observationMock(state)});
 const profile={anonymous:false,sections:[{field:'major',items:['Economics']},{field:'gender',items:['PRIVATE']},{field:'pros',items:['LEGACY']},{field:'answers',items:['Why us? Because of the mentoring.','']}]};
 const tx={pipelineRound:{findFirst:async()=>({applicantDisplay:{}})},applicantObservation:{findMany:async()=>state.observations.filter(o=>!o.deletedAt).map(o=>({id:o.id}))}};
 const sources=await util.gatherSlideSources(tx,{clubId,applicationId:appId,roundId},leaderId,profile);
 assert.deepEqual(sources.map(s=>s.id),['profile:major:0','profile:answers:0','score:'+roundId,'thought:rec1','observation:obs1','resume:ann1']);
 assert.ok(!sources.some(s=>/PRIVATE|LEGACY/.test(s.text)));
 const obs=sources.find(s=>s.type==='OBSERVATION');assert.equal(obs.author,'Sam Member');assert.equal(obs.revision,2);assert.equal(obs.label,'Additional observation · Club fair');assert.equal(obs.version,hash(obs.text));
 assert.equal(sources.find(s=>s.type==='INTERVIEW_SCORE').text,'8.5 / 10 · 2 submitted evaluations');
 const stored=lib.buildSlideHighlights(sources.filter(s=>['thought:rec1','observation:obs1','profile:major:0'].includes(s.id)).map((s,i)=>({id:uuid(30+i),mode:'QUOTE',text:s.text,source:{type:s.type,id:s.id,version:s.version}})),sources,'Lee Leader');
 // Voter lacks interview-evidence access: thoughts withheld, profile and shared observation remain.
 assert.deepEqual((await util.viewerHighlightFilter(tx,{clubId,applicationId:appId,roundId},voterId,stored)).map(h=>h.source.type),['PROFILE','OBSERVATION']);
 assert.equal((await util.viewerHighlightFilter(tx,{clubId,applicationId:appId,roundId},leaderId,stored)).length,3);
 // A moderated removal hides the highlight even from a locked copy; an outsider sees no observation.
 state.observations[0].deletedAt=new Date();
 assert.deepEqual((await util.viewerHighlightFilter(tx,{clubId,applicationId:appId,roundId},leaderId,stored)).map(h=>h.source.type),['PROFILE','INTERVIEW_THOUGHT']);
 assert.deepEqual(await util.presentedSlideHighlights(tx,{id:sessionId,clubId,roundId,currentPass:0,passes:[]},appId,leaderId,true),{});
});

test('locks copy the saved preparation for each pass; later edits change the working copy but never the presented pass',async()=>{
 const state={interviewUsers:[leaderId],observationUsers:[leaderId],thoughts:[],resume:[],observations:[]};
 const util=load('utils/voting-slide-preparation.ts',{'@/utils/voting-room-presentation':interviewMock(state),'@/utils/additional-observations':observationMock(state)});
 const profile=src('PROFILE','profile:major:0','Economics');
 const one=lib.buildSlideHighlights([{id:uuid(40),mode:'QUOTE',text:'Economics',source:{type:'PROFILE',id:profile.id,version:profile.version}}],[profile],'Lee');
 let prep={sessionId,applicationId:appId,highlights:one,revision:1};const locks=[];
 const tx={pipelineRound:{findFirst:async()=>({applicantDisplay:{}})},votingSlidePreparation:{findMany:async()=>[prep],findUnique:async()=>prep},votingSlideLock:{createMany:async({data})=>{locks.push(...data);return{count:data.length}},findUnique:async({where})=>locks.find(l=>l.passNumber===where.sessionId_passNumber_applicationId.passNumber)??null}};
 await util.lockPreparedSlides(tx,sessionId,1,[appId,uuid(41)]);
 assert.equal(locks.length,1);assert.equal(locks[0].preparationRevision,1);
 const two=lib.buildSlideHighlights([{id:uuid(42),mode:'SUMMARY',text:'Changed after pass one.',source:{type:'PROFILE',id:profile.id,version:profile.version}}],[profile],'Lee');
 prep={...prep,highlights:two,revision:2};
 const room={id:sessionId,clubId,roundId,currentPass:1,passes:[{number:1,candidates:[{applicationId:appId}]}]};
 assert.equal((await util.presentedSlideHighlights(tx,room,appId,leaderId,false)).preparedHighlights[0].text,'Economics');
 assert.equal((await util.presentedSlideHighlights(tx,room,appId,leaderId,false,true)).preparedHighlights[0].text,'Changed after pass one.');
 await util.lockPreparedSlides(tx,sessionId,2,[appId]);room.currentPass=2;room.passes.push({number:2,candidates:[{applicationId:appId}]});
 assert.equal((await util.presentedSlideHighlights(tx,room,appId,leaderId,false)).preparedHighlights[0].mode,'SUMMARY');
 assert.equal(locks[0].highlights[0].text,'Economics');
 prep={...prep,highlights:[],revision:3};await util.lockPreparedSlides(tx,sessionId,3,[appId]);assert.equal(locks.length,2,'empty preparation creates no lock');
});

function actionHarness({leader=true,finalized=false,anonymous=false}={}){
 let actor=leaderId,display={};
 const state={interviewUsers:[leaderId],observationUsers:[leaderId],thoughts:[{id:'rec1',roundId,roundName:'Round 2',interviewer:'Avery Interviewer',text:'Submitted final thoughts.'}],resume:[],observations:[]};
 let row=null,receipts=[],audit=[],writes=0;const s={id:sessionId,clubId,roundId,cycleId,mode:'LIVE',revision:9,currentPass:0,finalizedAt:finalized?new Date():null,leaderMemberIds:[uuid(50)],presentationOptions:{},candidates:[{applicationId:appId,position:0}],passes:[]};
 const member={id:leader?uuid(50):uuid(51),clubId,status:'ACTIVE',permissions:['applications.review','applicants.identify','decisions.manage','decisions.start'],interviewOffices:[]};
 const tx={votingRoomCommand:{findUnique:async({where})=>receipts.find(r=>r.requestId===where.sessionId_requestId.requestId)??null,create:async({data})=>receipts.push(data)},
  votingSlidePreparation:{findUnique:async()=>row,findMany:async()=>row?[row]:[],create:async({data})=>{writes++;row={...data,revision:1,updatedAt:new Date()}},update:async({data})=>{writes++;row={...row,...data}}},
  pipelineRound:{findFirst:async()=>({applicantDisplay:display})},auditLog:{create:async({data})=>audit.push(data)},user:{findUnique:async()=>({studentProfile:{firstName:'Lee',lastName:'Leader'}})},application:{findMany:async()=>[{id:appId,student:{studentProfile:{firstName:'Jordan',lastName:'Avery'}}}]},applicantObservation:{findMany:async()=>[]}};
 const projection=load('lib/voting-room-projection.ts');
 const actions=load('actions/voting-slide-preparation.ts',{
  '@/utils/prisma':{prisma:{$transaction:async fn=>fn(tx)}},'@/utils/auth':{requireClubPermission:async()=>({user:{id:actor}})},
  '@/lib/club-transaction-authorization':{authorizeClubTransaction:async()=>member},'@/utils/club-write-transaction':{clubWriteTransaction:async fn=>fn(tx),votingWriteLimits:{}},
  '@/lib/voting-transaction-limits':{votingReadLimits:{}},'@/utils/voting-room':{loadVotingRoom:async()=>({s,round:{id:roundId,name:'Round 2',anonymousReview:anonymous},cycle:{}}),requireRoomLeader:projection.requireRoomLeader,roomFingerprint:v=>JSON.stringify(v)},
  '@/actions/applicant-intelligence':{getApplicantDisplay:async()=>({anonymous,sections:[{field:'major',items:['Economics']},{field:'answers',items:['Why us? The mentoring.']}]})},
  '@/utils/voting-room-presentation':interviewMock(state),'@/utils/additional-observations':observationMock(state),
 });
 return {actions,state,s,as:id=>{actor=id},setDisplay:v=>{display=v},get row(){return row},receipts,audit,get writes(){return writes}};
}

test('saving is leader-only, retry-safe, conflict-aware, audited without text, and never changes the voting room revision',async()=>{
 const h=actionHarness(),view=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});
 assert.equal(view.revision,0);assert.equal(view.gap,'No highlights selected');const thought=view.sources.find(s=>s.type==='INTERVIEW_THOUGHT');
 const input={clubId,sessionId,applicationId:appId,requestId:uuid(60),revision:0,highlights:[{id:uuid(61),mode:'QUOTE',text:'final thoughts',source:{type:thought.type,id:thought.id,version:thought.version}}]};
 const first=await h.actions.saveVotingSlidePreparation(input);assert.equal(first.ok,true);assert.equal(first.revision,1);assert.equal(first.highlights[0].status,'CURRENT');
 const retry=await h.actions.saveVotingSlidePreparation(input);assert.equal(retry.ok,true);assert.equal(h.writes,1,'lost-response retry does not write twice');
 await assert.rejects(h.actions.saveVotingSlidePreparation({...input,highlights:[]}),/already used/);
 const stale=await h.actions.saveVotingSlidePreparation({...input,requestId:uuid(62),highlights:[]});assert.equal(stale.ok,false);assert.equal(stale.code,'CONFLICT');assert.equal(h.row.highlights.length,1);
 const invalid=await h.actions.saveVotingSlidePreparation({...input,requestId:uuid(63),revision:1,highlights:[{...input.highlights[0],id:uuid(64),text:'invented praise'}]});assert.equal(invalid.ok,false);assert.match(invalid.message,/exactly/);
 assert.equal(h.s.revision,9);assert.equal(h.audit.length,1);assert.ok(!JSON.stringify(h.audit).includes('final thoughts'));
 // Source edited after saving: shown as an update for deliberate review, the saved copy is unchanged.
 h.state.thoughts[0].text='Submitted final thoughts, revised.';
 const after=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});assert.equal(after.highlights[0].status,'UPDATED');assert.equal(after.highlights[0].source.text,'Submitted final thoughts.');assert.equal(after.updates,1);
 // Refresh restores the saved preparation.
 const overview=await h.actions.getVotingSlidePreparation({clubId,sessionId});assert.equal(overview.applicants[0].highlightCount,1);assert.equal(overview.applicants[0].name,'Jordan Avery');
});

test('non-leaders, anonymous rounds and finalized sessions cannot read or change preparation',async()=>{
 await assert.rejects(actionHarness({leader:false}).actions.getVotingSlidePreparation({clubId,sessionId}),/leadership/);
 await assert.rejects(actionHarness({leader:false}).actions.saveVotingSlidePreparation({clubId,sessionId,applicationId:appId,requestId:uuid(70),revision:0,highlights:[]}),/leadership/);
 const anon=await actionHarness({anonymous:true}).actions.getVotingSlidePreparation({clubId,sessionId});assert.equal(anon.available,false);
 await assert.rejects(actionHarness({anonymous:true}).actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId}),/identified/);
 await assert.rejects(actionHarness({finalized:true}).actions.saveVotingSlidePreparation({clubId,sessionId,applicationId:appId,requestId:uuid(71),revision:0,highlights:[]}),/finalized/);
});

test('a co-leader who cannot view a source never receives its highlight text, and saving preserves it unchanged',async()=>{
 const h=actionHarness(),coLeader=uuid(52),view=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});
 const thought=view.sources.find(s=>s.type==='INTERVIEW_THOUGHT'),major=view.sources.find(s=>s.id==='profile:major:0');
 ok(await h.actions.saveVotingSlidePreparation({clubId,sessionId,applicationId:appId,requestId:uuid(90),revision:0,highlights:[{id:uuid(91),mode:'QUOTE',text:'final thoughts',source:{type:thought.type,id:thought.id,version:thought.version}}]}));
 // Co-leader B leads the session but has no interview-evidence access.
 h.as(coLeader);const seen=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});
 assert.equal(seen.highlights.length,0);assert.equal(seen.hiddenCount,1);assert.doesNotMatch(JSON.stringify(seen),/Submitted final thoughts|final thoughts/);
 const conflict=await h.actions.saveVotingSlidePreparation({clubId,sessionId,applicationId:appId,requestId:uuid(92),revision:0,highlights:[]});
 assert.equal(conflict.code,'CONFLICT');assert.doesNotMatch(JSON.stringify(conflict),/final thoughts/);
 const saved=await h.actions.saveVotingSlidePreparation({clubId,sessionId,applicationId:appId,requestId:uuid(93),revision:1,highlights:[{id:uuid(94),mode:'QUOTE',text:'Economics',source:{type:'PROFILE',id:major.id,version:major.version}}]});
 ok(saved);assert.doesNotMatch(JSON.stringify(saved),/final thoughts/);
 assert.deepEqual(h.row.highlights.map(x=>x.id),[uuid(94),uuid(91)],'hidden highlight kept unchanged');assert.equal(h.row.highlights[1].text,'final thoughts');
})
test('profile highlights follow the round applicant display configuration',async()=>{
 const h=actionHarness();let view=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});
 assert.ok(view.sources.some(s=>s.id==='profile:answers:0'));
 h.setDisplay({version:1,fields:['name','major']});view=await h.actions.getVotingSlidePreparationApplicant({clubId,sessionId,applicationId:appId});
 assert.deepEqual(view.sources.filter(s=>s.type==='PROFILE').map(s=>s.id),['profile:major:0']);
 const util=load('utils/voting-slide-preparation.ts',{'@/utils/voting-room-presentation':interviewMock(h.state),'@/utils/additional-observations':observationMock(h.state)});
 const answer=src('PROFILE','profile:answers:0','Why us? The mentoring.'),majorSrc=src('PROFILE','profile:major:0','Economics');
 const stored=lib.buildSlideHighlights([answer,majorSrc].map((x,i)=>({id:uuid(95+i),mode:'QUOTE',text:x.text,source:{type:x.type,id:x.id,version:x.version}})),[answer,majorSrc],'Lee');
 const tx={pipelineRound:{findFirst:async()=>({applicantDisplay:{version:1,fields:['name','major']}})}};
 assert.deepEqual((await util.viewerHighlightFilter(tx,{clubId,applicationId:appId,roundId},voterId,stored)).map(x=>x.source.id),['profile:major:0']);
});
