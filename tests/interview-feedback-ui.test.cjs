// Interview feedback rendering (shared section) and the Demo Mode leader read.
const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {loadComponent}=require('./helpers/component-module.cjs');
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();
const long='The applicant explained their reasoning clearly and considered alternative evidence before reaching a conclusion, then described a collaboration example with real nuance.';
const feedback={roundId:'r2',roundName:'Final interview',pending:1,scoresIncluded:true,average:7.25,scored:2,earlierRounds:[{roundId:'r1',roundName:'First interview',submitted:2,average:6.5,entries:[{id:'e1',interviewer:'Casey Earlier',summary:'Earlier round summary.',score:7,source:'kit'},{id:'e2',interviewer:'Drew Earlier',summary:null,score:6,source:'evaluation'}]}],
 entries:[{id:'a',interviewer:'Avery Panel',summary:long,score:8.5},{id:'b',interviewer:'Blake Peer',summary:null,score:6}]};

test('section lists each interviewer with their own score and finalized summary, labels the round and counts pending neutrally',()=>{
 const {InterviewFeedbackSection,EarlierFeedbackRounds}=loadComponent('components/interview-feedback-section.tsx');
 const full=text(renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(InterviewFeedbackSection,{feedback}),React.createElement(EarlierFeedbackRounds,{feedback}))));
 assert.match(full,/Interview feedback · Final interview/);
 assert.match(full,/Avery Panel ?8\.5 \/ 10/);assert.match(full,/Average interview score · 7\.3 \/ 10 · 2 scored evaluations/);assert.ok(full.includes(long),'full text outside compact mode');
 assert.match(full,/Blake Peer ?6 \/ 10 ?No written summary submitted\./);
 assert.match(full,/1 review not yet submitted/);assert.doesNotMatch(full,/Read full/);
 // Earlier rounds: their own labelled group, with round, interviewer attribution and source; never in the current average.
 assert.match(full,/Earlier rounds First interview · 6\.5 \/ 10 · 2 scored evaluations/);
 assert.match(full,/Casey Earlier · First interview · Interview kit ?7 \/ 10 ?Earlier round summary\./);assert.match(full,/Drew Earlier · First interview · Evaluation ?6 \/ 10/);
 assert.ok(full.indexOf('Earlier rounds')>full.indexOf('Average interview score · 7.3'),'current round first');
 // Compact slide preview truncates per interviewer and offers the accessible details dialog.
 const compact=renderToStaticMarkup(React.createElement(InterviewFeedbackSection,{feedback,compact:true,onReadFull(){}}));
 assert.ok(!text(compact).includes(long));assert.match(text(compact),/…/);assert.match(compact,/<button[^>]*>Read full interview feedback<\/button>/);
 // Deselected scores never render.
 assert.doesNotMatch(text(renderToStaticMarkup(React.createElement(InterviewFeedbackSection,{feedback:{...feedback,scoresIncluded:false}}))),/\/ 10|No score/);
});

test('empty state is neutral and names the round; never implies a negative evaluation',()=>{
 const {InterviewFeedbackSection,EarlierFeedbackRounds}=loadComponent('components/interview-feedback-section.tsx');
 const empty={...feedback,entries:[],pending:2,earlierRounds:[]};
 const out=text(renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(InterviewFeedbackSection,{feedback:empty}),React.createElement(EarlierFeedbackRounds,{feedback:empty}))));
 assert.equal(out,'Interview feedback · Final interview No interview feedback has been submitted for Final interview yet. 2 reviews not yet submitted');
 assert.doesNotMatch(out,/0 \/ 10|not recommended|negative|failed|Earlier rounds/i);
});

test('Demo Mode: leader reads the same DTO without live calls; drafts, notes, unauthorized and anonymous rounds are withheld',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore,demoMember}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();
 try{
  demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
  const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview'),leader=demoMember();
  const app=s.applications.find(a=>a.clubId===club.id&&a.roundId===round.id&&a.studentId!==leader.userId);assert.ok(app,'Demo has an interview-round applicant');
  const others=s.memberships.filter(m=>m.clubId===club.id&&m.id!==leader.id).slice(0,3);assert.equal(others.length,3);
  demoStore.mutate(s=>{
   s.memberships.find(m=>m.id===leader.id).interviewOffices=['PRESIDENT'];
   for(const m of others){const t=s.memberships.find(v=>v.id===m.id);t.status='ACTIVE';t.permissions=[...new Set([...(t.permissions||[]),'applications.review','applicants.identify'])];}
   s.interviews=s.interviews.filter(r=>r.applicationId!==app.id);s.interviewFoundation.assignments=s.interviewFoundation.assignments.filter(g=>g.applicationId!==app.id);
   const target=s.applications.find(a=>a.id===app.id);target.evaluations=[];
   others.forEach((m,i)=>{
    const submittedAt=i<2?new Date().toISOString():null;
    s.interviewFoundation.assignments.push({applicationId:app.id,roundId:round.id,memberId:m.id,revokedAt:null});
    target.evaluations.push({id:crypto.randomUUID(),roundId:round.id,interviewerId:m.id,applicationId:app.id,score:[9,7.5,3][i],submittedAt,round:round.name,notes:'PRIVATE MISC',applicantQuestions:'PRIVATE ASKED'});
    s.interviews.push({id:crypto.randomUUID(),clubId:club.id,applicationId:app.id,roundId:round.id,interviewerId:m.id,completedAt:submittedAt,revision:1,questions:[],anonymousReview:false,draft:{questionNotes:[{questionId:'q',notes:'PRIVATE QUESTION'}],additionalQuestions:[],additionalNotes:'PRIVATE ADDITIONAL',applicantQuestions:'PRIVATE LEGACY',score:[9,7.5,3][i],finalInterviewThoughts:submittedAt?`Summary ${i+1}.`:'PRIVATE DRAFT'}});
   });
  });
  let result=await api.getInterviewFeedback({clubId:club.id,applicationId:app.id});
  assert.equal(result.status,'ready');assert.equal(result.feedback.roundName,round.name);assert.equal(result.feedback.pending,1);
  assert.deepEqual(result.feedback.entries.map(e=>[e.score,e.summary]).sort(),[[7.5,'Summary 2.'],[9,'Summary 1.']]);
  assert.ok(result.feedback.entries.every(e=>e.interviewer&&e.interviewer!=='PRIVATE'));
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|questionNotes|additionalNotes|applicantQuestions/);
  // A non-leader who never submitted cannot read peers' feedback.
  demoStore.mutate(s=>s.memberships.find(m=>m.id===leader.id).interviewOffices=[]);
  assert.deepEqual(await api.getInterviewFeedback({clubId:club.id,applicationId:app.id}),{status:'unavailable'});
  // Anonymous round: nothing identifying, even for leadership.
  demoStore.mutate(s=>{s.memberships.find(m=>m.id===leader.id).interviewOffices=['PRESIDENT'];s.clubs[0].rounds.find(r=>r.id===round.id).anonymousReview=true;});
  result=await api.getInterviewFeedback({clubId:club.id,applicationId:app.id});assert.deepEqual(result,{status:'unavailable'});
  assert.equal(h.calls(),0,'Demo never invokes the live server action');
 }finally{demoStore.stop()}
});
