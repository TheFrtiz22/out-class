// Demo Mode equivalents of the paged leadership lists: same page shape, cursor rules and per-page access check.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/demo-harness.cjs');
test('Demo submitted reviews and résumé moderation page 50 at a time with the server cursor rules and no live calls',()=>{
 const h=harness(),s=h.load('lib/demo/seed.ts').createDemoSeed('2026-10-18'),store=h.load('lib/demo/store.ts').demoStore;s.perspective={role:'leader',clubId:s.clubs[0].id};
 store.start(s);const api=h.load('lib/demo/interview-foundation.ts'),cursors=h.load('lib/interview-list-page.ts');
 const clubId=s.clubs[0].id,visible=api.getSubmittedInterviewReviewPage(clubId).items[0];assert.ok(visible,'seed has a visible completed review');
 // Demo rows carry exactly what Demo getInterviewRoundScore answers this viewer (null when it refuses).
 for(const row of api.getSubmittedInterviewReviewPage(clubId).items){let want=null;try{const r=api.getInterviewRoundScore({clubId,applicationId:row.applicationId,roundId:row.roundId});want={average:r.average,submitted:r.submitted};}catch{}assert.deepEqual(row.score,want);}
 const owner=s.memberships.find(m=>m.clubId===clubId&&m.isOwner),app=s.applications.find(a=>a.clubId===clubId&&a.studentId!==owner.userId&&a.status!=='DRAFTING'&&!s.clubs[0].rounds.find(r=>r.id===a.roundId)?.anonymousReview);
 // 130 extra completed reviews sharing timestamps in runs of 7, and 120 preserved documents.
 store.mutate(state=>{const source=state.interviews.find(r=>r.id===visible.id);for(let i=0;i<130;i++)state.interviews.push({...structuredClone(source),id:randomUUID(),completedAt:new Date(Date.UTC(2026,9,1)-Math.floor(i/7)*60000).toISOString()});
 for(let i=0;i<120;i++)state.interviewFoundation.documents.push({id:randomUUID(),applicationId:app.id,roundId:app.roundId,source:'/demo/sample-resume.pdf',createdAt:new Date(Date.UTC(2026,9,1)-Math.floor(i/7)*60000).toISOString()});});
 for(const [read,id] of [[api.getSubmittedInterviewReviewPage,r=>r.id],[api.getInterviewResumeModerationPage,r=>r.documentId]]){
  const pages=[];let cursor=null;do{const page=read(clubId,{},cursor);pages.push(page);cursor=page.nextCursor;}while(cursor&&pages.length<10);
  const ids=pages.flatMap(p=>p.items.map(id)),total=pages[0].total;
  assert.ok(total>=120);assert.equal(ids.length,total);assert.equal(new Set(ids).size,total,'no duplicates');assert.ok(pages.slice(0,-1).every(p=>p.items.length===50));assert.ok(pages.every(p=>p.total===total));
  assert.throws(()=>read(clubId,{roundId:randomUUID()},pages[0].nextCursor),/list changed/i,'cursor from another filter scope');
  assert.throws(()=>read(clubId,{},cursors.encodeInterviewListCursor(read===api.getSubmittedInterviewReviewPage?'reviews':'resumes',cursors.interviewListScope(clubId,{}),randomUUID())),/list changed/i,'anchor outside the list');
  assert.throws(()=>read(clubId,{},'%%%'),/Invalid list position/);
 }
 const first=api.getSubmittedInterviewReviewPage(clubId,{},null);
 store.mutate(state=>{state.memberships.find(m=>m.id===owner.id).interviewOffices=[]});
 assert.throws(()=>api.getSubmittedInterviewReviewPage(clubId,{},first.nextCursor),/leadership/,'access re-checked on page 2');
 assert.throws(()=>api.getInterviewResumeModerationPage(clubId,{},null),/moderation/);
 assert.equal(h.calls(),0);
});
