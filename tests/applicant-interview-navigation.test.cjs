const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,id}=require('./helpers/interview-harness.cjs');
const {harness:demoHarness}=require('./helpers/demo-harness.cjs');
test('legacy bookmarks and submitted-review destinations move to Applicants without losing selected records or filters',()=>{
 const h=harness(),nav=h.load('lib/applicant-interview-navigation.ts');
 for(const tool of ['resumes','reviews']){
  const old=`section=recruitment&tool=interviews&interviewTab=${tool}&applicationId=${id(2)}&roundId=${id(3)}&cycleId=${id(4)}&reviewId=${id(5)}&documentId=${id(6)}&query=sample`;
  const target=new URL(nav.legacyApplicantInterviewHref(id(1),old),'https://out-class.net');
  assert.equal(target.searchParams.get('tool'),tool);assert.equal(target.searchParams.get('applicantId'),id(2));assert.equal(target.searchParams.get('roundId'),id(3));assert.equal(target.searchParams.get('cycleId'),id(4));assert.equal(target.searchParams.get('query'),'sample');assert.equal(target.searchParams.has('interviewTab'),false);
  assert.equal(target.searchParams.get(tool==='reviews'?'reviewId':'documentId'),tool==='reviews'?id(5):id(6));
 }
 assert.equal(nav.legacyApplicantInterviewHref(id(1),'section=recruitment&tool=interviews&interviewTab=schedule'),null);
 const settings=new URL(nav.legacyApplicantInterviewHref(id(1),'section=settings&setting=interviews&interviewTab=reviews&applicantId='+id(2)),'https://out-class.net');assert.equal(settings.searchParams.get('tool'),'reviews');assert.equal(settings.searchParams.has('setting'),false);assert.equal(settings.searchParams.get('applicantId'),id(2));
 const base=new URL(nav.applicantInterviewHref(id(1),'applicants','roundId='+id(3)+'&applicantId='+id(2)+'&reviewId='+id(5)),'https://out-class.net');assert.equal(base.searchParams.get('tool'),'applicants');assert.equal(base.searchParams.get('applicantId'),id(2));assert.equal(base.searchParams.has('reviewId'),false);
});
test('Applicants submenu and mobile grouping retain explicit office permissions, never infer moderation from applicant access',()=>{
 const h=demoHarness(),{createDemoSeed}=h.load('lib/demo/seed.ts'),s=createDemoSeed('2026-10-18'),member=s.memberships.find(m=>m.isOwner),nav=h.load('lib/product-navigation.ts');
 for(const offices of [[],['BOARD'],['PRESIDENT'],['VICE_PRESIDENT']]){
  const m={...member,interviewOffices:offices},items=nav.managerNavigation(m,member.clubId,'recruiting','roundId='+id(3));
  assert.equal(items.some(i=>i.id==='reviews'),offices.length>0);assert.equal(items.some(i=>i.id==='resumes'),offices.includes('PRESIDENT')||offices.includes('VICE_PRESIDENT'));
  for(const entry of items.filter(i=>['resumes','reviews'].includes(i.id))){assert.equal(entry.navGroup,'applicants');assert.match(entry.href,/roundId=/);}
  assert.equal(nav.mobileDestinations(items).find(i=>i.navGroup==='applicants').id,'applicants');
 }
 const tabs=fs.readFileSync('components/interview-management-tabs.tsx','utf8');assert.doesNotMatch(tabs,/Résumé moderation|Submitted reviews|InterviewResumeModeration|InterviewSubmittedReviews/);
 assert.match(fs.readFileSync('components/club-workspace.tsx','utf8'),/legacyApplicantInterviewHref/);assert.match(fs.readFileSync('app/club/[clubId]/workspace/page.tsx','utf8'),/if \(moved\) redirect\(moved\)/);
});
test('Demo existing review/document discovery filters applicant and historical round before limits, retaining privacy and no live calls',()=>{
 const h=demoHarness(),s=h.load('lib/demo/seed.ts').createDemoSeed('2026-10-18'),store=h.load('lib/demo/store.ts').demoStore;s.perspective={role:'leader',clubId:s.clubs[0].id};store.start(s);
 const api=h.load('lib/demo/interview-foundation.ts'),clubId=s.clubs[0].id,all=api.getSubmittedInterviewReviews(clubId);assert.ok(all.length);
 const row=all[0],scoped=api.getSubmittedInterviewReviews(clubId,{applicationId:row.applicationId,roundId:row.roundId});assert.ok(scoped.length);assert.ok(scoped.every(r=>r.applicationId===row.applicationId&&r.roundId===row.roundId));assert.deepEqual(api.getSubmittedInterviewReviews(clubId,{applicationId:id(9000)}),[]);assert.deepEqual(api.getSubmittedInterviewReviews(clubId,{cycleId:id(9000)}),[]);
 assert.deepEqual(api.getInterviewResumeModerationQueue(clubId,{applicationId:id(9000)}),[]);assert.equal(h.calls(),0);
});
test('live discovery scopes filters inside existing authorized queries; applicant-only access cannot discover restricted records',async()=>{
 const h=harness(),reviews=h.load('actions/interview-kits.ts'),resumes=h.load('actions/interview-resumes.ts'),queries=[];
 h.tx.interviewRecord.findMany=async q=>{queries.push(q);return[]};h.tx.interviewResumeDocument.findMany=async q=>{queries.push(q);return[]};
 for(const read of [reviews.getSubmittedInterviewReviews,resumes.getInterviewResumeModerationQueue]){
  await read(h.scope.clubId,{applicationId:h.scope.applicationId,roundId:h.scope.roundId,cycleId:id(7)});
  const q=queries.at(-1);assert.equal(q.where.applicationId,h.scope.applicationId);assert.equal(q.where.roundId,h.scope.roundId);assert.equal(q.where.application.clubId,h.scope.clubId);assert.equal(q.where.application.recruitmentCycleId,id(7));assert.equal(q.take,100);
 }
 h.as(11);for(const read of [reviews.getSubmittedInterviewReviews,resumes.getInterviewResumeModerationQueue])await assert.rejects(read(h.scope.clubId,{applicationId:h.scope.applicationId}),/leadership|moderation/i);
});
