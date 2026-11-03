const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/interview-harness.cjs');
const words=n=>Array.from({length:n},(_,i)=>`word${i}`).join(' ');

test('shared counting treats whitespace and line breaks consistently, with optional zero and exact 50-word boundary',()=>{
 const api=harness().load('lib/interview-final-thoughts.ts');
 for(const n of [0,49,50,51]){
  const text=' \t'+words(n).split(' ').join('\n\t\u00a0')+'\r\n';
  assert.equal(api.interviewThoughtWordCount(text),n);
  if(n>50)assert.throws(()=>api.validateFinalInterviewThoughts(text),/50 words/);
  else assert.doesNotThrow(()=>api.validateFinalInterviewThoughts(text));
 }
 assert.equal(api.interviewThoughtWordCount('One, two! three—four.'),3);
});

test('real adapter autosaves over-limit thoughts separately, blocks completion, preserves legacy questions and immutable retry',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');let record=await api.openInterviewSession(h.scope);
 const draft={...record.draft,score:9.5,applicantQuestions:'Legacy questions stay separate',finalInterviewThoughts:words(51)};
 record=(await api.saveInterviewSession({...h.scope,revision:0,draft})).session;
 assert.equal(record.draft.finalInterviewThoughts,draft.finalInterviewThoughts);
 await assert.rejects(api.saveInterviewSession({...h.scope,revision:1,draft,complete:true}),/50 words/);
 assert.equal(h.state.evaluations.length,0);assert.equal(h.state.records[0].completedAt,null);
 await assert.rejects(api.getSubmittedInterviewReview({...h.scope,interviewerId:h.members[0].id}),/unavailable/i);
 const final={...draft,finalInterviewThoughts:words(50)};
 const done=await api.saveInterviewSession({...h.scope,revision:1,draft:final,complete:true});
 assert.ok(done.session.completedAt);assert.equal(done.evaluation.applicantQuestions,draft.applicantQuestions);
 const review=await api.getSubmittedInterviewReview({...h.scope,interviewerId:h.members[0].id});
 assert.equal(review.finalInterviewThoughts,final.finalInterviewThoughts);assert.equal(review.applicantQuestions,draft.applicantQuestions);assert.equal('draft' in review,false);
 await api.saveInterviewSession({...h.scope,revision:1,draft:final,complete:true});assert.equal(h.state.evaluations.length,1);
 await assert.rejects(api.saveInterviewSession({...h.scope,revision:2,draft:{...final,finalInterviewThoughts:'Rewrite'},complete:true}),/completed/);
 h.round.anonymousReview=true;assert.equal((await api.getSubmittedInterviewReview({...h.scope,interviewerId:h.members[0].id})).finalInterviewThoughts,'');
 h.as(11);await assert.rejects(api.getSubmittedInterviewReview({...h.scope,interviewerId:h.members[0].id}),/Leadership|privacy/);
});

test('Demo retains over-limit drafts on refresh and applies the same submission boundary without live writes',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();
 try{
  demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
  const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview'),member=s.memberships.find(m=>m.clubId===club.id&&m.isOwner);
  const app=s.applications.find(a=>a.clubId===club.id&&a.roundId===round.id&&a.studentId!==member.userId&&!s.interviews.some(r=>r.applicationId===a.id));
  const scope={clubId:club.id,applicationId:app.id,roundId:round.id};await api.setInterviewPanelAssignment({...scope,memberId:member.id,assigned:true});
  let record=await api.openInterviewSession(scope);const draft={...record.draft,score:8.5,applicantQuestions:'Historical only',finalInterviewThoughts:words(51)};
  await api.saveInterviewSession({...scope,revision:record.revision,draft});demoStore.refresh();record=await api.openInterviewSession(scope);
  assert.equal(record.draft.finalInterviewThoughts,draft.finalInterviewThoughts);
  await assert.rejects(api.saveInterviewSession({...scope,revision:record.revision,draft,complete:true}),/50 words/);
  const done=await api.saveInterviewSession({...scope,revision:record.revision,draft:{...draft,finalInterviewThoughts:words(49)},complete:true});
  assert.ok(done.session.completedAt);const review=await api.getSubmittedInterviewReview({...scope,interviewerId:member.id});assert.equal(review.finalInterviewThoughts,words(49));assert.equal(review.applicantQuestions,'Historical only');assert.equal(h.calls(),0);
 }finally{demoStore.stop()}
});
