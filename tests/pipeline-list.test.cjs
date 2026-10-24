const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const {pipelineListProjection}=load('lib/pipeline-list.ts');
test('pipeline list allowlist preserves filtering/ordering fields and excludes all detail content',()=>{
 const app={id:'app',roundId:'round',studentId:'student',status:'SUBMITTED',student:{email:'visible@example.invalid',studentProfile:{firstName:'First',lastName:'Last',major:'Math',academicYear:'First Year',gpa:3.4,satScore:1400,actScore:30,bio:'SECRET',headshotUrl:'SECRET',experiences:[{title:'SECRET'}]}},evaluations:[{interviewerId:'reviewer',notes:'SECRET',score:8}],roundScore:{average:8},answers:[{response:'SECRET'}],bookings:[{id:'SECRET'}],anonymousReviewText:'SECRET',futureColumn:'SECRET'};
 const data=pipelineListProjection({rounds:[{id:'round'}],genderCounts:null,applications:[app]});
 assert.doesNotMatch(JSON.stringify(data),/SECRET|answers|bookings|experiences|notes|futureColumn/);
 assert.equal(data.applications[0].student.studentProfile.gpa,3.4);assert.deepEqual(data.applications[0].evaluations,[{interviewerId:'reviewer'}]);assert.deepEqual(data.applications[0].roundScore,{average:8});
});
test('anonymous list runs after canonical masking and never restores identity or withheld fields',()=>{
 const {anonymousApplication}=load('lib/anonymous-review.ts');
 const app={id:'1234',clubId:'club',roundId:'round',studentId:'SECRET',status:'SUBMITTED',student:{email:'SECRET',studentProfile:{firstName:'SECRET',lastName:'SECRET',major:'SECRET',gradYear:2028,gpa:3.3}},evaluations:[],answers:[],bookings:[]};
 const masked=anonymousApplication(app);const list=pipelineListProjection({rounds:[],genderCounts:null,applications:[{...masked,roundScore:null}]});
 assert.doesNotMatch(JSON.stringify(list),/SECRET/);assert.equal(list.applications[0].student.studentProfile.firstName,'Applicant');assert.equal(list.applications[0].student.studentProfile.gpa,3.3);
});
