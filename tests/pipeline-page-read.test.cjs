const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const {readPipelinePage,pipelinePageMetadataSelect,requiresCompleteReviewMetadata}=load('lib/pipeline-page-read.ts');
const {pipelineSummaryProjection,pipelineSummarySelect}=load('lib/pipeline-summary.ts'),{pagePipeline}=load('lib/pipeline-page.ts');
const round=uuid(700),viewer=uuid(701),student=uuid(702),rounds=[{id:round,name:'Round',order:0,type:'APPLICATION_REVIEW',anonymousReview:false,genderVisible:false}];
const member={id:viewer,userId:student,isOwner:true,status:'ACTIVE',interviewOffices:['PRESIDENT']};
const raw=Array.from({length:251},(_,i)=>({id:uuid(1000+i),roundId:round,status:['SUBMITTED','INTERVIEWING','ACCEPTED','REJECTED','WAITLISTED'][i%5],studentId:i===0?student:uuid(2000+i),round:{anonymousReview:i%3===0},student:{email:`visible${i}@example.invalid`,studentProfile:i%7?{firstName:['Éva','李','Ann','ann','Zoe'][i%5],lastName:'Student '+i,major:i%2?'Math':'Physics',gradYear:2027+i%9,transferStudent:!!(i%2),gpa:i%4?3.4:null,satScore:1300+i%200,actScore:30}:null},evaluations:[{interviewerId:uuid(800),roundId:round,score:8,submittedAt:new Date()}],interviewAssignments:[]}));
function database(records=raw){const calls=[];return{calls,application:{async findMany(options){calls.push({table:'application',...options});if(options.select===pipelinePageMetadataSelect)return records.map(({evaluations,interviewAssignments,...metadata})=>metadata);return records}},evaluation:{async findMany(options){calls.push({table:'evaluation',...options});return records.filter(a=>options.where.applicationId.in.includes(a.id)).flatMap(a=>a.evaluations.filter(e=>e.submittedAt).map(e=>({...e,applicationId:a.id}))) }},interviewPanelAssignment:{async findMany(options){calls.push({table:'assignment',...options});return records.filter(a=>options.where.applicationId.in.includes(a.id)).flatMap(a=>a.interviewAssignments.map(e=>({...e,applicationId:a.id})))}}}}

const beforeCount=q=>expected(q).applications.length;
const expected=(q,m=member)=>{const p=pagePipeline({rounds,genderCounts:null,applications:raw.map(a=>pipelineSummaryProjection(a,m))},q,m.id,m.userId,'scope');return {...p,applications:p.applications.map(a=>({...a,answers:['authorized detail']})),coverage:{mode:q.mode??'applicants',complete:!q.roundId&&!q.gender&&!q.genderCounts&&p.page.start===0&&p.applications.length===p.page.baseTotal}}};
const hydrate=(tx,m=member)=>async ids=>{tx.calls.push({table:'detail',ids});return raw.filter(a=>ids.includes(a.id)).map(a=>({...pipelineSummaryProjection(a,m),answers:['authorized detail']})).reverse()};
test('bounded summary hydration retains exact canonical privacy, facets, locale ordering, filters and cursor behavior',async()=>{
 for(const m of [member,{...member,isOwner:false,permissions:['applications.review']}])for(const q of [{},...['name','round','year','gpa','sat','act','status'].flatMap(sort=>[{sort},{sort,descending:true}]),{gpa:3},{sat:1300},{act:20},{major:'Math'},{query:'student 20'},{mode:'decisions',decisionGroup:'accepted'},{mode:'rejected'}]){
  const tx=database(),before=expected(q,m),after=await readPipelinePage(tx,{clubId:'club'},m,rounds,q,'scope',hydrate(tx,m));assert.deepEqual(after,before);assert.equal(tx.calls[0].select,pipelinePageMetadataSelect);if(before.applications.length){assert.equal(tx.calls.length,2);assert.deepEqual(new Set(tx.calls[1].ids),new Set(before.applications.map(a=>a.id)));assert.ok(tx.calls[1].ids.length<=100)}
  if(before.page.next){const tx2=database(),next={...q,cursor:before.page.next};assert.deepEqual(await readPipelinePage(tx2,{clubId:'club'},m,rounds,next,'scope',hydrate(tx2,m)),expected(next,m))}
 }
 assert.equal('evaluations'in pipelinePageMetadataSelect,false);assert.equal('interviewAssignments'in pipelinePageMetadataSelect,false);
});
test('review and score dependencies retain the complete canonical path, including a zero rating threshold',async()=>{
 for(const q of [{review:'mine'},{review:'unreviewed'},{rating:0},{rating:7},{sort:'score'}]){assert.equal(requiresCompleteReviewMetadata(q),true);const tx=database();assert.deepEqual(await readPipelinePage(tx,{clubId:'club'},member,rounds,q,'scope',hydrate(tx)),expected(q));assert.equal(tx.calls.length,beforeCount(q)?2:1);assert.deepEqual(tx.calls[0].select,pipelineSummarySelect)}
});
test('empty pages avoid relation reads and scope mismatches fail closed',async()=>{
 const tx=database();assert.deepEqual(await readPipelinePage(tx,{},member,rounds,{query:'no-match'},'scope',hydrate(tx)),expected({query:'no-match'}));assert.equal(tx.calls.length,1);
 await assert.rejects(()=>readPipelinePage(database(),{},member,rounds,{cursor:{id:raw[0].id,direction:'after',scope:'other'}},'scope',()=>{throw Error('Must not hydrate forged cursor')}),/Restart pagination/);

});
