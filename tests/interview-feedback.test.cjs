// Interview feedback (leader review dialog + Voting room slide) against migrated PGlite SQL.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
const PRIVATE=/PRIVATE|DRAFT SECRET|questionNotes|additionalNotes|applicantQuestions/;

async function fixture(){
 const h=await harness(),{db,ids}=h,earlier=randomUUID(),late=randomUUID(),lateMember=randomUUID(),review=randomUUID();
 await db.query(`UPDATE "PipelineRound" SET type='INTERVIEW',name='Final interview',"order"=2 WHERE id=$1`,[ids.round]);
 await db.query(`INSERT INTO "PipelineRound"(id,"clubId",name,"order",type) VALUES ($1,$2,'First interview',1,'INTERVIEW'),($3,$2,'Application review',0,'APPLICATION_REVIEW')`,[earlier,ids.club,review]);
 await db.query(`INSERT INTO "User"(id,email) VALUES ($1,'late@virginia.edu')`,[late]);
 await db.query(`INSERT INTO "ClubMember"(id,"clubId","userId",permissions) VALUES ($1,$2,$3,'{applications.review,applicants.identify}')`,[lateMember,ids.club,late]);
 for(const [k,first,last] of [['panel','Avery','Panel'],['peer','Blake','Peer'],['owner','Casey','Owner']])
  await db.query(`INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES ($1,$2,$3,$4,$5,'Economics',2028)`,[randomUUID(),ids[k],first,last,`cid${k}`]);
 const assign=(memberId,roundId)=>db.query(`INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)`,[randomUUID(),ids.app,roundId,memberId,ids.owner]);
 for(const m of [ids.panelMember,ids.peerMember,lateMember])await assign(m,ids.round);
 await assign(ids.panelMember,earlier);
 /** A completed record + submitted evaluation, or (submitted:false) an unfinished draft. */
 const review_=async(memberId,roundId,score,thoughts,{submitted=true}={})=>{
  const evaluationId=randomUUID(),at=submitted?new Date():null;
  await db.query(`INSERT INTO "Evaluation"(id,"applicationId","interviewerId","roundId",round,score,notes,"applicantQuestions","submittedAt") VALUES ($1,$2,$3,$4,'Interview',$5,'PRIVATE MISC NOTES','PRIVATE APPLICANT QUESTIONS',$6)`,[evaluationId,ids.app,memberId,roundId,score,at]);
  await db.query(`INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","evaluationId","updatedAt") VALUES ($1,$2,$3,$4,'[]',$5,false,$6,$7,NOW())`,
   [randomUUID(),ids.app,memberId,roundId,JSON.stringify({questionNotes:[{questionId:ids.question,notes:'PRIVATE QUESTION NOTE'}],additionalQuestions:[],additionalNotes:'PRIVATE ADDITIONAL',applicantQuestions:'PRIVATE ASKED',finalInterviewThoughts:submitted?thoughts:'DRAFT SECRET'}),at,evaluationId]);
 };
 const api=h.load('actions/interview-feedback.ts'),presentation=h.load('utils/voting-room-presentation.ts');
 const read=(input={})=>api.getInterviewFeedback({clubId:ids.club,applicationId:ids.app,...input});
 const voting=(fields,roundId=ids.round)=>h.prisma.$transaction(tx=>presentation.votingSelectedEvidence(tx,ids.club,ids.app,h.ids.owner,fields,false,roundId));
 return {h,ids,earlier,review,lateMember,late,review_,read,voting};
}

