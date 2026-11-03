const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const lib=load('lib/additional-observations.ts'),clubId=uuid(1),applicationId=uuid(2),id=uuid(3),author=uuid(4),other=uuid(5);
const command=(extra={})=>lib.observationSave.parse({clubId,applicationId,id,requestId:uuid(6),revision:null,body:'A specific firsthand observation.',...extra});
test('50-word validation is shared, whitespace-aware, optional context bounded and never truncates',()=>{
 for(const n of [1,49,50])assert.equal(lib.observationWordCount(command({body:Array(n).fill('word').join(' \n\t\u00a0')}).body),n);
 for(const n of [0,51])assert.throws(()=>command({body:Array(n).fill('word').join(' ')}));
 assert.throws(()=>command({interactionContext:'x'.repeat(161)}));const pasted='word '.repeat(51);assert.equal(lib.observationWordCount(pasted),51);assert.equal(pasted.length,255);
});
test('revision checks, lost-response retries, concurrent stale edits and locked author/moderator rules',()=>{
 const create=command(),one=lib.observationChange(null,create,author,false,false),old={authorId:author,...one};assert.equal(one.revision,1);
 assert.equal(lib.observationChange(old,create,author,false,false),null);
 assert.throws(()=>lib.observationChange(old,create,other,true,false),/another reviewer/);
 assert.throws(()=>lib.observationChange(old,command({body:'Changed'}),author,false,false),/different text/);
 const update=command({requestId:uuid(7),revision:1,body:'Latest interaction.'});
 assert.throws(()=>lib.observationChange(old,update,other,false,false),/Only the author/);
 assert.throws(()=>lib.observationChange(old,update,author,false,true),/locked/);
 assert.throws(()=>lib.observationChange(old,update,other,true,true),/reason/);
 const two=lib.observationChange(old,{...update,reason:'Corrected interaction context.'},other,true,true);assert.equal(two.revision,2);assert.deepEqual(two.history[0],one.history[0]);
 assert.throws(()=>lib.observationChange({...old,...two},update,author,false,false),/different text|changed/);
});
function harness(){let actor=author,allow=true,anonymous=false,own=false,cycle=uuid(9),rows=[],pins=[],audit=[],offline=false;
 const member={id:uuid(10),clubId,status:'ACTIVE',permissions:['applications.review','applicants.identify'],interviewOffices:[]};
 const app={id:applicationId,clubId,recruitmentCycleId:cycle,roundId:uuid(11),studentId:uuid(12),round:{anonymousReview:false}};
 const tx={application:{findFirst:async({where})=>where.clubId===clubId&&where.id===applicationId?{...app,studentId:own?actor:app.studentId,round:{anonymousReview:anonymous}}:null},pipelineRound:{findMany:async()=>anonymous?[]:[{id:app.roundId,name:'Current review'}]},applicantObservation:{findUnique:async({where})=>rows.find(r=>r.id===where.id)??null,create:async({data})=>{if(offline)throw Error('Offline');const now=new Date();rows.push({...data,createdAt:now,updatedAt:now,author:{studentProfile:{firstName:'QA',lastName:'Reviewer'}},presentationReferences:[]});},update:async({where,data})=>{if(offline)throw Error('Offline');Object.assign(rows.find(r=>r.id===where.id),data,{updatedAt:new Date()});},findMany:async({where})=>rows.filter(r=>r.applicationId===where.applicationId&&r.clubId===where.clubId&&r.cycleId===where.cycleId&&!r.deletedAt).map(r=>({...r,presentationReferences:pins.filter(p=>p.observationId===r.id)}))},votingObservationReference:{findFirst:async({where})=>pins.find(p=>p.observationId===where.observationId),createMany:async({data})=>pins.push(...structuredClone(data)),findMany:async({where})=>pins.filter(p=>p.sessionId===where.sessionId&&p.applicationId===where.applicationId)},auditLog:{create:async({data})=>audit.push(data)}};
 const authorize=async(_tx,c)=>{if(!allow||c!==clubId)throw Error('Review access denied');return member;};
 const mocks={'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'@/utils/auth':{requireClubPermission:async()=>({user:{id:actor}})},'@/lib/club-transaction-authorization':{authorizeClubTransaction:authorize},'@/utils/club-write-transaction':{clubWriteTransaction:fn=>fn(tx)}};
 const api=load('actions/additional-observations.ts',mocks),helper=load('utils/additional-observations.ts',mocks);
 return {api,helper,tx,rows,pins,audit,member,app,deny:()=>allow=false,anonymous:()=>anonymous=true,self:()=>own=true,as:v=>actor=v,offline:v=>offline=v};
}
test('create/edit/retry persists once, failures preserve input, author attribution and scoped reads',async()=>{
 const h=harness(),d=command();await h.api.saveAdditionalObservation(d);await h.api.saveAdditionalObservation(d);assert.equal(h.rows.length,1);assert.equal(h.audit.length,1);
 let result=await h.api.getAdditionalObservations({clubId,applicationId});assert.equal(result[0].author,'QA Reviewer');assert.equal(result[0].canEdit,true);assert.equal(result[0].body,d.body);assert.equal(result[0].roundId,h.app.roundId);
 const next=command({requestId:uuid(7),revision:1,body:'A new firsthand detail.'});h.offline(true);await assert.rejects(h.api.saveAdditionalObservation(next),/Offline/);assert.equal(next.body,'A new firsthand detail.');assert.equal(h.rows[0].revision,1);h.offline(false);await h.api.saveAdditionalObservation(next);assert.equal(h.rows[0].revision,2);assert.equal(h.rows[0].history[0].body,d.body);
 await assert.rejects(h.api.getAdditionalObservations({clubId:uuid(99),applicationId}),/denied/);h.as(other);await assert.rejects(h.api.saveAdditionalObservation({...next,requestId:uuid(8),revision:2}),/Only the author/);h.self();await assert.rejects(h.api.getAdditionalObservations({clubId,applicationId}),/unavailable/);
});
test('locking copies exact version; later moderation cannot rewrite it; deselection/anonymity withhold data',async()=>{
 const h=harness();await h.api.saveAdditionalObservation(command());const room={id:uuid(20),clubId,cycleId:h.app.recruitmentCycleId,roundId:h.app.roundId,candidates:[{applicationId}],startedAt:null};
 await h.helper.lockVotingObservations(h.tx,room,author);assert.equal(h.pins.length,1);const saved=structuredClone(h.pins[0]);
 await assert.rejects(h.api.saveAdditionalObservation(command({revision:1,requestId:uuid(7),body:'New text.'})),/locked/);
 h.member.interviewOffices=['PRESIDENT'];h.as(other);await h.api.saveAdditionalObservation(command({revision:1,requestId:uuid(7),body:'Moderated text.',reason:'Corrected attribution context.'}));assert.equal(h.audit.at(-1).action,'applicant.additional_observation.moderate');assert.deepEqual(h.pins[0],saved);
 room.startedAt=new Date();const result=await h.helper.votingObservations(h.tx,room,applicationId,other,true,false);assert.equal(result.additionalObservations[0].body,saved.snapshot.body);assert.equal(result.additionalObservations[0].revision,1);assert.equal('history'in result.additionalObservations[0],false);
 assert.deepEqual(await h.helper.votingObservations(h.tx,room,applicationId,other,false,false),{});assert.deepEqual(await h.helper.votingObservations(h.tx,room,applicationId,other,true,true),{});h.deny();await assert.rejects(h.helper.votingObservations(h.tx,room,applicationId,other,true,false),/denied/);
});
test('anonymous current review and revoked membership deny reads/writes',async()=>{
 const h=harness();h.anonymous();await assert.rejects(h.api.saveAdditionalObservation(command()),/unavailable/);await assert.rejects(h.api.getAdditionalObservations({clubId,applicationId}),/unavailable/);h.deny();await assert.rejects(h.api.saveAdditionalObservation(command()),/denied/);
});
test('Demo keeps observation revisions and frozen copies across refresh with zero live calls and read-only reads',async()=>{
 const {harness}=require('./helpers/demo-harness.cjs'),h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();try{
 demoStore.mutate(s=>{s.perspective={role:'leader',clubId:s.clubs[0].id};s.memberships.find(m=>m.clubId===s.clubs[0].id&&m.isOwner).interviewOffices=[];});
 const state=demoStore.get(),club=state.clubs[0],leader=state.memberships.find(m=>m.clubId===club.id&&m.isOwner),app=state.applications.find(a=>a.clubId===club.id&&a.studentId!==leader.userId&&a.status!=='DRAFTING'&&!club.rounds.find(r=>r.id===a.roundId)?.anonymousReview),api=h.load('lib/additional-observations-api.ts'),helper=h.load('lib/demo/additional-observations.ts');
 const d={clubId:club.id,applicationId:app.id,id:crypto.randomUUID(),requestId:crypto.randomUUID(),revision:null,body:'A fictional firsthand event observation.',interactionContext:'Synthetic event',reason:'',remove:false};await api.saveAdditionalObservation(d);await api.saveAdditionalObservation(d);
 let writes=0;const save=localStorage.setItem.bind(localStorage);localStorage.setItem=(...args)=>{writes++;return save(...args);};let rows=await api.getAdditionalObservations({clubId:club.id,applicationId:app.id});assert.equal(rows.length,1);assert.equal(rows[0].revision,1);assert.equal(writes,0);demoStore.refresh();rows=await api.getAdditionalObservations({clubId:club.id,applicationId:app.id});assert.equal(rows[0].body,d.body);
 const room={id:crypto.randomUUID(),clubId:club.id,candidates:[{applicationId:app.id}],startedAt:new Date()};demoStore.mutate(s=>helper.pinDemoObservations(s,room));assert.equal(helper.demoVotingObservations(demoStore.get(),room,app.id,leader.userId,true,false).additionalObservations[0].revision,1);await assert.rejects(api.saveAdditionalObservation({...d,requestId:crypto.randomUUID(),revision:1,body:'Attempted edit.'}),/locked/);
 demoStore.mutate(s=>s.memberships.find(m=>m.id===leader.id).status='REVOKED');await assert.rejects(api.getAdditionalObservations({clubId:club.id,applicationId:app.id}),/unavailable/);assert.equal(h.calls(),0);
 }finally{demoStore.stop();}
});
