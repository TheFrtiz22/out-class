// Actual Prisma connections; synthetic identity only. Never inherits DATABASE_URL.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {randomUUID,createHash}=require('node:crypto');
const databaseUrl=process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
function actions(prisma,userId){
 const cache={};
 function load(file){
  file=path.resolve(file);if(cache[file])return cache[file].exports;
  const mod={exports:{}};cache[file]=mod;
  const mocks={'@/utils/prisma':{prisma},'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'next/server':{after(){}},'next/cache':{revalidatePath(){}}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(Object.assign(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),{resolve:require.resolve}),mod,mod.exports);
  return mod.exports;
 }
 return {kits:load('actions/interview-kits.ts'),resume:load('actions/interview-resumes.ts'),members:load('actions/organization-members.ts'),evaluations:load('actions/evaluations.ts')};
}
test('native PostgreSQL interview transactions: independent drafts, simultaneous finish, annotations, revocation and immutable anonymous reopening',{skip:!databaseUrl,timeout:120000},async t=>{
 const url=new URL(databaseUrl);assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname==='/outclass_security_test','Requires disposable local outclass_security_test');
 const {PrismaClient}=require('@prisma/client');
 const prisma=new PrismaClient({datasourceUrl:databaseUrl});t.after(()=>prisma.$disconnect());
 const identity=await prisma.$queryRaw`SELECT current_database() AS name, host(inet_server_addr()) AS address`;
 assert.equal(identity[0].name,'outclass_security_test');assert.equal(identity[0].address,'127.0.0.1');
 const people=await Promise.all(Array.from({length:6},async()=>prisma.user.create({data:{email:`native-${randomUUID()}@virginia.edu`}})));
 const [owner,one,two,applicant,outsider,leader]=people;
 const club=await prisma.club.create({data:{name:'Synthetic Interview Race',slug:randomUUID(),tagline:'',description:'',color:'#fff',category:'Other'}});
 const memberships=await Promise.all([owner,one,two,leader].map((user,i)=>prisma.clubMember.create({data:{clubId:club.id,userId:user.id,isOwner:i===0,permissions:['applications.review','applicants.identify','members.manage','leaders.manage']}})));
 const [ownerMember,oneMember,twoMember,leaderMember]=memberships;
 const q={id:randomUUID(),prompt:'Original question',guidance:''};
 const round=await prisma.pipelineRound.create({data:{clubId:club.id,name:'Interview',order:0,interviewKit:[q]}});
 const app=await prisma.application.create({data:{clubId:club.id,studentId:applicant.id,roundId:round.id,status:'INTERVIEWING'}});
 const scope={clubId:club.id,applicationId:app.id,roundId:round.id};
 const own=actions(prisma,owner.id),a=actions(prisma,one.id),b=actions(prisma,two.id),l=actions(prisma,leader.id);
 await assert.rejects(own.kits.saveInterviewKit(club.id,round.id,0,[q]),/denied/);
 await own.members.setMemberInterviewOffices({clubId:club.id,memberId:ownerMember.id,offices:['PRESIDENT']});
 await own.members.setMemberInterviewOffices({clubId:club.id,memberId:leaderMember.id,offices:['BOARD']});
 for(const member of [oneMember,twoMember])await own.members.setInterviewPanelAssignment({...scope,memberId:member.id,assigned:true});
 await assert.rejects(a.members.setMemberInterviewOffices({clubId:club.id,memberId:oneMember.id,offices:['BOARD']}),/owner/);
 for(const user of [applicant,outsider])await assert.rejects(actions(prisma,user.id).kits.openInterviewSession(scope));
 await assert.rejects(a.kits.openInterviewSession({...scope,clubId:randomUUID()}));
 const [first,second]=await Promise.all([a.kits.openInterviewSession(scope),b.kits.openInterviewSession(scope)]);
 await own.kits.saveInterviewKit(club.id,round.id,0,[{...q,prompt:'Changed master question'}]);
 assert.equal((await a.kits.openInterviewSession(scope)).questions[0].prompt,'Original question');
 await assert.rejects(a.kits.saveInterviewKit(club.id,round.id,1,[q]),/denied/);
 const off={id:randomUUID(),question:'Off script',notes:'Private follow-up'};
 const draft={...first.draft,questionNotes:[{questionId:q.id,notes:'Only interviewer one'}],additionalQuestions:[off],completedQuestionIds:[q.id],applicantQuestions:'Applicant asked about meetings',additionalNotes:'Discussion before scoring',score:null};
 await a.kits.saveInterviewSession({...scope,revision:first.revision,draft});
 assert.deepEqual((await b.kits.openInterviewSession(scope)).draft,second.draft);
 assert.equal((await a.kits.openInterviewSession(scope)).draft.score,null);
 const bytes=fs.readFileSync('public/demo/sample-resume.pdf');
 const document=await prisma.interviewResumeDocument.create({data:{applicationId:app.id,roundId:round.id,sourcePath:applicant.id+'/original.pdf',contentHash:createHash('sha256').update(bytes).digest('hex'),content:bytes}});
 const ds={...scope,documentId:document.id},note=comment=>({kind:'GENERAL_NOTE',anchor:null,comment});
 const ids=[randomUUID(),randomUUID()];
 await Promise.all([a.resume.saveInterviewResumeAnnotation({...ds,id:ids[0],content:note('Comment one')}),b.resume.saveInterviewResumeAnnotation({...ds,id:ids[1],content:note('Comment two')})]);
 assert.equal((await a.resume.getInterviewResumeAnnotations(ds)).annotations.length,2);
 await a.resume.saveInterviewResumeAnnotation({...ds,id:ids[0],content:note('Comment one')});
 const edits=await Promise.allSettled(['Edit A','Edit B'].map(comment=>a.resume.saveInterviewResumeAnnotation({...ds,id:ids[0],revision:0,content:note(comment)})));
 assert.equal(edits.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(b.resume.deleteInterviewResumeAnnotation({...ds,id:ids[0],revision:1}),/unavailable/);
 await own.resume.deleteInterviewResumeAnnotation({...ds,id:ids[0],revision:1});
 await assert.rejects(b.resume.getInterviewAnnotationHistory({...ds,id:ids[0]}),/unavailable/);
 assert.equal((await own.resume.getInterviewAnnotationHistory({...ds,id:ids[0]})).length,2);
 await prisma.studentProfile.create({data:{userId:applicant.id,firstName:'Synthetic',lastName:'Applicant',computingId:randomUUID(),major:'Economics',gradYear:2028,resumeUrl:applicant.id+'/replacement.pdf',scholarStatus:{selections:['JEFFERSON','ECHOLS'],other:''}}});
 assert.equal((await a.resume.pinInterviewResume(scope)).contentHash,document.contentHash);
 await assert.rejects(prisma.studentProfile.update({where:{userId:applicant.id},data:{scholarStatus:{selections:['NOT_APPLICABLE','ECHOLS'],other:''}}}));
 const closing={...draft,score:8.5,additionalNotes:'Final discussion text'};
 const finished=await Promise.all([a.kits.saveInterviewSession({...scope,revision:1,draft:closing,complete:true}),a.kits.saveInterviewSession({...scope,revision:1,draft:closing,complete:true})]);
 assert.equal(finished[0].evaluation.id,finished[1].evaluation.id);
 assert.equal(await prisma.evaluation.count({where:{applicationId:app.id,interviewerId:oneMember.id}}),1);
 assert.equal((await b.kits.openInterviewSession(scope)).completedAt,null);
 await assert.rejects(prisma.interviewRecord.update({where:{id:second.id},data:{completedAt:new Date()}}),/canonical submitted evaluation/,'The old deployed completion order must be blocked until the matching application is released');
 await assert.rejects(a.kits.saveInterviewSession({...scope,revision:2,draft:{...closing,score:9},complete:true}),/completed/);
 await assert.rejects(a.evaluations.submitEvaluation({applicationId:app.id,clubId:club.id,roundId:round.id,score:9,notes:'Attempt rewrite'}));
 await assert.rejects(prisma.evaluation.update({where:{id:finished[0].evaluation.id},data:{score:9}}),/immutable/);
 const next=await prisma.pipelineRound.create({data:{clubId:club.id,name:'Interview',order:1,anonymousReview:true}});
 await prisma.application.update({where:{id:app.id},data:{roundId:next.id}});
 const review=await l.kits.getSubmittedInterviewReview({...scope,interviewerId:oneMember.id});
 assert.equal(review.readOnly,true);assert.equal(review.score,8.5);assert.equal(review.additionalNotes,'');assert.equal(review.applicantQuestions,'');
 assert.doesNotMatch(JSON.stringify(review),/Only interviewer one|Final discussion|Synthetic/);
 await prisma.application.update({where:{id:app.id},data:{roundId:round.id}});
 const history=[];
 async function historyFixture(interviewerId=oneMember.id,roundId=round.id,complete=true){
  const student=await prisma.user.create({data:{email:`history-${randomUUID()}@virginia.edu`}});
  await prisma.studentProfile.create({data:{userId:student.id,firstName:'Synthetic',lastName:'History',computingId:randomUUID(),major:'Economics',gradYear:2028}});
  const application=await prisma.application.create({data:{clubId:club.id,studentId:student.id,roundId,status:'INTERVIEWING'}});
  await prisma.interviewPanelAssignment.create({data:{applicationId:application.id,roundId,memberId:interviewerId,grantedBy:owner.id}});
  const date=new Date('2026-10-01T12:00:00Z');
  const evaluation=complete?await prisma.evaluation.create({data:{applicationId:application.id,interviewerId,roundId,round:'Interview',score:7.5,submittedAt:date}}):null;
  return prisma.interviewRecord.create({data:{applicationId:application.id,interviewerId,roundId,anonymousReview:roundId===next.id,questions:[q],draft:{...first.draft,score:evaluation?7.5:null},completedAt:evaluation?date:null,evaluationId:evaluation?.id}});
 }
 assert.deepEqual(await a.kits.getPreviousInterviewScores(scope),[]);
 for(let i=0;i<7;i++)history.push(await historyFixture());
 await historyFixture(twoMember.id);await historyFixture(oneMember.id,next.id);await historyFixture(oneMember.id,round.id,false);
 const expected=history.sort((x,y)=>y.id.localeCompare(x.id)).slice(0,5).map(r=>r.id);
 assert.deepEqual((await a.kits.getPreviousInterviewScores(scope)).map(r=>r.id),expected,'History excludes current, peer, same-name other round and unfinished records; ID breaks timestamp ties');
 // A different club with an identically named round must never enter history.
 const foreign=await prisma.club.create({data:{name:'Foreign synthetic',slug:randomUUID(),tagline:'',description:'',color:'#fff',category:'Other'}});
 const foreignMember=await prisma.clubMember.create({data:{clubId:foreign.id,userId:one.id,permissions:['applications.review','applicants.identify']}});
 const foreignRound=await prisma.pipelineRound.create({data:{clubId:foreign.id,name:'Interview',order:0}});
 const foreignApp=await prisma.application.create({data:{clubId:foreign.id,studentId:outsider.id,roundId:foreignRound.id,status:'INTERVIEWING'}});
 const foreignEvaluation=await prisma.evaluation.create({data:{applicationId:foreignApp.id,interviewerId:foreignMember.id,roundId:foreignRound.id,round:'Interview',score:10,submittedAt:new Date()}});
 await prisma.interviewRecord.create({data:{applicationId:foreignApp.id,interviewerId:foreignMember.id,roundId:foreignRound.id,anonymousReview:false,questions:[],draft:{...first.draft,score:10},completedAt:new Date(),evaluationId:foreignEvaluation.id}});
 assert.deepEqual((await a.kits.getPreviousInterviewScores(scope)).map(r=>r.id),expected);
 await own.members.setInterviewPanelAssignment({...scope,memberId:twoMember.id,assigned:false});
 await assert.rejects(b.kits.openInterviewSession(scope),/panel/);await assert.rejects(b.resume.getInterviewResumeAnnotations(ds),/panel/);
 // A revocation holds the same club serialization lock as grants. A pending read
 // must recheck after commit, rather than use an authorization captured beforehand.
 let release,locked;const ready=new Promise(resolve=>locked=resolve),hold=new Promise(resolve=>release=resolve);
 const revoke=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;locked();await hold;await tx.interviewPanelAssignment.update({where:{applicationId_roundId_memberId:{applicationId:app.id,roundId:round.id,memberId:oneMember.id}},data:{revokedAt:new Date()}});});
 await ready;const pending=a.kits.openInterviewSession(scope);release();await revoke;await assert.rejects(pending,/panel/);
 assert.equal((await prisma.interviewResumeDocument.findUnique({where:{id:document.id}})).contentHash,document.contentHash);
 const audit=await prisma.auditLog.findMany({where:{clubId:club.id}});assert.doesNotMatch(JSON.stringify(audit),/Comment one|Edit A|Only interviewer/);
});
