// Demo Mode: Overview's letter counts come from the fictional store (each applicant once), never live calls or writes.
const {test}=require('node:test'),assert=require('node:assert/strict');const {harness}=require('./helpers/demo-harness.cjs');
test('Demo letter counts: letter-bearing decisions in the round, sent when a Demo letter matches the current decision',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),clubId=s.clubs[0].id,api=h.load('lib/voting-room-api.ts');
 const decided=['ACCEPTED','WAITLISTED','REJECTED'];
 let writes=0;const save=localStorage.setItem.bind(localStorage);localStorage.setItem=(...args)=>{writes++;save(...args)};
 let checked=0;
 for(const round of s.clubs[0].rounds.filter(r=>!r.archivedAt)){
  const apps=s.applications.filter(a=>a.clubId===clubId&&a.roundId===round.id&&decided.includes(a.status));
  const sent=apps.filter(a=>s.decisionLetters.filter(l=>l.applicationId===a.id).at(-1)?.decision===a.status).length;
  assert.deepEqual(await api.getRoundLetterCounts({clubId,roundId:round.id}),{ready:apps.length-sent,sent},round.name);
  checked+=apps.length;
 }
 assert.ok(checked>0,'the Demo store has decided applicants to count');
 assert.equal(writes,0,'reads never write the Demo store');
 // A changed decision (no letter for it yet) counts as ready, not sent.
 const app=s.applications.find(a=>a.clubId===clubId&&decided.includes(a.status)&&s.decisionLetters.some(l=>l.applicationId===a.id));
 const before=await api.getRoundLetterCounts({clubId,roundId:app.roundId});
 demoStore.mutate(st=>{const a=st.applications.find(x=>x.id===app.id);a.status=a.status==='ACCEPTED'?'REJECTED':'ACCEPTED';});
 const after=await api.getRoundLetterCounts({clubId,roundId:app.roundId});
 assert.equal(after.sent,before.sent-1);assert.equal(after.ready,before.ready+1);
 // Without Decide access the Demo read is refused, like the live one.
 demoStore.mutate(st=>{const m=st.memberships.find(m=>m.clubId===clubId&&m.isOwner);m.isOwner=false;m.permissions=['applications.review'];m.accessRole='MEMBER';});
 await assert.rejects(api.getRoundLetterCounts({clubId,roundId:app.roundId}));
});
