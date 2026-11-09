const {test}=require('node:test'),assert=require('node:assert/strict');
const b=require('./helpers/ranked-review-benchmark.cjs');
// Synthetic fixture only (fictional applicants, mocked Prisma). Parity with the full CRM read
// proves the narrow Ranked review read changes no identity, cycle, photo, status or score rule.
const parity=async(label,rows,member)=>{
 const h=b.harness(rows,{member});
 const full=await h.crm.getClubPipeline(b.clubId,{roundId:b.roundId}),narrow=await h.crm.getRankedReviewRound(b.clubId,b.roundId);
 assert.deepEqual(narrow.applications,full.applications.map(h.read.rankedReviewCandidate),label);
 return narrow.applications;
};
const leader=b.viewer;
test('the ranked read projects exactly what the full CRM read projects, for every viewer and round kind',async()=>{
 const identified=await parity('identified leader',b.syntheticApplications(60),leader);
 assert.equal(identified.length,57,'only the requested round');
 assert.ok(identified.every(a=>a.roundScore&&a.recruitmentCycleId===b.cycleId&&!a.studentId.startsWith('anonymous-')));
 assert.deepEqual([...new Set(identified.map(a=>a.status))].sort(),['ACCEPTED','INTERVIEWING','IN_REVIEW','REJECTED','WAITLISTED'],'decided applicants stay in the ranked list');
 assert.match(identified.find(a=>a.student.studentProfile.headshotUrl).student.studentProfile.headshotUrl,/^\/api\/profile-photos\?.*mode=crm/,'photos stay request-scoped CRM URLs');
 const anonymous=await parity('anonymous round',b.syntheticApplications(40,4,{anonymousReview:true}),leader);
 assert.ok(anonymous.every(a=>a.studentId.startsWith('anonymous-')&&a.student.email===''&&a.recruitmentCycleId===null&&a.student.studentProfile.headshotUrl===null&&a.student.studentProfile.firstName==='Applicant'));
 const reviewer={...leader,permissions:['applications.review']};
 assert.equal((await parity('no applicants.identify, identified round',b.syntheticApplications(20),reviewer)).length,0,'identified rounds stay closed without applicants.identify');
 assert.ok((await parity('no applicants.identify, anonymous round',b.syntheticApplications(20,4,{anonymousReview:true}),reviewer)).every(a=>a.studentId.startsWith('anonymous-')));
 const [assigned,unassigned]=[b.interviewers[3],b.interviewers[4]].map(m=>({...m,userId:m.userId}));
 assert.ok((await parity('assigned interviewer who submitted',b.syntheticApplications(20),assigned)).every(a=>a.roundScore));
 assert.ok((await parity('member who cannot see scores',b.syntheticApplications(20),unassigned)).every(a=>a.roundScore===null),'hidden scores stay hidden');
});
test('the ranked read never selects answers, bookings, experiences, offers, notes or member rows',async()=>{
 const rows=b.syntheticApplications(5),h=b.harness(rows);
 const narrow=await h.crm.getRankedReviewRound(b.clubId,b.roundId);
 const fetched=JSON.stringify(h.stats.fetched);
 for(const field of ['"answers"','"bookings"','"experiences"','"recruitmentOffer"','"notes"','"applicantQuestions"','"bio"','"computingId"','"title"'])assert.ok(!fetched.includes(field),`${field} is not read`);
 assert.equal(h.stats.applicationQueries,1,'one application query, no per-applicant reads');
 assert.deepEqual(Object.keys(narrow.applications[0]).sort(),['id','recruitmentCycleId','roundId','roundScore','status','student','studentId']);
});
test('ranked read and projection stay fast and small at 2000 applicants (generous budget)',async t=>{
 const {measure}=require('../scripts/benchmark-ranked-review.cjs');
 const result=await measure(2000);t.diagnostic(JSON.stringify(result));
 assert.ok(result.serverMs<1500,`server read ${result.serverMs}ms`);
 assert.ok(result.payloadKB<2000,`client payload ${result.payloadKB} KB`);
 assert.ok(result.fetchedKB*4<result.legacyFetchedKB,'reads well under a quarter of the full CRM detail');
 assert.ok(result.projectionMs<250,`projection ${result.projectionMs}ms`);
 // Tie detection is linear: 2000 applicants all tied must not go quadratic.
 const ranked=b.load('lib/ranked-review.ts'),tied=Array.from({length:4000},(_,i)=>({id:String(i).padStart(6,'0'),average:i%2?7:8,submitted:3,visible:true}));
 const started=performance.now(),view=ranked.rankedReviewView(tied,{green:{start:1,end:20},yellow:{start:21,end:40},red:{start:41}});
 assert.ok(performance.now()-started<250);assert.deepEqual([...view.tiedRanks],[1,2001]);assert.equal(view.byBand.green.length,2000);assert.equal(view.ties.length,1);
});
