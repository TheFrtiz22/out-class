// Round-scoped interview evidence across one recruitment cycle: application review (no interviews),
// Interview 1 and Interview 2, against migrated PGlite SQL. Assertions are on the serialized server
// result (what getLiveVotingPresentation / getInterviewFeedback send to the browser), not the DOM.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture,seedInterviews}=require('./helpers/round-scoped-fixture.cjs');
const RESTRICTED=/R1 AVERY|R1 LATE|DRAFT SECRET|PRIVATE|questionNotes|additionalNotes|applicantQuestions/;

test('application-review round: voting evidence says there are no interview scores; never zero, never another round',async()=>{
 const f=await fixture();try{
  const r=await f.voting(f.ids.owner,f.review);
  assert.deepEqual(r.interviewScore.current,{roundId:f.review,roundName:'Application review',status:'none',average:null,submitted:0});
  assert.equal(r.interviewScore.average,null);assert.equal(r.interviewScore.submitted,0);assert.deepEqual(r.interviewScore.byRound,[]);
  assert.equal('interviewFeedback'in r,false);assert.deepEqual(r.earlierInterviewRounds,[]);
  assert.doesNotMatch(JSON.stringify(r),/"average":0|"score":0/);
  const {NO_INTERVIEW_SCORES}=f.h.load('lib/interview-feedback.ts');assert.equal(NO_INTERVIEW_SCORES,'No interview scores for this round.');
 }finally{await f.db.close()}
});

test('Interview 2: the current average and ranking use Interview 2 only; Interview 1 is a labelled earlier group with names and sources',async()=>{
 const f=await fixture();try{
  await seedInterviews(f);
  const r=await f.voting(f.ids.owner,f.r2);
  assert.equal(r.interviewScore.average,8,'(9+7)/2: Interview 1 never included');assert.equal(r.interviewScore.submitted,2);
  assert.deepEqual(r.interviewScore.current,{roundId:f.r2,roundName:'Interview 2',status:'scored',average:8,submitted:2});
  assert.deepEqual(r.interviewScore.byRound.map(b=>b.roundId),[f.r2]);
  assert.deepEqual(r.interviewFeedback.entries.map(e=>[e.interviewer,e.score,e.summary]),[['Avery Panel',9,'R2 Avery summary.'],['Blake Peer',7,'R2 Blake summary.']]);
  assert.equal(r.interviewFeedback.pending,1,'an unsubmitted assignee is a count only; their draft is never shown');
  assert.deepEqual(r.earlierInterviewRounds.map(g=>[g.roundId,g.roundName,g.average,g.submitted,g.entries.map(e=>[e.interviewer,e.score,e.summary,e.source])]),
   [[f.r1,'Interview 1',7,2,[['Avery Panel',8,'R1 AVERY summary.','kit'],['Lee Late',6,null,'evaluation']]]]);
  assert.doesNotMatch(JSON.stringify(r),/DRAFT SECRET|PRIVATE/);
  // The ranked list ranks by the pipeline projection's roundScore: Interview 2 only.
  const {applicationReviewVisibility}=f.h.load('lib/application-review-visibility.ts'),{rankApplicants}=f.h.load('lib/ranked-review.ts');
  const evaluations=(await f.db.query(`SELECT "interviewerId","roundId","submittedAt",score FROM "Evaluation" WHERE "applicationId"=$1`,[f.ids.app])).rows;
  const assignments=(await f.db.query(`SELECT a."memberId",a."roundId",row_to_json(m.*) AS member FROM "InterviewPanelAssignment" a JOIN "ClubMember" m ON m.id=a."memberId" WHERE a."applicationId"=$1`,[f.ids.app])).rows;
  const owner=(await f.db.query(`SELECT * FROM "ClubMember" WHERE id=$1`,[f.ids.ownerMember])).rows[0];
  const {roundScore}=applicationReviewVisibility({studentId:f.ids.student,roundId:f.r2,evaluations,interviewAssignments:assignments},owner);
  assert.equal(roundScore.average,8);assert.equal(roundScore.submitted,2);
  const {ranked}=rankApplicants([{id:'a',average:roundScore.average,submitted:roundScore.submitted,visible:true},{id:'b',average:7.5,submitted:2,visible:true}]);
  assert.deepEqual(ranked.map(x=>[x.id,x.rank]),[['a',1],['b',2]],'Interview 1 average (7) would have ranked it second');
  // The leader review dialog shows the same earlier group for authorized reviewers.
  const d=await f.dialog(f.ids.owner);
  assert.equal(d.feedback.roundId,f.r2);assert.equal(d.feedback.average,8);
  assert.deepEqual(d.feedback.earlierRounds.map(g=>[g.roundName,g.average,g.entries.map(e=>[e.interviewer,e.source])]),[['Interview 1',7,[['Avery Panel','kit'],['Lee Late','evaluation']]]]);
 }finally{await f.db.close()}
});

