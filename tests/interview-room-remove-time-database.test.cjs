const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),{fixture}=require('./helpers/panel-publication-fixture.cjs')
const ok=result=>{assert.equal(result.ok,true,result.error);return result.value}
const window={start:'2030-10-12T00:00:00.000Z',end:'2030-10-13T00:00:00.000Z'}
const lists=async(h,slotId)=>{
 const planning=await h.load('utils/panel-planning.ts').loadPanelPlanningScene(h.prisma,h.scope,window)
 const coverage=await h.load('utils/interview-booking.ts').interviewBookingCoverage(h.prisma,h.ids.club,h.ids.round)
 return {planning:planning.scene.sessions.some(s=>s.id===slotId),coverage:coverage.some(c=>c.slotId===slotId),room:(await h.snapshot()).InterviewSlot.some(s=>s.id===slotId)}
}

test('Remove time deletes an unbooked, unstaffed time, audits it, and it disappears from room, planning and booking lists',async t=>{
 const h=await fixture(t),slot=h.slotIds[3],room=h.roomIds[1]
 assert.deepEqual(await lists(h,slot),{planning:true,coverage:true,room:true})
 h.as(h.ids.scheduler);assert.deepEqual(await h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot}),{removed:slot})
 assert.deepEqual(await lists(h,slot),{planning:false,coverage:false,room:false})
 const audit=(await h.db.query('SELECT "actorId",details FROM "AuditLog" WHERE action=\'interview.room.time.remove\' AND "targetId"=$1',[room])).rows
 assert.equal(audit.length,1);assert.equal(audit[0].actorId,h.ids.scheduler);assert.equal(audit[0].details.slotId,slot)
 await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot}),/Time unavailable/)
})

test('Remove time refuses booked, staffed and availability-exception times; un-staffing first then removing keeps published history',async t=>{
 const h=await fixture(t),[booked,staffed]=[h.slotIds[0],h.slotIds[1]],roomA=h.roomIds[0]
 await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:roomA,slotId:booked}),/has been booked/)
 await h.generate();ok(await h.confirm(ok(await h.review())))
 await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:roomA,slotId:staffed}),/interviewers in Edit Panels first/)
 // Un-staff through a publication, then the time can go; the immutable version still records it.
 ok(await h.publish.beginPanelScheduleRevision({...h.scope,publishedVersion:1}));const d=(await h.api.getPanelProposalWorkspace(h.scope)).proposal
 await h.api.savePanelProposalDraft({...h.input(d),assignments:d.document.assignments.filter(a=>a.slotId!==staffed)})
 const review=ok(await h.review());const published=ok(await h.publish.publishPanelSchedule({...h.scope,proposalId:review.proposalId,revision:review.revision,approvalToken:review.approvalToken,confirmUnstaff:true}))
 ok(await h.publish.beginPanelScheduleRevision({...h.scope,publishedVersion:2}))
 await h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:roomA,slotId:staffed})
 const after=await h.snapshot();assert.equal(after.InterviewSlot.some(s=>s.id===staffed),false)
 assert.ok(after.InterviewPanelScheduleVersion.find(v=>v.id===published.publicationId).document.sessions.some(s=>s.id===staffed),'published history is untouched')
 // The open draft that still lists the removed time must be refreshed before it can be approved.
 const stale=await h.review();assert.equal(stale.ok,false)
 // A time with an availability exception on record cannot be hard-deleted (append-only, ON DELETE RESTRICT).
 const roomB=h.roomIds[1],day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+30*86400000))
 const existing=new Set((await h.snapshot()).InterviewSlot.map(s=>s.id));await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:roomB,dates:[day],start:'10:00',end:'10:30',capacity:1})
 const other=(await h.snapshot()).InterviewSlot.find(s=>!existing.has(s.id)).id,row=(await h.db.query('SELECT "startTime","endTime" FROM "InterviewSlot" WHERE id=$1',[other])).rows[0]
 await h.db.exec('SET session_replication_role = replica')
 await h.db.query('INSERT INTO "InterviewAvailabilityOverride"(id,"clubId","roundId","slotId","memberId","createdBy","startTime","endTime",duration,buffer,conditions,"revokedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,30,0,\'{UNAVAILABLE}\',now())',[randomUUID(),h.ids.club,h.ids.round,other,h.ids.panelMember,h.ids.owner,row.startTime,row.endTime])
 await h.db.exec('SET session_replication_role = DEFAULT')
 await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:roomB,slotId:other}),/availability exception/)
 assert.ok((await h.snapshot()).InterviewSlot.some(s=>s.id===other))
})

