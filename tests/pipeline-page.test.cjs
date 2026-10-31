const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const {pagePipeline,completePipelineSelection,pipelinePageQuery}=load('lib/pipeline-page.ts');
const round=uuid(9000),reviewer=uuid(9001),user=uuid(9002);
const app=(i,extra={})=>({id:uuid(i),studentId:uuid(i+10000),roundId:round,status:'SUBMITTED',student:{email:`student${i}@example.invalid`,studentProfile:{firstName:'Student',lastName:String(i).padStart(4,'0'),major:i%2?'Math':'Economics',academicYear:i%2?'First Year':'Third Year',gpa:i%2?3.7:3.1,satScore:i%2?1500:1300,actScore:i%2?34:28}},evaluations:i%3?[{interviewerId:reviewer}]:[],roundScore:i%5?{average:i%2?9:7}:null,...extra});
const list=n=>({rounds:[{id:round,order:0}],genderCounts:null,applications:Array.from({length:n},(_,i)=>app(i+1))});
const page=(data,q={},scope='scope')=>pagePipeline(data,q,reviewer,user,scope);
test('server pages bound rows and preserve all matches, facets and complete selections beyond 100',()=>{
 const data=list(1000),first=page(data);assert.equal(first.applications.length,100);assert.equal(first.page.total,1000);assert.equal(first.page.count,10);assert.equal(first.page.next.id,uuid(100));assert.equal(first.page.previous,null);assert.equal(first.facets.quickReview,1000);assert.equal(first.facets.lanes.review,1000);assert.deepEqual(first.facets.majors,['Economics','Math']);
 const ids=[...first.applications.map(a=>a.id)];let current=first;while(current.page.next){current=page(data,{cursor:current.page.next});ids.push(...current.applications.map(a=>a.id))}assert.equal(ids.length,1000);assert.equal(new Set(ids).size,1000);assert.equal(current.page.index,9);const previous=page(data,{cursor:current.page.previous});assert.equal(previous.page.index,8);assert.equal(previous.applications[0].id,uuid(801));
 const selected=completePipelineSelection(data,{},reviewer,user).applications;assert.equal(selected.length,1000);assert.deepEqual(selected.map(a=>a.id),ids);assert.deepEqual(Object.keys(selected[0]),['id','roundId','status','canQuickReview']);assert.doesNotMatch(JSON.stringify(selected),/student|email|score|major/);
 const found=page(data,{query:'Student 1000'});assert.equal(found.page.total,1);assert.equal(found.applications[0].id,uuid(1000));assert.equal(found.page.baseTotal,1000);
});
test('all academic/review/decision filters apply globally before paging; totals remain global',()=>{
 const data=list(360);data.applications[0].status='REJECTED';data.applications[1].status='ACCEPTED';data.applications[2].studentId=user;
 const q={major:'Math',year:'First Year',gpa:3.5,sat:1400,act:30,rating:8,review:'mine',sort:'gpa',descending:true};
 const result=page(data,q),expected=data.applications.filter(a=>a.status!=='REJECTED'&&a.student.studentProfile.major==='Math'&&a.evaluations.some(e=>e.interviewerId===reviewer)&&a.roundScore?.average>=8);
 assert.equal(result.page.total,expected.length);assert.equal(result.page.baseTotal,359);assert.ok(result.applications.every(a=>expected.includes(a)));assert.equal(completePipelineSelection(data,q,reviewer,user).applications.length,expected.length);
 assert.equal(page(data,{gpa:3.7}).page.total,0,'strict greater-than remains strict');assert.equal(page(data,{rating:9}).page.total,143,'rating is inclusive and hidden scores do not match');
 assert.equal(page(data,{mode:'decisions',decisionGroup:'accepted',query:'no match'}).facets.decisions.accepted,1);assert.equal(page(data,{mode:'rejected'}).page.total,1);
 const selected=completePipelineSelection(data,{},reviewer,user).applications;assert.equal(selected.find(a=>a.id===uuid(3)).canQuickReview,false,'self excluded');assert.equal(selected.find(a=>a.id===uuid(2)).canQuickReview,false,'recorded decisions excluded');
});
test('anonymous identity/major and hidden scores cannot affect search, facets, ordering or review filters',()=>{
 const {anonymousApplication}=load('lib/anonymous-review.ts'),{pipelineListProjection}=load('lib/pipeline-list.ts');
 const raw={...app(1),clubId:uuid(9010),answers:[],bookings:[]};raw.student.studentProfile.firstName='SECRET';raw.student.studentProfile.lastName='SECRET';raw.student.studentProfile.major='SECRET';raw.student.studentProfile.gradYear=2028;
 const masked=anonymousApplication(raw);const data=pipelineListProjection({rounds:[{id:round,order:0}],genderCounts:null,applications:[{...masked,roundScore:null}]});
 assert.equal(page(data,{query:'SECRET'}).page.total,0);assert.deepEqual(page(data).facets.majors,[]);assert.equal(page(data,{rating:1}).page.total,0);assert.equal(page(data,{query:'Applicant'}).page.total,1);assert.equal(completePipelineSelection(data,{},reviewer,user).applications[0].canQuickReview,false);assert.doesNotMatch(JSON.stringify(page(data)),/SECRET/);
});
test('every sort has deterministic ID ties, missing-last semantics and reversible page navigation',()=>{
 const data=list(240);for(const a of data.applications){a.student.studentProfile.firstName='Same';a.student.studentProfile.lastName='Name';a.student.studentProfile.academicYear='Second Year';a.student.studentProfile.gpa=null;a.student.studentProfile.satScore=null;a.student.studentProfile.actScore=null;a.roundScore=null}data.applications.reverse();
 for(const sort of ['name','round','year','gpa','sat','act','status','score'])for(const descending of [false,true]){const first=page(data,{sort,descending});const second=page(data,{sort,descending,cursor:first.page.next});const back=page(data,{sort,descending,cursor:second.page.previous});assert.equal(first.applications[0].id,uuid(1),sort);assert.deepEqual(back.applications.map(a=>a.id),first.applications.map(a=>a.id));assert.equal(second.applications[0].id,uuid(101));}
 assert.equal(data.applications[0].id,uuid(240),'source order is unchanged');
});
test('cursor positions cannot cross selection scope; lost anchors reset safely and at-cursors locate any matching page',()=>{
 const data=list(250),first=page(data);assert.throws(()=>page(data,{cursor:first.page.next},'other-club-or-authority'),/selection changed/);
 assert.equal(page(data,{cursor:{id:uuid(233),direction:'at',scope:'scope'}}).page.index,2);
 const cursor=first.page.next;data.applications=data.applications.filter(a=>a.id!==cursor.id);const reset=page(data,{cursor});assert.equal(reset.page.reset,true);assert.equal(reset.page.start,0);
 for(const q of [{userId:user},{limit:5000},{applicationId:uuid(1)},{sort:'rawScore'},{rating:NaN},{query:'x'.repeat(201)},{cursor:{...cursor,grant:true}}])assert.equal(pipelinePageQuery.safeParse(q).success,false);
});
