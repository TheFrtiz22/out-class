const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),{fixture}=require('./helpers/panel-publication-fixture.cjs')
const ok=result=>{assert.equal(result.ok,true,result.error);return result.value}
// Eastern calendar day `days` from now (added times must be within the next year).
const day=days=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+days*86400000))
const approveRoom=async(h,room,memberIds)=>{
 await h.db.query('UPDATE "InterviewRoom" SET "panelMemberIds"=$1 WHERE id=$2',['{'+memberIds.join(',')+'}',room])
 const revision=(await h.db.query('SELECT "panelApprovalRevision" FROM "InterviewRoom" WHERE id=$1',[room])).rows[0].panelApprovalRevision
 await h.load('actions/interview-access-setup.ts').approveInterviewRoomPanel({clubId:h.ids.club,roomId:room,revision,panelMemberIds:memberIds,confirm:true})
}

// QA 2026-11-12: Manage room -> Add dates created a second room with the same name.
test('Add dates from Manage room adds times to that room; no new room is created',async t=>{
 const h=await fixture(t),room=h.roomIds[0],before=await h.snapshot(),count=id=>before.InterviewSlot.filter(s=>s.roomId===id).length
 // 10:00-10:30 Eastern fits one 30-minute interview in this room.
 const date=day(30),core=h.load('lib/interview-rooms.ts')
 const added=await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:room,dates:[date],start:'10:00',end:'10:30',capacity:2})
 assert.deepEqual(added,{id:room,count:1,noLongerOffered:0})
 const after=await h.snapshot()
 assert.equal(after.InterviewRoom.length,before.InterviewRoom.length,'no new room');assert.deepEqual(after.InterviewRoom,before.InterviewRoom,'room settings unchanged')
 assert.equal(after.InterviewSlot.filter(s=>s.roomId===room).length,count(room)+1);assert.equal(after.InterviewSlot.filter(s=>s.roomId===h.roomIds[1]).length,count(h.roomIds[1]))
 const slot=after.InterviewSlot.find(s=>!before.InterviewSlot.some(b=>b.id===s.id))
 assert.equal(slot.startTime.toISOString(),core.zonedInstant(date,'10:00','America/New_York').toISOString());assert.equal(+slot.endTime-+slot.startTime,1800000)
 assert.equal(slot.clubId,h.ids.club);assert.equal(slot.location,'A');assert.equal(slot.capacity,2);assert.equal(slot.panelScheduleVersionId,null);assert.deepEqual(slot.publishedPanelMemberIds,[]);assert.equal(slot.interviewersNeeded,null)
 const audit=(await h.db.query('SELECT "actorId","clubId",details FROM "AuditLog" WHERE action=\'interview.room.times.add\' AND "targetId"=$1',[room])).rows
 assert.equal(audit.length,1);assert.equal(audit[0].actorId,h.ids.owner);assert.deepEqual(audit[0].details,{count:1,dates:[date]})
})

test('adding times keeps overlap, date window, authorization, club scope and published-panel rules',async t=>{
 const h=await fixture(t),room=h.roomIds[0],input={clubId:h.ids.club,roomId:room,dates:[day(30)],start:'10:00',end:'10:30',capacity:1}
 await h.generate();ok(await h.confirm(ok(await h.review())))
 const official=await h.snapshot()
 // Past dates and dates more than a year out are refused.
 await assert.rejects(h.rooms.addInterviewRoomTimes({...input,dates:['2020-01-06']}),/future/)
 await assert.rejects(h.rooms.addInterviewRoomTimes({...input,dates:[day(400)]}),/within the next year/)
 await assert.rejects(h.rooms.addInterviewRoomTimes({...input,dates:['2030-10-12']}),/within the next year/)
 // Another club's owner, a non-member and a member without interviews.manage are refused without writes.
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
 // Times that overlap this room's own sessions are refused.
 await assert.rejects(h.rooms.addInterviewRoomTimes(input),/overlap/)
})

