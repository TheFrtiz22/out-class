const {test}=require('node:test'),assert=require('node:assert/strict');const {harness}=require('./helpers/demo-harness.cjs');
test('new demo foundation persists isolated grants, pinned documents, annotations and immutable reviews without live calls',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview'),member=s.memberships.find(m=>m.clubId===club.id&&m.isOwner);
 const app=s.applications.find(a=>a.clubId===club.id&&a.roundId===round.id&&a.studentId!==member.userId&&!s.interviews.some(r=>r.applicationId===a.id));const scope={clubId:club.id,applicationId:app.id,roundId:round.id};
 await api.setInterviewPanelAssignment({...scope,memberId:member.id,assigned:true});const session=await api.openInterviewSession(scope);
 const doc=await api.pinInterviewResume(scope);const annotation={...scope,documentId:doc.id,id:crypto.randomUUID(),content:{kind:'GENERAL_NOTE',anchor:null,comment:'Local only'}};
 assert.equal((await api.getInterviewResumeModerationQueue(club.id))[0].documentId,doc.id);
 await assert.rejects(api.saveInterviewResumeAnnotation({...annotation,id:crypto.randomUUID(),content:{kind:'TEXT_HIGHLIGHT',comment:'Invented',anchor:{page:1,start:0,end:4,quote:'fake'}}}),/match/);
 await api.saveInterviewResumeAnnotation(annotation);assert.equal((await api.getInterviewResumeAnnotations({...scope,documentId:doc.id})).annotations[0].comment,'Local only');
 const done=await api.saveInterviewSession({...scope,revision:session.revision,draft:{...session.draft,score:8.5,additionalNotes:'Closing',completedQuestionIds:[session.questions[0].id]},complete:true});assert.equal(done.evaluation.score,8.5);
 await assert.rejects(api.submitEvaluation({...scope,roundName:round.name,score:9}),/immutable/);
 const review=await api.getSubmittedInterviewReview({...scope,interviewerId:member.id});assert.equal(review.readOnly,true);assert.equal(review.additionalNotes,'Closing');assert.equal('questionNotes'in review,false);
 await api.setInterviewPanelAssignment({...scope,memberId:member.id,assigned:false});await api.setMemberInterviewOffices({clubId:club.id,memberId:member.id,offices:[]});await assert.rejects(api.getInterviewResumeAnnotations({...scope,documentId:doc.id}),/panel/);
 assert.equal(h.calls(),0);demoStore.stop();
});

test('demo previous-five excludes current, other reviewers, other rounds, drafts and revoked assignments with deterministic ties',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();
 const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview'),member=s.memberships.find(m=>m.clubId===club.id&&m.isOwner),app=s.applications.find(a=>a.clubId===club.id&&a.roundId===round.id&&a.studentId!==member.userId);
 const scope={clubId:club.id,applicationId:app.id,roundId:round.id};
 demoStore.mutate(s=>{
  s.perspective={role:'leader',clubId:club.id};s.interviews=[];
  for(let i=0;i<8;i++){
   const a=structuredClone(app);a.id=`history-app-${i}`;a.evaluations=[{id:`history-eval-${i}`,applicationId:a.id,interviewerId:member.id,roundId:round.id,round:round.name,score:5+i*.5,notes:'Private closing',applicantQuestions:'Private question',submittedAt:new Date('2026-10-01'),createdAt:new Date('2026-10-01')}];s.applications.push(a);
   s.interviewFoundation.assignments.push({applicationId:a.id,roundId:round.id,memberId:member.id,revokedAt:i===7?'2026-10-02':null});
   s.interviews.push({id:`record-${i}`,applicationId:a.id,clubId:club.id,roundId:round.id,interviewerId:member.id,anonymousReview:false,completedAt:i===6?null:'2026-10-01T00:00:00.000Z',revision:1,questions:[],draft:{questionNotes:[],additionalQuestions:[],overallReview:'SECRET',score:5+i*.5}});
  }
  s.interviews.push({...s.interviews[0],id:'other-round',roundId:club.rounds[0].id});
  s.interviews.push({...s.interviews[0],id:'other-reviewer',interviewerId:'other'});
  s.interviews.push({...s.interviews[0],id:'current',applicationId:app.id});
 });
 const rows=await api.getPreviousInterviewScores(scope);assert.deepEqual(rows.map(r=>r.id),['record-5','record-4','record-3','record-2','record-1']);assert.doesNotMatch(JSON.stringify(rows),/SECRET|Private closing|Private question/);assert.equal(h.calls(),0);demoStore.stop();
});
