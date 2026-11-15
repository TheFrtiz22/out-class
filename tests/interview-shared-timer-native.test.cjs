// Actual independent Prisma/PostgreSQL connections as the bounded runtime role; Auth identity is synthetic.
// Never inherits application DATABASE_URL or touches a hosted project.
const {unwrapActions}=require('./helpers/action-result.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path'),{randomUUID}=require('node:crypto');
const databaseUrl=process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
function actor(prisma,userId){const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const mocks={'@/utils/prisma':{prisma},'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'next/cache':{revalidatePath(){}}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports;}return{rooms:unwrapActions(load('actions/interview-collaboration.ts')),kits:unwrapActions(load('actions/interview-kits.ts')),timer:unwrapActions(load('actions/interview-timer.ts'))};}
test('native shared timer: runtime-role writes, simultaneous presses on separate connections, idempotent retries and access refusal',{skip:!databaseUrl,timeout:120000},async t=>{
 const url=new URL(databaseUrl);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/outclass_security_test');
 const runtime=new URL(databaseUrl);runtime.username='outclass_production_app';
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:runtime.toString(),log:[]}),other=new PrismaClient({datasourceUrl:runtime.toString(),log:[]});t.after(()=>Promise.all([db.$disconnect(),other.$disconnect()]));
 const [identity]=await db.$queryRaw`SELECT current_user AS role,current_database() AS name`;assert.equal(identity.role,'outclass_production_app');assert.equal(identity.name,'outclass_security_test');
 const people=await Promise.all(Array.from({length:5},()=>db.user.create({data:{email:randomUUID()+'@demo.invalid'}})));const [one,two,student,outsider,owner]=people;
 const club=await db.club.create({data:{slug:randomUUID(),name:'Synthetic shared timer native fixture',tagline:'',description:'Disposable local fixture',color:'#fff',category:'Other'}});
 const members=await Promise.all([one,two,owner,outsider].map((u,i)=>db.clubMember.create({data:{clubId:club.id,userId:u.id,isOwner:i===2,permissions:['applications.review','applicants.identify']}})));
 const round=await db.pipelineRound.create({data:{clubId:club.id,name:'Interview',order:0,interviewKit:[{id:randomUUID(),prompt:'Q',guidance:''}],configuration:{duration:20}}});
 const app=await db.application.create({data:{studentId:student.id,clubId:club.id,roundId:round.id,status:'INTERVIEWING'}});
 for(const m of members.slice(0,2))await db.interviewPanelAssignment.create({data:{applicationId:app.id,roundId:round.id,memberId:m.id,grantedBy:owner.id}});
 // Two interviewers on two separate connection pools (two "servers").
 const a=actor(db,one.id),b=actor(other,two.id),scope={clubId:club.id,roundId:round.id,applicationId:app.id};
 await Promise.all([a.kits.openInterviewSession(scope),b.kits.openInterviewSession(scope)]);
 const [ra,rb]=await Promise.all([a.rooms.getInterviewCollaboration({...scope,clientId:randomUUID()}),b.rooms.getInterviewCollaboration({...scope,clientId:randomUUID()})]);
 assert.equal(ra.sessionId,rb.sessionId);assert.equal(ra.timer.revision,0);assert.equal(ra.timer.durationMs,20*60000);
 const press=(api,revision,command,requestId=randomUUID())=>api.timer.controlInterviewTimer({...scope,revision,requestId,command});
 // Simultaneous first presses: exactly one creates the row, the other is handed it.
 const starts=await Promise.all([press(a,0,{type:'start'}),press(b,0,{type:'start'})]);
 assert.deepEqual(starts.map(r=>r.status).sort(),['conflict','ok']);assert.ok(starts.every(r=>r.timer.revision===1&&r.timer.startedAt!==null));
 // Many simultaneous presses at the same revision: one wins, revisions stay contiguous.
 const burst=await Promise.all(Array.from({length:6},(_,i)=>press(i%2?a:b,1,{type:'adjust',deltaMs:60000})));
 assert.equal(burst.filter(r=>r.status==='ok').length,1);
 let row=await db.interviewTimer.findUniqueOrThrow({where:{sessionId:ra.sessionId}});assert.equal(row.revision,2);assert.equal(row.durationMs,21*60000);
 // A retried request ID on another connection applies once.
 const id=randomUUID(),[p1,p2]=await Promise.all([press(a,2,{type:'pause'},id),press(a,2,{type:'pause'},id)]);
 assert.ok([p1,p2].every(r=>r.timer.revision===3));row=await db.interviewTimer.findUniqueOrThrow({where:{sessionId:ra.sessionId}});assert.equal(row.revision,3);assert.ok(row.pausedAt);
 assert.equal((await b.rooms.getInterviewCollaboration({...scope,clientId:randomUUID()})).timer.revision,3);
 // Applicant and an unassigned member are refused; nothing changes.
 await assert.rejects(press(actor(db,student.id),3,{type:'reset'}),{message:'You no longer have access to this interview.',code:'ACCESS_REVOKED'});
 await assert.rejects(press(actor(db,outsider.id),3,{type:'reset'}),{message:'You no longer have access to this interview.',code:'ACCESS_REVOKED'});
 assert.equal((await db.interviewTimer.findUniqueOrThrow({where:{sessionId:ra.sessionId}})).revision,3);
 // The database guard refuses a skipped revision from the runtime role.
 await assert.rejects(db.$executeRaw`UPDATE "InterviewTimer" SET revision=revision+2 WHERE "sessionId"=${ra.sessionId}`,/revision mismatch/);
});
