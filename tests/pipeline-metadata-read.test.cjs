const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const {pipelineMetadataQuery,readPipelineMetadata,pipelinePageMetadataSelect}=load('lib/pipeline-metadata-read.ts');
const scope={clubId:uuid(1),status:{not:'DRAFTING'}};
test('metadata join recognizes the complete guard scope and binds every value without SQL interpolation',()=>{
 const injection="x' OR TRUE; --",where={...scope,id:injection,roundId:uuid(2),round:{anonymousReview:true},student:{studentProfile:{gender:injection}}};
 const query=pipelineMetadataQuery(where);assert.ok(query);assert.deepEqual(query.values,[scope.clubId,injection,where.roundId,injection]);assert.ok(!query.text.includes(injection));
 for(const clause of ['a."clubId" =','a."status" <> \'DRAFTING\'','a."id" =','a."roundId" =','r."anonymousReview" = TRUE','p."gender" ='])assert.ok(query.text.includes(clause),clause);
 assert.ok(query.text.includes('LEFT JOIN "StudentProfile"'));assert.doesNotMatch(query.text,/SELECT\s+\*|notes|bio|resumeUrl|headshotUrl|permissions|Evaluation|InterviewPanelAssignment/);
});
test('unknown, nested, incomplete or changed predicates retain the exact original Prisma scope',async()=>{
 for(const where of [{}, {clubId:scope.clubId}, {...scope,AND:[{id:uuid(3)}]}, {...scope,OR:[{roundId:uuid(3)}]}, {...scope,NOT:{id:uuid(3)}}, {...scope,clubId:{in:[uuid(1)]}}, {...scope,status:{not:'REJECTED'}}, {...scope,status:{not:'DRAFTING',in:['SUBMITTED']}}, {...scope,round:{anonymousReview:false}}, {...scope,round:{anonymousReview:true,archivedAt:null}}, {...scope,student:{studentProfile:{gender:'Woman',major:'Math'}}}, {...scope,id:''}]){
  assert.equal(pipelineMetadataQuery(where),null);let calls=0;const expected=[{sentinel:true}];
  const tx={application:{async findMany(options){calls++;assert.equal(options.where,where);assert.equal(options.select,pipelinePageMetadataSelect);return expected}},$queryRaw(){throw Error('A partial scope must not use SQL')}};
  assert.equal(await readPipelineMetadata(tx,where),expected);assert.equal(calls,1);
 }
});
test('one metadata join reconstructs only the original scalar allowlist and preserves a missing profile',async()=>{
 const row={id:uuid(2),roundId:uuid(3),studentId:uuid(4),status:'IN_REVIEW',anonymousReview:true,email:'synthetic@example.invalid',hasProfile:true,firstName:'Éva',lastName:'李',major:'Math',gradYear:2028,transferStudent:false,gpa:3.25,satScore:null,actScore:30};let calls=0;
 const tx={$queryRaw:async query=>{calls++;assert.deepEqual(query.values,[scope.clubId]);return[row,{...row,id:uuid(5),hasProfile:false,firstName:null,lastName:null,major:null,gradYear:null,transferStudent:null,gpa:null,actScore:null}]},application:{findMany(){throw Error('Recognized metadata must not fan out')}}};
 const data=await readPipelineMetadata(tx,scope);assert.equal(calls,1);assert.deepEqual(data[0],{id:row.id,roundId:row.roundId,studentId:row.studentId,status:row.status,round:{anonymousReview:true},student:{email:row.email,studentProfile:{firstName:'Éva',lastName:'李',major:'Math',gradYear:2028,transferStudent:false,gpa:3.25,satScore:null,actScore:30}}});assert.equal(data[1].student.studentProfile,null);
});
test('a recognized metadata query failure propagates without a second database read',async()=>{
 const error=new Error('Synthetic query failure');let fallback=0;
 await assert.rejects(readPipelineMetadata({$queryRaw:async()=>{throw error},application:{findMany(){fallback++}}},scope),value=>value===error);assert.equal(fallback,0);
});
