const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),{fixture}=require('./helpers/panel-publication-fixture.cjs')
const ok=result=>{assert.equal(result.ok,true,result.error);return result.value}

// QA 2026-11-12: Manage room -> Add dates created a second room with the same name.
test('Add dates from Manage room adds times to that room; no new room is created',async t=>{
 const h=await fixture(t),room=h.roomIds[0],before=await h.snapshot(),count=id=>before.InterviewSlot.filter(s=>s.roomId===id).length
 // 10:00-10:30 Eastern on Nov 13, 2030 fits one 30-minute interview in this room.
 const added=await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:room,dates:['2030-11-13'],start:'10:00',end:'10:30',capacity:2})
 assert.deepEqual(added,{id:room,count:1})
 const after=await h.snapshot()
 assert.equal(after.InterviewRoom.length,before.InterviewRoom.length,'no new room');assert.deepEqual(after.InterviewRoom,before.InterviewRoom,'room settings unchanged')
 assert.equal(after.InterviewSlot.filter(s=>s.roomId===room).length,count(room)+1);assert.equal(after.InterviewSlot.filter(s=>s.roomId===h.roomIds[1]).length,count(h.roomIds[1]))
 const slot=after.InterviewSlot.find(s=>!before.InterviewSlot.some(b=>b.id===s.id))
 assert.equal(slot.startTime.toISOString(),'2030-11-13T15:00:00.000Z');assert.equal(slot.endTime.toISOString(),'2030-11-13T15:30:00.000Z')
 assert.equal(slot.clubId,h.ids.club);assert.equal(slot.location,'A');assert.equal(slot.capacity,2);assert.equal(slot.panelScheduleVersionId,null);assert.deepEqual(slot.publishedPanelMemberIds,[]);assert.equal(slot.interviewersNeeded,null)
 const audit=(await h.db.query('SELECT "actorId","clubId",details FROM "AuditLog" WHERE action=\'interview.room.times.add\' AND "targetId"=$1',[room])).rows
 assert.equal(audit.length,1);assert.equal(audit[0].actorId,h.ids.owner);assert.deepEqual(audit[0].details,{count:1,dates:['2030-11-13']})
})

test('adding times keeps overlap, authorization, club scope and published-panel rules',async t=>{
 const h=await fixture(t),room=h.roomIds[0],input={clubId:h.ids.club,roomId:room,dates:['2030-11-13'],start:'10:00',end:'10:30',capacity:1}
 await h.generate();ok(await h.confirm(ok(await h.review())))
 const official=await h.snapshot()
 // Times that overlap this room's own sessions are refused (09:00 UTC on Oct 12 2030 is 05:00 Eastern).
 await assert.rejects(h.rooms.addInterviewRoomTimes({...input,dates:['2030-10-12'],start:'05:00',end:'05:30'}),/overlap/)
 await assert.rejects(h.rooms.addInterviewRoomTimes({...input,dates:['2020-01-06']}),/future/)
 // Another club's owner, a non-member and a foreign club id are refused without writes.
 const foreign=randomUUID(),foreignClub=randomUUID();await h.db.query('INSERT INTO "User"(id,email) VALUES ($1,$2)',[foreign,'foreign@virginia.edu']);await h.db.query('INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ($1,\'foreign-club\',\'Foreign\',\'\',\'\',\'\',\'\')',[foreignClub]);await h.db.query('INSERT INTO "ClubMember"(id,"clubId","userId","isOwner",permissions,"interviewOffices") VALUES ($1,$2,$3,true,\'{}\',\'{PRESIDENT}\')',[randomUUID(),foreignClub,foreign])
 h.as(foreign);await assert.rejects(h.rooms.addInterviewRoomTimes(input));await assert.rejects(h.rooms.addInterviewRoomTimes({...input,clubId:foreignClub}),/Room unavailable/)
 h.as(h.ids.student);await assert.rejects(h.rooms.addInterviewRoomTimes(input))
 await h.db.query('UPDATE "ClubMember" SET permissions=\'{applications.review}\' WHERE id=$1',[h.ids.peerMember]);h.as(h.ids.peer);await assert.rejects(h.rooms.addInterviewRoomTimes(input))
 assert.deepEqual((await h.snapshot()).InterviewSlot,official.InterviewSlot)
 // A manager adds to a room with an official published panel: existing panels are untouched and the new time has none until published.
 h.as(h.ids.scheduler);assert.equal((await h.rooms.addInterviewRoomTimes(input)).count,1)
 const after=await h.snapshot(),fresh=after.InterviewSlot.filter(s=>!official.InterviewSlot.some(o=>o.id===s.id))
 assert.equal(fresh.length,1);assert.equal(fresh[0].roomId,room);assert.equal(fresh[0].panelScheduleVersionId,null);assert.deepEqual(fresh[0].publishedPanelMemberIds,[])
 for(const slot of official.InterviewSlot)assert.deepEqual(after.InterviewSlot.find(s=>s.id===slot.id),slot)
 assert.equal(after.InterviewRoom.length,official.InterviewRoom.length);assert.deepEqual(after.InterviewPanelScheduleVersion,official.InterviewPanelScheduleVersion)
})

test('Manage room "Add dates" submits to the managed room, not room creation',()=>{
 const dialog=fs.readFileSync('components/interviews/create-room-dialog.tsx','utf8'),manager=fs.readFileSync('components/interviews/room-manager.tsx','utf8')
 assert.match(dialog,/if\(source\)\{const parsed=roomTimesInputSchema\.safeParse\(\{clubId,roomId:source\.id,/)
 assert.match(dialog,/await addInterviewRoomTimes\(parsed\.data\)\}else\{/)
 assert.match(manager,/onCopy=\{\(\) => \{ setSource\(room\); setCreate\(true\) \}\}/)
 assert.match(manager,/Add dates<\/Button>/)
})

test('demo "Add dates" adds to the managed room through the client boundary without server calls',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts')
 demoStore.start();let clubId,roundId
 demoStore.mutate(s=>{const c=s.clubs[0];clubId=c.id;roundId=c.rounds[0].id;c.rounds[0].type='INTERVIEW';s.perspective={role:'leader',clubId};s.interviewRooms=[];s.roomBookings=[]})
 await api.createInterviewRoom({clubId,roundId,name:'Rice Hall 340',location:'Rice Hall 340',kind:'IN_PERSON',timezone:'America/New_York',dates:['2099-09-07'],start:'10:00',end:'11:00',duration:20,buffer:0,capacity:1,interviewersNeeded:1,panelMemberIds:[]})
 const room=(await api.getRoomWorkspace(clubId)).rooms[0];assert.equal(room.slots.length,3)
 assert.deepEqual(await api.addInterviewRoomTimes({clubId,roomId:room.id,dates:['2099-09-08'],start:'10:00',end:'10:25',capacity:1}),{id:room.id,count:1})
 const rooms=(await api.getRoomWorkspace(clubId)).rooms;assert.equal(rooms.length,1);assert.equal(rooms[0].slots.length,4)
 await assert.rejects(api.addInterviewRoomTimes({clubId,roomId:room.id,dates:['2099-09-07'],start:'10:00',end:'10:20',capacity:1}),/overlapping/)
 assert.equal(h.calls(),0)
})