// Authz review: new times must not be staffed by a room approval that a published panel replaced.
test('added times never inherit a room-level approval that a published panel replaced',async t=>{
 const h=await fixture(t),room=h.roomIds[0],M=h.ids.peerMember
 await approveRoom(h,room,[h.ids.panelMember,M])
 assert.ok((await h.db.query('SELECT "approvedPanelMemberIds" FROM "InterviewRoom" WHERE id=$1',[room])).rows[0].approvedPanelMemberIds.includes(M))
 // The owner publishes a panel that drops M everywhere.
 const draft=(await h.generate()).proposal;await h.api.savePanelProposalDraft({...h.input(draft),assignments:draft.document.assignments.filter(a=>a.memberId!==M)})
 const review=ok(await h.review());ok(await h.publish.publishPanelSchedule({...h.scope,proposalId:review.proposalId,revision:review.revision,approvalToken:review.approvalToken,understaffedOverride:review.overrideRequired,overrideReason:review.overrideRequired?'M stepped back from interviewing this round.':undefined,confirmUnstaff:review.unstaffed>0}))
 const before=await h.snapshot();assert.ok(before.InterviewSlot.filter(s=>s.roomId===room).every(s=>s.panelScheduleVersionId&&!s.publishedPanelMemberIds.includes(M)))
 h.as(h.ids.scheduler);await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:room,dates:[day(30)],start:'10:00',end:'10:30',capacity:1})
 const after=await h.snapshot(),fresh=after.InterviewSlot.find(s=>!before.InterviewSlot.some(b=>b.id===s.id)),roomRow=after.InterviewRoom.find(r=>r.id===room)
 assert.equal(roomRow.panelApprovedBy,null);assert.deepEqual(roomRow.approvedPanelMemberIds,[])
 const audit=(await h.db.query('SELECT details FROM "AuditLog" WHERE action=\'interview.room.times.add\' AND "targetId"=$1',[room])).rows[0].details;assert.equal(audit.retiredRoomApproval.previousApprovedBy,h.ids.owner);assert.deepEqual([...audit.retiredRoomApproval.approvedPanelMemberIds].sort(),[h.ids.panelMember,M].sort())
 // Planning, booking coverage and the interviewer's own schedule all treat the new time as unstaffed.
 const planning=await h.load('utils/panel-planning.ts').loadPanelPlanningScene(h.prisma,h.scope,{start:new Date(+fresh.startTime-3600000).toISOString(),end:new Date(+fresh.endTime+3600000).toISOString()})
 assert.deepEqual(planning.scene.sessions.find(s=>s.id===fresh.id).existingMemberIds,[])
 const coverage=await h.load('utils/interview-booking.ts').interviewBookingCoverage(h.prisma,h.ids.club,h.ids.round);assert.equal(coverage.find(c=>c.slotId===fresh.id)?.bookable??false,false)
 h.as(h.ids.peer);assert.equal((await h.own.getMyInterviewPanelSchedule()).some(s=>s.id===fresh.id),false)
 // Published sessions keep their panels, and a booking on the new time grants M nothing.
 for(const slot of before.InterviewSlot)assert.deepEqual(after.InterviewSlot.find(s=>s.id===slot.id),slot)
 await h.db.query('UPDATE "InterviewBooking" SET "slotId"=$1 WHERE "applicationId"=$2',[fresh.id,h.ids.app])
 await h.load('utils/interview-scheduling-access.ts').syncBookingPanel(h.prisma,h.ids.app,h.ids.round,h.ids.owner,{notify:false})
 assert.equal((await h.db.query('SELECT * FROM "InterviewPanelAssignment" WHERE "applicationId"=$1 AND "memberId"=$2 AND "revokedAt" IS NULL',[h.ids.app,M])).rows.length,0)
})

test('a room-level-only approval keeps staffing added times only while every approved interviewer still qualifies',async t=>{
 const h=await fixture(t),room=h.roomIds[1],M=h.ids.peerMember,input={clubId:h.ids.club,roomId:room,dates:[day(30)],start:'10:00',end:'10:30',capacity:1}
 await approveRoom(h,room,[M])
 // Defense in depth: even if the approval outlived a member losing reviewer rights (triggers bypassed here), it staffs nothing new.
 const quietly=async sql=>{await h.db.exec('SET session_replication_role = replica');await h.db.query(sql,[M]);await h.db.exec('SET session_replication_role = DEFAULT')}
 await quietly('UPDATE "ClubMember" SET permissions=\'{interviews.manage}\' WHERE id=$1')
 h.as(h.ids.scheduler);await assert.rejects(h.rooms.addInterviewRoomTimes(input),/can no longer interview/)
 await quietly('UPDATE "ClubMember" SET permissions=\'{interviews.manage,applications.review,applicants.identify}\' WHERE id=$1')
 assert.equal((await h.rooms.addInterviewRoomTimes(input)).count,1)
 assert.deepEqual((await h.snapshot()).InterviewRoom.find(r=>r.id===room).approvedPanelMemberIds,[M])
 // Normally the database itself retires the approval as soon as a panelist loses reviewer rights.
 await h.db.query('UPDATE "ClubMember" SET permissions=\'{interviews.manage}\' WHERE id=$1',[M]);assert.equal((await h.snapshot()).InterviewRoom.find(r=>r.id===room).panelApprovedBy,null)
})

