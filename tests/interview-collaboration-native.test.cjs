const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path'),{randomUUID}=require('node:crypto');
const databaseUrl=process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
function actor(prisma,userId){const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const mocks={'@/utils/prisma':{prisma},'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'next/cache':{revalidatePath(){}}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports;}return{rooms:load('actions/interview-collaboration.ts'),kits:load('actions/interview-kits.ts')};}
test('native collaboration: ordered simultaneous picks, revision conflicts, exact queue advancement, invitations and revocation',{skip:!databaseUrl,timeout:90000},async t=>{
 const url=new URL(databaseUrl);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/outclass_security_test');const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:databaseUrl,log:[]});t.after(()=>db.$disconnect());
 const [identity]=await db.$queryRaw`SELECT current_database() AS name,host(inet_server_addr()) AS address`;assert.equal(identity.name,'outclass_security_test');assert.equal(identity.address,'127.0.0.1');
 const people=await Promise.all(Array.from({length:6},()=>db.user.create({data:{email:randomUUID()+'@virginia.edu'}})));const [one,two,student,nextStudent,outsider,owner]=people;
 const club=await db.club.create({data:{slug:randomUUID(),name:'Synthetic collaboration native fixture',tagline:'',description:'Disposable local fixture',color:'#fff',category:'Other'}});
 const members=await Promise.all([one,two,owner].map((u,i)=>db.clubMember.create({data:{clubId:club.id,userId:u.id,isOwner:i===2,permissions:['applications.review','applicants.identify']}})));const [aMember,bMember]=members;
 const q=[0,1].map(i=>({id:randomUUID(),prompt:'Preserved '+i,guidance:'Answer key '+i}));const round=await db.pipelineRound.create({data:{clubId:club.id,name:'Interview',order:0,interviewKit:q}});
 const apps=await Promise.all([student,nextStudent].map(u=>db.application.create({data:{studentId:u.id,clubId:club.id,roundId:round.id,status:'INTERVIEWING'}})));
 for(const app of apps)for(const m of [aMember,bMember])await db.interviewPanelAssignment.create({data:{applicationId:app.id,roundId:round.id,memberId:m.id,grantedBy:owner.id}});
 const a=actor(db,one.id),b=actor(db,two.id),scope={clubId:club.id,roundId:round.id,applicationId:apps[0].id},aInput={...scope,clientId:randomUUID()},bInput={...scope,clientId:randomUUID()};
 await Promise.all([a.kits.openInterviewSession(scope),b.kits.openInterviewSession(scope)]);await Promise.all([a.rooms.getInterviewCollaboration(aInput),b.rooms.getInterviewCollaboration(bInput)]);
 // Routine refreshes keep current authorization locked without serializing all
 // reviewers' private saves/downloads behind an exclusive applicant lock.
 const locks=[];const observed=new Proxy(db,{get(target,key){if(key==='$transaction')return(fn,options)=>target.$transaction(tx=>fn(new Proxy(tx,{get(client,method){if(method==='$queryRaw')return(strings,...values)=>{locks.push(strings.join('?'));return client.$queryRaw(strings,...values)};return client[method]}})),options);return target[key]}});
 await actor(observed,one.id).rooms.getInterviewCollaboration(aInput);
 assert.ok(locks.some(sql=>sql.includes('FROM "Application"')&&sql.includes('FOR SHARE')));
 assert.ok(!locks.some(sql=>sql.includes('FROM "Application"')&&sql.includes('FOR UPDATE')));
 const picks=await Promise.all([a.rooms.selectSharedInterviewQuestion({...aInput,questionId:q[0].id}),b.rooms.selectSharedInterviewQuestion({...bInput,questionId:q[1].id})]);assert.deepEqual(picks.map(p=>p.revision).sort(),[1,2]);
 const [av,bv]=await Promise.all([a.rooms.getInterviewCollaboration(aInput),b.rooms.getInterviewCollaboration(bInput)]);assert.deepEqual(av.selection,bv.selection);assert.equal(av.revision,2);assert.equal(av.participants.length,2);
 const draft=(await a.kits.openInterviewSession(scope)).draft;
 const conflicts=await Promise.allSettled(['older tab','other tab'].map(notes=>a.kits.saveInterviewSession({...scope,revision:0,draft:{...draft,additionalNotes:notes}})));assert.equal(conflicts.filter(r=>r.status==='fulfilled').length,1);assert.equal((await b.kits.openInterviewSession(scope)).draft.additionalNotes,undefined);
 await assert.rejects(actor(db,outsider.id).rooms.getInterviewCollaboration(aInput));await assert.rejects(actor(db,student.id).rooms.getInterviewCollaboration(aInput));
 await a.kits.saveInterviewSession({...scope,revision:1,draft:{...(await a.kits.openInterviewSession(scope)).draft,score:8.5},complete:true});
 const move=await a.rooms.prepareInterviewAdvance(aInput);assert.equal(move.scope.applicationId,apps[1].id);assert.equal((await b.rooms.getInterviewCollaboration(bInput)).invitation,null);
 await a.kits.openInterviewSession(move.scope);await Promise.all([a.rooms.confirmInterviewAdvance({moveId:move.moveId,clientId:aInput.clientId}),a.rooms.confirmInterviewAdvance({moveId:move.moveId,clientId:aInput.clientId})]);
 const invite=(await b.rooms.getInterviewCollaboration(bInput)).invitation;assert.ok(invite);await assert.rejects(b.rooms.prepareInterviewAdvance({...bInput,invitationId:invite.id}),/Finish/);
 await b.rooms.dismissInterviewInvitation({...bInput,invitationId:invite.id});assert.equal((await b.rooms.getInterviewCollaboration(bInput)).invitation,null);assert.equal((await b.kits.openInterviewSession(scope)).completedAt,null);
 await db.interviewPanelAssignment.updateMany({where:{memberId:bMember.id},data:{revokedAt:new Date()}});await assert.rejects(b.rooms.getInterviewCollaboration(bInput));assert.equal((await a.rooms.getInterviewCollaboration(aInput)).participants.length,1);
});
