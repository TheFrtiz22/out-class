const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,id}=require('./helpers/interview-harness.cjs');

test('authorized bank keys persist and snapshot; ordinary panel can read but cannot edit; revoked and cross-club reads fail',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');
 await api.saveInterviewKit(h.scope.clubId,h.scope.roundId,0,[{id:id(4),prompt:'Original',guidance:'Expected explanation'}]);
 h.as(11);assert.equal((await api.getInterviewKit(h.scope.clubId,h.scope.roundId)).questions[0].guidance,'Expected explanation');
 const opened=await api.openInterviewSession(h.scope);
 await assert.rejects(api.saveInterviewKit(h.scope.clubId,h.scope.roundId,1,[{id:id(4),prompt:'Original',guidance:'Forged'}]),/denied/);
 h.as(10);await api.saveInterviewKit(h.scope.clubId,h.scope.roundId,1,[{id:id(4),prompt:'Edited',guidance:'New reference'}]);
 h.as(11);assert.deepEqual((await api.openInterviewSession(h.scope)).questions,opened.questions);
 await assert.rejects(api.getInterviewKit(id(8),h.scope.roundId));h.assignments[1].revokedAt=new Date();await assert.rejects(api.getInterviewKit(h.scope.clubId,h.scope.roundId),/denied/);
});

test('newly selected bank keys are authenticated snapshots, immutable after kit changes; off-script never inherits a key',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');h.as(11);const opened=await api.openInterviewSession(h.scope);
 h.as(10);const question={id:id(5),prompt:'Added later',guidance:'Club-authored reference'};await api.saveInterviewKit(h.scope.clubId,h.scope.roundId,0,[...h.round.interviewKit,question]);
 h.as(11);const added={id:id(5),question:question.prompt,notes:'Private',bankQuestion:{guidance:question.guidance}};
 const draft={...opened.draft,additionalQuestions:[added,{id:id(6),question:'My follow-up',notes:''}]};
 for(const guidance of ['Forged'])await assert.rejects(api.saveInterviewSession({...h.scope,revision:0,draft:{...draft,additionalQuestions:[{...added,bankQuestion:{guidance}}]}}),/bank changed/);
 const saved=await api.saveInterviewSession({...h.scope,revision:0,draft});
 h.as(10);await api.saveInterviewKit(h.scope.clubId,h.scope.roundId,1,[{...question,guidance:'Revised bank'}]);
 h.as(11);const reloaded=await api.openInterviewSession(h.scope);assert.equal(reloaded.draft.additionalQuestions[0].bankQuestion.guidance,question.guidance);assert.equal(reloaded.draft.additionalQuestions[1].bankQuestion,undefined);
 await api.saveInterviewSession({...h.scope,revision:saved.session.revision,draft:reloaded.draft});
 await assert.rejects(api.saveInterviewSession({...h.scope,revision:2,draft:{...reloaded.draft,additionalQuestions:[{...added,bankQuestion:{guidance:'Revised bank'}},draft.additionalQuestions[1]]}}),/snapshots/);
});

test('keys are optional for legacy questions and absent from leadership closing projections',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');h.round.interviewKit=[{id:id(4),prompt:'Legacy'}];
 const opened=await api.openInterviewSession(h.scope);assert.equal(opened.questions[0].guidance,'');
 await api.saveInterviewSession({...h.scope,revision:0,draft:{...opened.draft,score:7.5},complete:true});
 const closing=await api.getSubmittedInterviewReview({...h.scope,interviewerId:id(20)});
 assert.doesNotMatch(JSON.stringify(closing),/guidance|questions|bankQuestion|Legacy/);
});