test('Manage room "Add dates" submits to the managed room, not room creation',()=>{
 const dialog=fs.readFileSync('components/interviews/create-room-dialog.tsx','utf8'),manager=fs.readFileSync('components/interviews/room-manager.tsx','utf8')
 assert.match(dialog,/if\(source\)\{const parsed=roomTimesInputSchema\.safeParse\(\{clubId,roomId:source\.id,/)
 assert.match(dialog,/onCreated\(input,\(await addInterviewRoomTimes\(parsed\.data\)\)\.noLongerOffered\)\}else\{/)
 assert.match(manager,/onCopy=\{\(\) => \{ setSource\(room\); setCreate\(true\) \}\}/)
 assert.match(manager,/Add dates<\/Button>/)
})

test('demo "Add dates" adds to the managed room through the client boundary without server calls',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts')
 demoStore.start();let clubId,roundId
 demoStore.mutate(s=>{const c=s.clubs[0];clubId=c.id;roundId=c.rounds[0].id;c.rounds[0].type='INTERVIEW';s.perspective={role:'leader',clubId};s.interviewRooms=[];s.roomBookings=[]})
 await api.createInterviewRoom({clubId,roundId,name:'Rice Hall 340',location:'Rice Hall 340',kind:'IN_PERSON',timezone:'America/New_York',dates:[day(30)],start:'10:00',end:'11:00',duration:20,buffer:0,capacity:1,interviewersNeeded:1,panelMemberIds:[]})
 const room=(await api.getRoomWorkspace(clubId)).rooms[0];assert.equal(room.slots.length,3)
 assert.deepEqual(await api.addInterviewRoomTimes({clubId,roomId:room.id,dates:[day(31)],start:'10:00',end:'10:25',capacity:1}),{id:room.id,count:1,noLongerOffered:0})
 const rooms=(await api.getRoomWorkspace(clubId)).rooms;assert.equal(rooms.length,1);assert.equal(rooms[0].slots.length,4)
 await assert.rejects(api.addInterviewRoomTimes({clubId,roomId:room.id,dates:[day(30)],start:'10:00',end:'10:20',capacity:1}),/overlapping/)
 await assert.rejects(api.addInterviewRoomTimes({clubId,roomId:room.id,dates:[day(400)],start:'10:00',end:'10:20',capacity:1}),/within the next year/)
 assert.equal(h.calls(),0)
})

// Re-review: closing and reopening the room must not route around retiring an outdated approval.
const approvedAndPublished=async(h,room,M)=>{
 await approveRoom(h,room,[h.ids.panelMember,M])
 const draft=(await h.generate()).proposal;await h.api.savePanelProposalDraft({...h.input(draft),assignments:draft.document.assignments.filter(a=>a.memberId!==M)})
 const review=ok(await h.review());ok(await h.publish.publishPanelSchedule({...h.scope,proposalId:review.proposalId,revision:review.revision,approvalToken:review.approvalToken,understaffedOverride:review.overrideRequired,overrideReason:review.overrideRequired?'M stepped back from interviewing this round.':undefined,confirmUnstaff:review.unstaffed>0}))
}
const roomRow=async(h,room)=>(await h.db.query('SELECT "isOpen","approvedPanelMemberIds","panelApprovedBy" FROM "InterviewRoom" WHERE id=$1',[room])).rows[0]
test('close, add dates, reopen: new times stay unstaffed and the old approval does not come back',async t=>{
 const h=await fixture(t),room=h.roomIds[0],M=h.ids.peerMember;await approvedAndPublished(h,room,M)
 h.as(h.ids.scheduler);await h.rooms.setInterviewRoomOpen({roomId:room,open:false})
 assert.deepEqual((await roomRow(h,room)).approvedPanelMemberIds,[],'the database clears the approval when the room closes')
 const before=new Set((await h.snapshot()).InterviewSlot.map(s=>s.id))
 await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:room,dates:[day(30)],start:'10:00',end:'10:30',capacity:1})
 await h.rooms.setInterviewRoomOpen({roomId:room,open:true})
 const fresh=(await h.snapshot()).InterviewSlot.filter(s=>!before.has(s.id));assert.equal(fresh.length,1)
 const row=await roomRow(h,room);assert.equal(row.isOpen,true);assert.deepEqual(row.approvedPanelMemberIds,[]);assert.equal(row.panelApprovedBy,null)
 const coverage=await h.load('utils/interview-booking.ts').interviewBookingCoverage(h.prisma,h.ids.club,h.ids.round),c=coverage.find(c=>c.slotId===fresh[0].id)
 assert.equal(c.bookable,false);assert.equal(c.unoffered,true)
})

