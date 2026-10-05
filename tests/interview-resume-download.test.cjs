const {test}=require('node:test'),assert=require('node:assert/strict');const {harness,id}=require('./helpers/interview-harness.cjs');
test('interview PDF proxy scopes each download/range and revocation denies cached document IDs',async()=>{
 const h=harness(),route=h.load('app/api/interview-resumes/route.ts');h.state.documents.push({id:id(300),applicationId:id(2),roundId:id(3),content:new Uint8Array([37,80,68,70,45,49])});
 const url='https://example.invalid/api/interview-resumes?'+new URLSearchParams({...h.scope,documentId:id(300)});
 let result=await route.GET(new Request(url,{headers:{range:'bytes=1-3'}}));assert.equal(result.status,206);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('location'),null);assert.deepEqual([...new Uint8Array(await result.arrayBuffer())],[80,68,70]);
 result=await route.GET(new Request(url,{headers:{range:'bytes=99-100'}}));assert.equal(result.status,416);
 h.as(11);h.assignments[1].revokedAt=new Date();result=await route.GET(new Request(url));assert.equal(result.status,403);
 h.as(12);h.members[2].interviewOffices=['BOARD'];h.assignments[2].revokedAt=new Date();result=await route.GET(new Request(url));assert.equal(result.status,403);
 h.as(10);h.round.anonymousReview=true;result=await route.GET(new Request(url));assert.equal(result.status,403);
});
test('resume annotations never appear in compact applicant payload',async()=>{const h=harness(),api=h.load('actions/interview-resumes.ts');const result=await api.getInterviewApplicantPanel(h.scope);assert.deepEqual(Object.keys(result).sort(),['document','profile']);assert.doesNotMatch(JSON.stringify(result),/annotation|questionNotes|gpa/);});
