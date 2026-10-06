const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {harness,id}=require('./helpers/interview-harness.cjs');
function setup(){const h=harness();process.env.SUPABASE_SECRET_KEY='synthetic-only';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';return h;}
const request=h=>new Request(`http://localhost/api/recruiting-resumes?clubId=${h.scope.clubId}&applicationId=${h.scope.applicationId}`);
test('actual recruiting link helper reaches authorized private application proxy without exposing an object key or signed URL',async()=>{
 const h=setup(),helpers=h.load('lib/student-profile.ts'),api=h.load('app/api/recruiting-resumes/route.ts'),path=`${id(99)}/cv.pdf`;
 const href=helpers.resolveRecruitingResumeUrl(path,h.scope.clubId,h.scope.applicationId);assert.equal(href,`/api/recruiting-resumes?clubId=${id(1)}&applicationId=${id(2)}`);assert.doesNotMatch(href,/cv.pdf|path=/);h.as(11);h.assignments[1].revokedAt=new Date();const response=await api.GET(new Request('http://localhost'+href));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('location'),null);assert.match(await response.text(),/^%PDF/);
 assert.match(fs.readFileSync('lib/applicant-display.ts','utf8'),/resolveRecruitingResumeUrl\(profile.resumeUrl, app.clubId, app.id\)/);assert.match(fs.readFileSync('components/views/leader-dashboard/live-leader-workspace.tsx','utf8'),/resolveRecruitingResumeUrl\(url, membership.clubId, active.id\)/);assert.match(fs.readFileSync('components/views/unified-student-profile-view.tsx','utf8'),/resolveResumeUrl\(profile.resumeUrl\)/);assert.match(fs.readFileSync('components/interview-applicant-panel.tsx','utf8'),/api\/interview-resumes/);
});
test('recruiter resume scope denies anonymous, outsider, cross-club, inactive, disabled, unidentified and path-forging requests',async()=>{
 for(const mutate of [h=>h.as(99),h=>h.members[0].status='LEFT',h=>h.members[0].user.disabledAt=new Date(),h=>{h.members[0].isOwner=false;h.members[0].permissions=['applications.review']},h=>h.round.anonymousReview=true,h=>h.app.status='DRAFTING']){const h=setup();mutate(h);assert.equal((await h.load('app/api/recruiting-resumes/route.ts').GET(request(h))).status,403);}
 const h=setup(),api=h.load('app/api/recruiting-resumes/route.ts');assert.equal((await api.GET(new Request(`http://localhost/api/recruiting-resumes?clubId=${id(9)}&applicationId=${id(2)}`))).status,403);assert.equal((await api.GET(new Request(request(h).url+'&path='+encodeURIComponent(id(99)+'/cv.pdf')))).status,400);
});
test('private download reauthorizes after fetching bytes; changed resume or revoked access cannot return them',async()=>{
 for(const mode of ['replacement','revocation']){const h=setup();let reads=0;h.tx.studentProfile.findUnique=async()=>{reads++;if(reads===1&&mode==='revocation'){h.members[0].status='LEFT';}return{resumeUrl:`${id(99)}/${reads>1&&mode==='replacement'?'changed':'cv'}.pdf`};};const response=await h.load('app/api/recruiting-resumes/route.ts').GET(request(h));assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/%PDF/);}
});