test('a closed room that still carries an outdated approval is retired on add and on reopen, with a full audit and notice count',async t=>{
 const h=await fixture(t),room=h.roomIds[0],M=h.ids.peerMember;await approvedAndPublished(h,room,M)
 const quietly=async(sql,params)=>{await h.db.exec('SET session_replication_role = replica');await h.db.query(sql,params);await h.db.exec('SET session_replication_role = DEFAULT')}
 // A room-approved time without a published panel, already in the published booking times.
 const legacySlot=randomUUID(),core=h.load('lib/interview-rooms.ts'),start=core.zonedInstant(day(20),'10:00','America/New_York')
 await h.db.query('INSERT INTO "InterviewSlot"(id,"clubId","roomId","startTime","endTime",location,capacity) VALUES ($1,$2,$3,$4,$5,\'A\',1)',[legacySlot,h.ids.club,room,start,new Date(+start+1800000)])
 await h.db.query('UPDATE "PipelineRound" SET "bookingPublishedAt"=now(),"bookingSlots"=$1 WHERE id=$2',[JSON.stringify([{id:legacySlot}]),h.ids.round])
 // Close without the trigger, so the approval survives (defense in depth for the add path).
 await quietly('UPDATE "InterviewRoom" SET "isOpen"=false WHERE id=$1',[room]);assert.ok((await roomRow(h,room)).panelApprovedBy)
 h.as(h.ids.scheduler);const added=await h.rooms.addInterviewRoomTimes({clubId:h.ids.club,roomId:room,dates:[day(30)],start:'10:00',end:'10:30',capacity:1})
 assert.equal(added.noLongerOffered,1);assert.deepEqual((await roomRow(h,room)).approvedPanelMemberIds,[])
 const audit=(await h.db.query('SELECT details FROM "AuditLog" WHERE action=\'interview.room.times.add\' AND "targetId"=$1',[room])).rows[0].details.retiredRoomApproval
 assert.equal(audit.previousApprovedBy,h.ids.owner);assert.deepEqual([...audit.approvedPanelMemberIds].sort(),[h.ids.panelMember,M].sort());assert.deepEqual(audit.unstaffedSlotIds,[legacySlot]);assert.deepEqual(audit.noLongerOfferedSlotIds,[legacySlot])
 // Reopen path: restore the outdated approval behind the trigger's back, then reopen.
 await quietly('UPDATE "InterviewRoom" SET "approvedPanelMemberIds"=$1,"panelApprovedBy"=$2 WHERE id=$3',['{'+h.ids.panelMember+','+M+'}',h.ids.owner,room])
 assert.deepEqual(await h.rooms.setInterviewRoomOpen({roomId:room,open:true}),{noLongerOffered:1})
 const row=await roomRow(h,room);assert.equal(row.isOpen,true);assert.deepEqual(row.approvedPanelMemberIds,[]);assert.equal(row.panelApprovedBy,null)
 const reopened=(await h.db.query('SELECT details FROM "AuditLog" WHERE action=\'interview.room.open\' AND "targetId"=$1',[room])).rows[0].details.retiredRoomApproval;assert.ok(reopened.unstaffedSlotIds.includes(legacySlot))
 const coverage=await h.load('utils/interview-booking.ts').interviewBookingCoverage(h.prisma,h.ids.club,h.ids.round);const legacy=coverage.find(c=>c.slotId===legacySlot);assert.equal(legacy.bookable,false);assert.equal(legacy.unoffered,true)
})
