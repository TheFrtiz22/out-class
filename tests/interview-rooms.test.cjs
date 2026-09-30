const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function loader(mocks = {}) {
  const cache = {}
  function load(file) {
    const absolute = path.resolve(file)
    if(cache[absolute])return cache[absolute].exports
    const mod = { exports: {} };cache[absolute]=mod
    const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(absolute),n)+'.ts'):require(n),mod,mod.exports)
    return mod.exports
  }
  return load
}
const core=loader()('lib/interview-rooms.ts')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input=()=>({clubId:id(1),roundId:id(2),name:'Shannon 318C',location:'Shannon 318C',kind:'IN_PERSON',timezone:'America/New_York',dates:['2099-09-07'],start:'10:00',end:'12:00',duration:20,buffer:5,capacity:2,panelMemberIds:[]})
test('slot generation respects time zones, buffers, repeated dates and unused trailing time',()=>{
 const slots=core.roomSlots(input())
 assert.equal(slots.length,5)
 assert.equal(slots[0].startTime.toISOString(),'2099-09-07T14:00:00.000Z')
 assert.equal(slots[1].startTime.toISOString(),'2099-09-07T14:25:00.000Z')
 assert.equal(core.roomSlots({...input(),dates:['2099-09-07','2099-09-07','2099-09-08']}).length,10)
 assert.equal(core.dayKey('2099-09-08T02:00:00Z','America/New_York'),'2099-09-07')
})
test('invalid dates, past windows, DST gaps/ambiguity and unsafe virtual links are rejected',()=>{
 assert.throws(()=>core.zonedInstant('2026-02-30','10:00','UTC'),/valid date/)
 assert.throws(()=>core.zonedInstant('2026-03-08','02:30','America/New_York'),/daylight/)
 assert.throws(()=>core.zonedInstant('2026-11-01','01:30','America/New_York'),/daylight/)
 assert.throws(()=>core.roomSlots({...input(),dates:['2020-01-01']}),/future/)
 assert.throws(()=>core.roomSlots({...input(),end:'09:00'}),/after/)
 assert.throws(()=>core.roomSlots({...input(),end:'10:10'}),/at least one/)
 assert.equal(core.roomInputSchema.safeParse({...input(),kind:'VIRTUAL',location:'javascript:alert(1)'}).success,false)
 assert.equal(core.roomInputSchema.safeParse({...input(),timezone:'Not/AZone'}).success,false)
})
function apiHarness() {
 const room={...input(),id:id(3),isOpen:true}
 const slot={id:id(4),clubId:id(1),roomId:room.id,room,startTime:new Date('2099-09-07T14:00Z'),endTime:new Date('2099-09-07T14:20Z'),capacity:1,_count:{bookings:0}}
 const app={id:id(5),studentId:id(6),clubId:id(1),roundId:id(2),status:'INTERVIEWING'}
 const state={room,slot,app,existing:null,others:[],created:[],deleted:[],audit:[],permission:true,retries:0,attempts:0,failCreate:false}
 const tx={
  $queryRaw:async()=>[],
  application:{findFirst:async({where})=>state.app && where.id===state.app.id && where.studentId===state.app.studentId?state.app:null},
  interviewSlot:{findUnique:async()=>state.slot,findMany:async()=>state.others},
  pipelineRound:{findFirst:async({where})=>where.id===id(2)&&where.clubId===id(1)?{id:id(2)}:null},
  clubMember:{count:async()=>0},
  interviewRoom:{create:async({data})=>{state.created.push(data);return {id:id(3)}},update:async()=>{}},
  auditLog:{create:async({data})=>state.audit.push(data)},
  interviewBooking:{findUnique:async()=>state.existing,findMany:async()=>state.others,findFirst:async({where})=>state.existing?.id===where.id&&state.app.studentId===where.application.studentId?state.existing:null,delete:async({where})=>state.deleted.push(where.id),create:async({data})=>{if(state.failCreate)throw Error('Write failed');state.created.push(data);return{id:id(8),...data}}}
 }
 const load=loader({'@/utils/auth':{requireAuth:async()=>({user:{id:id(6)}}),requireClubPermission:async()=>{if(!state.permission)throw Error('Denied');return{user:{id:id(6)},membership:{permissions:['interviews.manage']}}}},'@/utils/prisma':{prisma:{$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');state.attempts++;if(state.retries-->0)throw{code:'P2034'};const before={created:[...state.created],deleted:[...state.deleted],audit:[...state.audit]};try{return await fn(tx)}catch(e){Object.assign(state,before);throw e}},interviewRoom:{findUnique:async()=>room}}},'next/cache':{revalidatePath(){}}})
 return {state,api:load('actions/interview-rooms.ts')}
}
test('booking rejects ownership, invitation, club, round, capacity, past time and paused rooms',async()=>{
 for(const edit of [s=>s.app.studentId=id(7),s=>s.app.status='SUBMITTED',s=>s.slot.clubId=id(9),s=>s.room.roundId=id(9),s=>s.slot._count.bookings=1,s=>s.slot.startTime=new Date(0),s=>s.room.isOpen=false]){
  const {api,state}=apiHarness();edit(state)
  await assert.rejects(api.reserveInterview({applicationId:id(5),slotId:id(4)}));assert.equal(state.created.length,0)
 }
})
test('booking is idempotent, retries serialization, and refuses cross-club student overlaps',async()=>{
 const {api,state}=apiHarness();state.retries=2
 const result=await api.reserveInterview({applicationId:id(5),slotId:id(4)})
 assert.equal(result.id,id(8));assert.equal(state.attempts,3);assert.equal(state.created[0].roundId,id(2))
 state.existing={id:id(8),slotId:id(4),slot:state.slot}
 await api.reserveInterview({applicationId:id(5),slotId:id(4)});assert.equal(state.created.length,1)
 const second=apiHarness();second.state.others=[{applicationId:id(90),slot:second.state.slot}]
 await assert.rejects(second.api.reserveInterview({applicationId:id(5),slotId:id(4)}),/already have an interview/)
})
test('rescheduling replaces only on success, and cancellation checks ownership and start time',async()=>{
 const {api,state}=apiHarness();state.existing={id:id(8),slotId:id(9),slot:{...state.slot,startTime:new Date('2099-09-08T14:00Z')}};state.failCreate=true
 await assert.rejects(api.reserveInterview({applicationId:id(5),slotId:id(4)}),/Write failed/)
 assert.deepEqual(state.deleted,[])
 state.failCreate=false;await api.reserveInterview({applicationId:id(5),slotId:id(4)});assert.deepEqual(state.deleted,[id(8)])
 state.deleted=[];state.app.studentId=id(70);await assert.rejects(api.cancelRoomBooking(id(8)),/not found/);assert.equal(state.deleted.length,0)
 state.app.studentId=id(6);state.existing.slot.startTime=new Date(0);await assert.rejects(api.cancelRoomBooking(id(8)),/already started/)
 state.existing.slot.startTime=new Date('2099-09-08T14:00Z');await api.cancelRoomBooking(id(8));assert.deepEqual(state.deleted,[id(8)])
})
test('room creation checks permission, round, panel membership, and overlapping location/panel windows',async()=>{
 const denied=apiHarness();denied.state.permission=false;await assert.rejects(denied.api.createInterviewRoom(input()),/Denied/)
 const h=apiHarness();await assert.rejects(h.api.createInterviewRoom({...input(),roundId:id(99)}),/round/)
 await assert.rejects(h.api.createInterviewRoom({...input(),panelMemberIds:[id(50)]}),/interviewers/)
 h.state.others=[{...h.state.slot,location:'Shannon 318C'}];await assert.rejects(h.api.createInterviewRoom(input()),/overlapping/)
 h.state.others=[];const result=await h.api.createInterviewRoom(input());assert.equal(result.count,5);assert.equal(h.state.created[0].slots.create.length,5)
 assert.equal(h.state.audit[0].action,'interview.room.create')
})
test('SQL migration preserves legacy data and enforces capacity, round, overlap and browser isolation',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite()
 try{
  await db.exec(fs.readFileSync('prisma/migrations/20260923000000_baseline/migration.sql','utf8'))
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
   ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC;
   INSERT INTO "User" (id,email,role) VALUES ('u1','one@test.invalid','STUDENT'),('u2','two@test.invalid','STUDENT'),('u3','three@test.invalid','STUDENT');
   INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('c','c','Club','','','#123456','Test');
   INSERT INTO "PipelineRound" (id,"clubId",name,"order") VALUES ('r','c','Round 1',1),('r2','c','Round 2',2);
   INSERT INTO "Application" (id,"studentId","clubId","roundId",status) VALUES ('a1','u1','c','r','INTERVIEWING'),('a2','u2','c','r','INTERVIEWING'),('a3','u3','c','r','INTERVIEWING');
   INSERT INTO "InterviewSlot" (id,"clubId","startTime","endTime",location,capacity) VALUES ('legacy','c','2020-01-01','2020-01-01 01:00','Hall',1);
   INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('old','legacy','a1');`)
  await db.exec(fs.readFileSync('prisma/migrations/20260930000000_interview_rooms/migration.sql','utf8'))
  assert.equal((await db.query(`SELECT "roundId" FROM "InterviewBooking" WHERE id='old'`)).rows[0].roundId,null)
  await db.exec(`INSERT INTO "InterviewRoom" (id,"clubId","roundId",name,location,kind,timezone,duration) VALUES ('room','c','r','Hall','Hall','IN_PERSON','UTC',20);
   INSERT INTO "InterviewSlot" (id,"clubId","roomId","startTime","endTime",location,capacity) VALUES ('s1','c','room','2099-01-01 10:00','2099-01-01 10:20','Hall',2),('s2','c','room','2099-01-01 11:00','2099-01-01 11:20','Hall',2);`)
  const attempts=await Promise.allSettled([1,2,3].map(n=>db.query('INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ($1,$2,$3)',[`b${n}`,'s1',`a${n}`])))
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2)
  assert.equal((await db.query(`SELECT COUNT(*)::int AS n FROM "InterviewBooking" WHERE "slotId"='s1'`)).rows[0].n,2)
  await assert.rejects(db.exec(`INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('dup','s2','a1')`),/unique/)
  await db.exec(`INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('other','other','Other','','','#123456','Test');
    INSERT INTO "PipelineRound" (id,"clubId",name,"order") VALUES ('other-round','other','Interview',1);
    INSERT INTO "Application" (id,"studentId","clubId","roundId",status) VALUES ('other-app','u1','other','other-round','INTERVIEWING');
    INSERT INTO "InterviewRoom" (id,"clubId","roundId",name,location,kind,timezone,duration) VALUES ('other-room','other','other-round','Other','Other','IN_PERSON','UTC',20);
    INSERT INTO "InterviewSlot" (id,"clubId","roomId","startTime","endTime",location,capacity) VALUES ('overlap','other','other-room','2099-01-01 10:10','2099-01-01 10:30','Other',2);`)
  await assert.rejects(db.exec(`INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('overlap-booking','overlap','other-app')`),/already have an interview/)
  await db.exec(`UPDATE "Application" SET "roundId"='r2' WHERE id='a3'`)
  await assert.rejects(db.exec(`INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('wrong','s2','a3')`),/invitation/)
  await db.exec(`UPDATE "InterviewRoom" SET "isOpen"=false WHERE id='room'`)
  await assert.rejects(db.exec(`INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('paused','s2','a2')`),/no longer/)
  await db.exec('SET ROLE anon')
  await assert.rejects(db.query('SELECT * FROM "InterviewRoom"'),/permission denied/)
  await db.exec('RESET ROLE')
 }finally{await db.close()}
})