test('restricted reviewers never receive earlier-round evidence, individual peer scores or drafts in the serialized response',async()=>{
 const f=await fixture();try{
  await seedInterviews(f);
  // No applicants.identify (and no panel): nothing but the fact that this round's score is not available.
  let r=await f.voting(f.ids.scheduler,f.r2);
  assert.equal(r.interviewScore.current.status,'withheld');assert.equal(r.interviewScore.average,null);assert.deepEqual(r.earlierInterviewRounds,[]);assert.equal('interviewFeedback'in r,false);
  assert.doesNotMatch(JSON.stringify(r),/Avery|Blake|Lee|R1|R2|DRAFT|"score"/);
  assert.deepEqual(await f.dialog(f.ids.scheduler),{status:'unavailable'});
  // Interview 2 panelist without leadership review access who was not on Interview 1's panel.
  r=await f.voting(f.ids.peer,f.r2);
  assert.equal(r.interviewScore.average,8,'aggregate for the current round stays available');
  assert.ok(r.interviewFeedback.entries.every(e=>e.score===null),'no individual peer scores');
  assert.deepEqual(r.earlierInterviewRounds,[],'no earlier-round access');
  assert.doesNotMatch(JSON.stringify(r),RESTRICTED);
  const peerDialog=await f.dialog(f.ids.peer);assert.deepEqual(peerDialog.feedback.earlierRounds,[]);assert.doesNotMatch(JSON.stringify(peerDialog),RESTRICTED);
  // Interview 2 assignee who has not submitted: nothing from Interview 2 (not even their own draft); Interview 1, where they submitted, stays its own group.
  r=await f.voting(f.late,f.r2);
  assert.equal(r.interviewScore.current.status,'withheld');assert.equal('interviewFeedback'in r,false);assert.doesNotMatch(JSON.stringify(r),/R2|DRAFT SECRET|Blake|"score":[1-9]/);
  assert.deepEqual(r.earlierInterviewRounds.map(g=>g.roundName),['Interview 1']);
  // On both panels (submitted both) but not leadership: earlier summaries with attribution, never individual scores.
  r=await f.voting(f.ids.panel,f.r2);
  assert.deepEqual(r.earlierInterviewRounds.map(g=>[g.roundName,g.average,g.entries.map(e=>[e.interviewer,e.score,e.summary])]),[['Interview 1',7,[['Avery Panel',null,'R1 AVERY summary.'],['Lee Late',null,null]]]]);
  assert.doesNotMatch(JSON.stringify(r),/DRAFT SECRET|PRIVATE/);
  // Deselected fields: nothing from either round.
  r=await f.voting(f.ids.owner,f.r2,['name']);assert.deepEqual(r,{});
 }finally{await f.db.close()}
});