test('Remove time is limited to interviews.manage in the slot\'s own club and room',async t=>{
 const h=await fixture(t),slot=h.slotIds[3],room=h.roomIds[1],before=await h.snapshot()
 const foreign=randomUUID(),foreignClub=randomUUID();await h.db.query('INSERT INTO "User"(id,email) VALUES ($1,$2)',[foreign,'foreign@virginia.edu']);await h.db.query('INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ($1,\'foreign-club\',\'Foreign\',\'\',\'\',\'\',\'\')',[foreignClub]);await h.db.query('INSERT INTO "ClubMember"(id,"clubId","userId","isOwner",permissions,"interviewOffices") VALUES ($1,$2,$3,true,\'{}\',\'{PRESIDENT}\')',[randomUUID(),foreignClub,foreign])
 h.as(foreign);await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot}));await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:foreignClub,roomId:room,slotId:slot}),/Time unavailable/)
 h.as(h.ids.student);await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot}))
 await h.db.query('UPDATE "ClubMember" SET permissions=\'{applications.review}\' WHERE id=$1',[h.ids.peerMember]);h.as(h.ids.peer);await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot}))
 h.as(h.ids.owner);await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:h.roomIds[0],slotId:slot}),/Time unavailable/)
 assert.deepEqual((await h.snapshot()).InterviewSlot,before.InterviewSlot)
})

test('a reservation racing Remove time never loses a booking',async t=>{
 const h=await fixture(t),slot=h.slotIds[3],room=h.roomIds[1],before=await h.snapshot()
 const [removed,reserved]=await Promise.allSettled([(async()=>{h.as(h.ids.owner);return h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:slot})})(),(async()=>{h.as(h.ids.student);return h.rooms.reserveInterview({applicationId:h.ids.app,slotId:slot})})()])
 const after=await h.snapshot(),slotLeft=after.InterviewSlot.some(s=>s.id===slot)
 assert.equal(after.InterviewBooking.length,before.InterviewBooking.length,'no booking is lost or duplicated')
 if(removed.status==='fulfilled')assert.equal(slotLeft,false);else assert.match(String(removed.reason?.message),/booked|unavailable|changed/)
 if(!slotLeft)assert.equal(after.InterviewBooking.some(b=>b.slotId===slot),false)
 assert.ok(reserved.status==='rejected'||after.InterviewBooking.some(b=>b.slotId===slot&&slotLeft))
 // Once a booking lands on a time, removal is refused under the same locks.
 await h.db.query('UPDATE "InterviewBooking" SET "slotId"=$1 WHERE "applicationId"=$2',[h.slotIds[2],h.ids.app])
 h.as(h.ids.owner);await assert.rejects(h.rooms.removeInterviewRoomTime({clubId:h.ids.club,roomId:room,slotId:h.slotIds[2]}),/has been booked/)
 assert.ok((await h.snapshot()).InterviewBooking.some(b=>b.slotId===h.slotIds[2]))
})

test('demo Remove time mirrors the live rules without server calls; Manage room shows it with a confirm',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts')
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+30*86400000))
 demoStore.start();let clubId,roundId
 demoStore.mutate(s=>{const c=s.clubs[0];clubId=c.id;roundId=c.rounds[0].id;c.rounds[0].type='INTERVIEW';s.perspective={role:'leader',clubId};s.interviewRooms=[];s.roomBookings=[]})
 await api.createInterviewRoom({clubId,roundId,name:'Rice Hall 340',location:'Rice Hall 340',kind:'IN_PERSON',timezone:'America/New_York',dates:[day],start:'10:00',end:'11:00',duration:20,buffer:0,capacity:1,interviewersNeeded:1,panelMemberIds:[]})
 const room=(await api.getRoomWorkspace(clubId)).rooms[0],[first,second]=room.slots
 assert.deepEqual(await api.removeInterviewRoomTime({clubId,roomId:room.id,slotId:first.id}),{removed:first.id})
 assert.deepEqual((await api.getRoomWorkspace(clubId)).rooms[0].slots.map(s=>s.id),room.slots.slice(1).map(s=>s.id))
 demoStore.mutate(s=>{s.roomBookings.push({id:'demo-booking',applicationId:'app',slotId:second.id,roomId:room.id,roundId,candidate:'Sample',startTime:second.startTime,endTime:second.endTime,location:room.location})})
 await assert.rejects(api.removeInterviewRoomTime({clubId,roomId:room.id,slotId:second.id}),/has been booked/)
 await assert.rejects(api.removeInterviewRoomTime({clubId,roomId:room.id,slotId:first.id}),/Time unavailable/)
 assert.equal(h.calls(),0)
 const manager=fs.readFileSync('components/interviews/room-manager.tsx','utf8')
 assert.match(manager,/title: "Remove this time\?", description: "It hasn't been booked\."/)
 assert.match(manager,/s\.booked===0&&!slotHasInterviewers\(s,room\)&&<Button/)
})