test('two interviewers: names, finalized summaries and separate scores for the labelled current round; pending counted without content',async()=>{
 const f=await fixture();
 await f.review_(f.ids.panelMember,f.earlier,3,'EARLIER ROUND THOUGHT');
 await f.review_(f.ids.panelMember,f.ids.round,8,'Avery final summary.');
 await f.review_(f.ids.peerMember,f.ids.round,6.5,'Blake final summary.');
 await f.review_(f.lateMember,f.ids.round,2,'unused',{submitted:false});
 const result=await f.read();
 assert.equal(result.status,'ready');
 const fb=result.feedback;
 assert.equal(fb.roundId,f.ids.round);assert.equal(fb.roundName,'Final interview');
 assert.deepEqual(fb.entries.map(e=>[e.interviewer,e.score,e.summary]),[['Avery Panel',8,'Avery final summary.'],['Blake Peer',6.5,'Blake final summary.']]);
 assert.equal(fb.pending,1,'assigned-but-incomplete review is counted');assert.equal(fb.scoresIncluded,true);
 assert.deepEqual(fb.earlierRounds,[{roundId:f.earlier,roundName:'First interview',submitted:1}]);
 const json=JSON.stringify(result);
 assert.doesNotMatch(json,PRIVATE);assert.doesNotMatch(json,/EARLIER ROUND THOUGHT/,'earlier-round evaluation never appears in the section');
 assert.ok(!json.includes(f.lateMember),'pending interviewer is not identified');
 // The earlier round is readable only as its own labelled section.
 const old=await f.read({roundId:f.earlier});
 assert.equal(old.feedback.roundName,'First interview');assert.deepEqual(old.feedback.entries.map(e=>[e.interviewer,e.score,e.summary]),[['Avery Panel',3,'EARLIER ROUND THOUGHT']]);assert.deepEqual(old.feedback.earlierRounds,[]);
 assert.doesNotMatch(JSON.stringify(old),/Avery final|Blake/);
 // A panelist who submitted their own review reads the same section; one who has not, reads nothing.
 f.h.as(f.ids.panel);assert.equal((await f.read()).feedback.entries.length,2);
 f.h.as(f.late);assert.deepEqual(await f.read(),{status:'unavailable'});
});

test('no submitted reviews: neutral empty state labelled with the round; earlier submissions stay separate references',async()=>{
 const f=await fixture();
 let result=await f.read();
 assert.equal(result.status,'ready');assert.equal(result.feedback.roundName,'Final interview');assert.deepEqual(result.feedback.entries,[]);assert.equal(result.feedback.pending,3);
 await f.review_(f.ids.panelMember,f.earlier,9,'EARLIER ROUND THOUGHT');
 result=await f.read();
 assert.equal(result.feedback.roundId,f.ids.round,'current authorized round is kept even when only an earlier round has submissions');
 assert.deepEqual(result.feedback.entries,[]);assert.deepEqual(result.feedback.earlierRounds,[{roundId:f.earlier,roundName:'First interview',submitted:1}]);
 assert.doesNotMatch(JSON.stringify(result),/EARLIER ROUND THOUGHT|Avery/);
 const {interviewFeedbackEmpty,interviewFeedbackPending}=f.h.load('lib/interview-feedback.ts');
 assert.equal(interviewFeedbackEmpty('Final interview'),'No interview feedback has been submitted for Final interview yet.');assert.equal(interviewFeedbackPending(1),'1 review not yet submitted');
});

test('unauthorized and anonymous viewers receive no feedback and nothing identifying',async()=>{
 const f=await fixture();
 await f.review_(f.ids.panelMember,f.ids.round,8,'Avery final summary.');
 f.h.as(f.ids.scheduler);assert.deepEqual(await f.read(),{status:'unavailable'});
 f.h.as(f.ids.student);assert.deepEqual(await f.read(),{status:'unavailable'},'applicant never sees their own interview feedback');
 f.h.as(f.ids.owner);
 await assert.rejects(f.read({applicationId:'not-a-uuid'}),/uuid|Invalid/i);
 await f.h.db.query(`UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1`,[f.ids.round]);
 const anonymous=await f.read();assert.deepEqual(anonymous,{status:'unavailable'});assert.doesNotMatch(JSON.stringify(anonymous),/Avery|Final interview/);
 assert.deepEqual(await f.voting(['interviewScore','finalInterviewThoughts']),{});
});