test('anonymous rounds hide identity in both the current-round and earlier-round views',async()=>{
 const f=await fixture();try{
  await seedInterviews(f);
  await f.db.query(`UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1`,[f.r1]);
  let r=await f.voting(f.ids.owner,f.r2);
  assert.deepEqual(r.earlierInterviewRounds,[],'an anonymous earlier round is never listed');assert.doesNotMatch(JSON.stringify(r),/R1 AVERY|Lee Late/);
  assert.equal(r.interviewScore.average,8);
  assert.deepEqual((await f.dialog(f.ids.owner)).feedback.earlierRounds,[]);
  await f.db.query(`UPDATE "PipelineRound" SET "anonymousReview"=false WHERE id=$1`,[f.r1]);
  await f.db.query(`UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1`,[f.r2]);
  // Even if a caller passed the wrong display flag, an anonymous voting round returns no interview evidence at all.
  r=await f.voting(f.ids.owner,f.r2);assert.deepEqual(r,{});
  assert.deepEqual(await f.dialog(f.ids.owner),{status:'unavailable'});
 }finally{await f.db.close()}
});

test('isolation: another club and another cycle in the same club leak nothing',async()=>{
 const f=await fixture();try{
  await seedInterviews(f);
  const {db,ids}=f,club2=randomUUID(),round2=randomUUID(),member2=randomUUID(),app2=randomUUID(),student2=randomUUID(),appB=randomUUID(),studentB=randomUUID();
  await db.query(`INSERT INTO "User"(id,email) VALUES ($1,'s2@virginia.edu'),($2,'sb@virginia.edu')`,[student2,studentB]);
  await db.query(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ($1,'other-club','Other','','','','')`,[club2]);
  await db.query(`INSERT INTO "PipelineRound"(id,"clubId",name,"order",type) VALUES ($1,$2,'Other interview',1,'INTERVIEW')`,[round2,club2]);
  await db.query(`INSERT INTO "ClubMember"(id,"clubId","userId",permissions) VALUES ($1,$2,$3,'{applications.review,applicants.identify}')`,[member2,club2,ids.panel]);
  await db.query(`INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES ($1,$2,$3,$4,'INTERVIEWING')`,[app2,club2,student2,round2]);
  await f.review_(member2,round2,10,'OTHER CLUB summary.',{app:app2});
  // Same club, Spring cycle: a different application in Interview 1.
  await db.query(`INSERT INTO "Application"(id,"clubId","studentId","roundId",status,"recruitmentCycleId") VALUES ($1,$2,$3,$4,'INTERVIEWING',$5)`,[appB,ids.club,studentB,f.r1,f.cycleB]);
  await f.assign(ids.panelMember,f.r1,appB);await f.review_(ids.panelMember,f.r1,2,'OTHER CYCLE summary.',{app:appB});
  const r=await f.voting(f.ids.owner,f.r2);
  assert.equal(r.interviewScore.average,8);assert.equal(r.earlierInterviewRounds[0].average,7);
  assert.doesNotMatch(JSON.stringify(r),/OTHER CLUB|OTHER CYCLE|"score":10|"score":2\b/);
  assert.doesNotMatch(JSON.stringify(await f.dialog(f.ids.owner)),/OTHER CLUB|OTHER CYCLE/);
  // Another club's application addressed through this club: nothing.
  const cross=await f.voting(f.ids.owner,f.r2,['interviewScore','finalInterviewThoughts'],app2);
  assert.doesNotMatch(JSON.stringify(cross),/OTHER CLUB|"score"/);assert.notEqual(cross.interviewScore?.current?.status,'scored');
  // Discussion bands are stored per cycle inside the round: one cycle's bands never apply to another.
  const {withRankedScope,rankedScopeSetting,bandsFromBoundaries}=f.h.load('lib/ranked-review.ts');
  const config=withRankedScope({},f.cycleA,bandsFromBoundaries(1,2),1);
  assert.deepEqual(rankedScopeSetting(config,f.cycleB),{bands:null,revision:0});assert.equal(rankedScopeSetting(config,f.cycleA).revision,1);
 }finally{await f.db.close()}
});
