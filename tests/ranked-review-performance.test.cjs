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
// Authorization parity: the ranked read must deny or empty exactly where the full CRM read does.
const settle=p=>p.then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
async function both(h,club,round){
 const full=await settle(h.crm.getClubPipeline(club,{roundId:round})),narrow=await settle(h.crm.getRankedReviewRound(club,round));
 assert.equal(narrow.ok,full.ok,'same allow/deny');
 if(full.ok)assert.deepEqual(narrow.value.applications,full.value.applications.map(h.read.rankedReviewCandidate),'same rows');
 else assert.equal(narrow.error,full.error,'same denial');
 return {full,narrow};
}
const clubY=b.uuid('0000000f',1),roundY=b.uuid('0000000f',2);
test('a member of club X never reads club Y rounds through the ranked read, as with getClubPipeline',async()=>{
 const rows=[...b.syntheticApplications(20),...b.syntheticApplications(20,4,{club:clubY,inRound:roundY,idPrefix:'f'})];
 const h=b.harness(rows,{memberships:{[b.clubId]:b.viewer}});
 const foreign=await both(h,clubY,roundY);assert.equal(foreign.narrow.ok,false,'club Y is denied to a club X member');
 const crossed=await both(h,b.clubId,roundY);assert.equal(crossed.narrow.ok,true);assert.deepEqual(crossed.narrow.value.applications,[],"club X scope with club Y's round reads nothing");
 const own=await both(h,b.clubId,b.roundId);assert.ok(own.narrow.value.applications.length>0&&own.narrow.value.applications.every(a=>!a.id.startsWith('f')));
});
test('a suspended club reads the same through the ranked read as through getClubPipeline',async()=>{
 const h=b.harness(b.syntheticApplications(20),{suspended:[b.clubId]});
 const {narrow}=await both(h,b.clubId,b.roundId);
 assert.equal(narrow.ok,true);assert.equal(narrow.value.applications.length,19);
 const [fullAuth,narrowAuth]=h.stats.authCalls;assert.deepEqual(narrowAuth,fullAuth,'same permission request, including allowSuspendedRead');
 assert.equal(narrowAuth.options?.allowSuspendedRead,true);
});
test('without applicants.identify, an identified round reads the same (nothing) as getClubPipeline',async()=>{
 const reviewer={...b.viewer,permissions:['applications.review']};
 const {full,narrow}=await both(b.harness(b.syntheticApplications(20),{member:reviewer}),b.clubId,b.roundId);
 assert.equal(full.ok,true);assert.deepEqual(full.value.applications,[]);assert.deepEqual(narrow.value.applications,[]);
 const denied=await both(b.harness(b.syntheticApplications(5),{member:{...b.viewer,permissions:[]}}),b.clubId,b.roundId);
 assert.equal(denied.narrow.ok,false,'no applicant permission at all is denied by both');
});
test('an archived round reads the same as getClubPipeline({roundId}) (current behaviour pinned)',async()=>{
 const h=b.harness(b.syntheticApplications(20,4,{archivedAt:new Date(1e12)}));
 const {full,narrow}=await both(h,b.clubId,b.roundId);
 // Today the round filter does not exclude an archived round's applications; both reads return them.
 assert.equal(full.ok,true);assert.equal(full.value.applications.length,19);assert.equal(narrow.value.applications.length,19);
 assert.deepEqual(full.value.rounds.filter(r=>r.id===b.roundId),[],'the archived round itself is not listed');
});