test('Voting slide: section requires finalInterviewThoughts, scores require interviewScore; thoughts field keeps only other rounds',async()=>{
 const f=await fixture();
 await f.review_(f.ids.panelMember,f.earlier,3,'EARLIER ROUND THOUGHT');
 await f.review_(f.ids.panelMember,f.ids.round,8,'Avery final summary.');
 await f.review_(f.ids.peerMember,f.ids.round,6.5,'Blake final summary.');
 let r=await f.voting(['finalInterviewThoughts']);
 assert.equal('interviewScore'in r,false);assert.equal(r.interviewFeedback.roundName,'Final interview');assert.equal(r.interviewFeedback.scoresIncluded,false);
 assert.deepEqual(r.interviewFeedback.entries.map(e=>[e.interviewer,e.score]),[['Avery Panel',null],['Blake Peer',null]],'deselected scores are omitted');
 assert.deepEqual(r.finalInterviewThoughts.map(t=>[t.roundName,t.text]),[['First interview','EARLIER ROUND THOUGHT']]);
 assert.doesNotMatch(JSON.stringify(r.interviewFeedback),/EARLIER ROUND THOUGHT/);assert.doesNotMatch(JSON.stringify(r),PRIVATE);
 r=await f.voting(['interviewScore','finalInterviewThoughts']);
 assert.deepEqual(r.interviewFeedback.entries.map(e=>e.score),[8,6.5]);assert.equal(r.interviewScore.submitted,3);
 r=await f.voting(['interviewScore']);assert.equal('interviewFeedback'in r,false);assert.equal('finalInterviewThoughts'in r,false);
 // A later non-interview voting round uses the latest authorized interview round with submissions.
 r=await f.voting(['finalInterviewThoughts'],f.review);assert.equal(r.interviewFeedback.roundId,f.ids.round);
});
test('leader dialog: a submitted panelist sees finalized summaries but not peer scores; leaders see scores; non-members get unavailable without throwing',async()=>{
 const {h,ids,review_,read}=await fixture();try{
  await review_(ids.panelMember,ids.round,9,'Panel summary');await review_(ids.peerMember,ids.round,6.5,'Peer summary');
  h.as(ids.panel);const own=await read();assert.equal(own.status,'ready');assert.equal(own.feedback.scoresIncluded,false);
  assert.ok(own.feedback.entries.every(e=>e.score===null));assert.ok(own.feedback.entries.some(e=>e.summary==='Peer summary'));assert.doesNotMatch(JSON.stringify(own),/6\.5|"score":9/);
  h.as(ids.owner);const leader=await read();assert.equal(leader.feedback.scoresIncluded,true);assert.deepEqual(leader.feedback.entries.map(e=>e.score).sort(),[6.5,9]);
  const stranger=randomUUID();await h.db.query(`INSERT INTO "User"(id,email) VALUES ($1,'stranger@virginia.edu')`,[stranger]);
  h.as(stranger);assert.deepEqual(await read(),{status:'unavailable'});
 }finally{await h.db.close();}
});
test('Voting slide: a submitted non-leader panelist sees summaries and the aggregate, never individual peer scores',async()=>{
 const {h,ids,review_}=await fixture();try{
  await review_(ids.panelMember,ids.round,9,'Panel summary');await review_(ids.peerMember,ids.round,6.5,'Peer summary');
  const presentation=h.load('utils/voting-room-presentation.ts');
  const as=user=>h.prisma.$transaction(tx=>presentation.votingSelectedEvidence(tx,ids.club,ids.app,user,['interviewScore','finalInterviewThoughts'],false,ids.round));
  const panel=await as(ids.panel);assert.equal(panel.interviewFeedback.scoresIncluded,false);assert.ok(panel.interviewFeedback.entries.every(e=>e.score===null));assert.ok(panel.interviewFeedback.entries.some(e=>e.summary==='Peer summary'));
  assert.equal(panel.interviewScore.submitted,2,'the existing aggregate stays available');
  const leader=await as(ids.owner);assert.equal(leader.interviewFeedback.scoresIncluded,true);assert.deepEqual(leader.interviewFeedback.entries.map(e=>e.score).sort(),[6.5,9]);
 }finally{await h.db.close();}
});
