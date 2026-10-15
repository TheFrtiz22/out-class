const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture}=require('./helpers/panel-publication-fixture.cjs');
const ok=r=>{assert.equal(r.ok,true,r.error);return r.value};
const publishInput=h=>({...h.scope,revision:0,action:'PUBLISH',cycleId:null,allowCancellation:true,allowRescheduling:true});
async function ready(t){const h=await fixture(t);h.overrides=h.load('actions/interview-availability-overrides.ts');h.booking=h.load('actions/interview-booking-publication.ts');return h;}

test('president attestation counts toward approval/publication/booking without changing personal availability; retries notify once',async t=>{
 const h=await ready(t),i=h.ids;await h.db.query('UPDATE "InterviewRoom" SET "isOpen"=false WHERE id=$1',[h.roomIds[1]]);
 await h.db.query('UPDATE "InterviewRoundParticipation" SET "confirmedAt"=NULL,availability=NULL WHERE "memberId"=$1',[i.panelMember]);
 const availability=(await h.db.query('SELECT * FROM "InterviewRoundParticipation" WHERE "memberId"=$1',[i.panelMember])).rows;
 let draft=(await h.generate()).proposal;const remove=draft.document.assignments.find(a=>a.slotId===h.slotIds[0]);draft=await h.api.savePanelProposalDraft({...h.input(draft),assignments:draft.document.assignments.filter(a=>a!==remove)});
 assert.equal(draft.validation.sessions.find(s=>s.slotId===h.slotIds[0]).unfilled,1);
 const input={...h.input(draft),slotId:h.slotIds[0],memberId:i.panelMember,requestId:randomUUID(),reason:'Synthetic president attestation'};
 h.as(i.scheduler);await assert.rejects(h.overrides.assignPanelAvailabilityOverride(input),/president/);
 h.as(i.owner);await h.db.query('UPDATE "ClubMember" SET "interviewOffices"=\'{}\' WHERE id=$1',[i.ownerMember]);await assert.rejects(h.overrides.assignPanelAvailabilityOverride(input),/president/);
 await h.db.query('UPDATE "ClubMember" SET "interviewOffices"=\'{PRESIDENT}\' WHERE id=$1',[i.ownerMember]);await h.overrides.assignPanelAvailabilityOverride(input);await h.overrides.assignPanelAvailabilityOverride(input);
 assert.deepEqual((await h.db.query('SELECT * FROM "InterviewRoundParticipation" WHERE "memberId"=$1',[i.panelMember])).rows,availability);
 assert.equal((await h.db.query('SELECT count(*)::int n FROM "InterviewAvailabilityOverride"')).rows[0].n,1);
 draft=(await h.api.getPanelProposalWorkspace(h.scope)).proposal;assert.equal(draft.validation.filled,draft.validation.required);assert.equal(draft.validation.issues.length,0);
 const review=ok(await h.review());ok(await h.confirm(review));ok(await h.confirm(review));
 const panelNotices=(await h.db.query('SELECT * FROM "UserNotification" WHERE "userId"=$1 AND "eventKey" LIKE \'panel-schedule:%\'',[i.panel])).rows;assert.equal(panelNotices.length,1);
 h.as(i.student);let schedule=await h.rooms.getApplicantSchedule(i.app);assert.equal(schedule.publicationState,'NOT_PUBLISHED');assert.equal(schedule.rooms.length,0);assert.ok(schedule.booking);
 h.as(i.owner);await h.booking.setInterviewBookingPublication(publishInput(h));await h.booking.setInterviewBookingPublication(publishInput(h));
 assert.equal((await h.db.query('SELECT count(*)::int n FROM "UserNotification" WHERE "eventKey" LIKE \'applicant-interview-booking:published:%\'')).rows[0].n,1);
 h.as(i.student);schedule=await h.rooms.getApplicantSchedule(i.app);assert.equal(schedule.publicationState,'PUBLISHED');assert.equal(schedule.rooms.flatMap(r=>r.slots).length,2);assert.ok(schedule.rooms.every(r=>r.panelMemberIds.length===0&&!('approvedPanelMemberIds'in r)));
 const booked=await h.rooms.reserveInterview({applicationId:i.app,slotId:h.slotIds[1]});await h.rooms.reserveInterview({applicationId:i.app,slotId:h.slotIds[1]});
 assert.equal((await h.db.query('SELECT count(*)::int n FROM "InterviewBooking"')).rows[0].n,1);assert.equal((await h.db.query('SELECT count(*)::int n FROM "UserNotification" WHERE "eventKey" LIKE $1',['booking:'+booked.id+':INSERT:%'])).rows[0].n,1);
 const before=(await h.db.query('SELECT * FROM "InterviewBooking"')).rows;h.as(i.owner);await h.overrides.revokePanelAvailabilityOverride({clubId:i.club,overrideId:input.requestId});h.as(i.student);
 schedule=await h.rooms.getApplicantSchedule(i.app);assert.equal(schedule.rooms.flatMap(r=>r.slots).some(s=>s.id===h.slotIds[0]),false);assert.deepEqual((await h.db.query('SELECT * FROM "InterviewBooking"')).rows,before);
 await assert.rejects(h.rooms.reserveInterview({applicationId:i.app,slotId:h.slotIds[0]}),/fully staffed/);assert.deepEqual((await h.db.query('SELECT * FROM "InterviewBooking"')).rows,before);
 for(const role of ['anon','authenticated']){await h.db.exec('SET ROLE '+role);await assert.rejects(h.db.query('SELECT * FROM "InterviewAvailabilityOverride"'),/permission denied/);await h.db.exec('RESET ROLE');}
 await assert.rejects(h.db.query('DELETE FROM "InterviewAvailabilityOverride"'),/history/);
});

test('unfilled staffing blocks booking publication; scope, pause, policy and changed slot snapshots retain confirmed reservations',async t=>{
 const h=await ready(t),i=h.ids;await h.generate();ok(await h.confirm(ok(await h.review())));await h.booking.setInterviewBookingPublication(publishInput(h));
 h.as(i.student);const before=(await h.db.query('SELECT * FROM "InterviewBooking"')).rows;await assert.rejects(h.rooms.reserveInterview({applicationId:randomUUID(),slotId:h.slotIds[1]}),/unavailable/);
 h.as(i.owner);await h.booking.setInterviewBookingPublication({...publishInput(h),revision:1,action:'PAUSE'});h.as(i.student);let data=await h.rooms.getApplicantSchedule(i.app);assert.equal(data.publicationState,'PAUSED');assert.deepEqual((await h.db.query('SELECT * FROM "InterviewBooking"')).rows,before);await assert.rejects(h.rooms.reserveInterview({applicationId:i.app,slotId:h.slotIds[1]}),/published/);
 h.as(i.owner);await h.booking.setInterviewBookingPublication({...publishInput(h),revision:2,action:'POLICY',allowCancellation:false,allowRescheduling:false});h.as(i.student);await assert.rejects(h.rooms.cancelRoomBooking(data.booking.id),/does not allow/);
 h.as(i.owner);await h.booking.setInterviewBookingPublication({...publishInput(h),revision:3});
 await h.db.query('UPDATE "InterviewSlot" SET "startTime"="startTime"+INTERVAL \'1 day\',"endTime"="endTime"+INTERVAL \'1 day\' WHERE id=$1',[h.slotIds[1]]);h.as(i.student);await assert.rejects(h.rooms.reserveInterview({applicationId:i.app,slotId:h.slotIds[1]}),/published/);assert.deepEqual((await h.db.query('SELECT * FROM "InterviewBooking"')).rows,before);
 await h.db.query(`UPDATE "ClubMember" SET status='LEFT',permissions='{}',"isOwner"=false,"interviewOffices"='{}',"accessRole"='MEMBER' WHERE id=$1`,[i.panelMember]);h.as(i.owner);await assert.rejects(h.booking.setInterviewBookingPublication({...publishInput(h),revision:4}),/unfilled/);
});

test('overrides cannot waive official conflicts, lost access or session changes; caller-supplied proof cannot grant access',async t=>{
 const h=await ready(t),i=h.ids;await h.db.query('UPDATE "InterviewRoundParticipation" SET "confirmedAt"=NULL WHERE "memberId"=$1',[i.panelMember]);let draft=(await h.generate()).proposal;
 const base={...h.input(draft),slotId:h.slotIds[0],memberId:i.panelMember,requestId:randomUUID()};await h.db.query('UPDATE "ClubMember" SET permissions=\'{}\' WHERE id=$1',[i.panelMember]);await assert.rejects(h.overrides.assignPanelAvailabilityOverride(base),/cannot be overridden/);
 await h.db.query('UPDATE "ClubMember" SET permissions=\'{applications.review,applicants.identify}\' WHERE id=$1',[i.panelMember]);const remove=draft.document.assignments.find(a=>a.slotId===h.slotIds[0]);draft=await h.api.savePanelProposalDraft({...h.input(draft),assignments:draft.document.assignments.filter(a=>a!==remove)});
 await assert.rejects(h.api.savePanelProposalDraft({...h.input(draft),assignments:[...draft.document.assignments,{slotId:h.slotIds[0],memberId:i.panelMember,locked:false,source:'MANUAL',availabilityOverrideId:randomUUID()}]}),/confirmed/);
 await h.overrides.assignPanelAvailabilityOverride({...base,...h.input(draft)});let scene=await h.api.getPanelProposalWorkspace(h.scope);assert.ok(scene.proposal.document.assignments.some(a=>a.availabilityOverrideId===base.requestId));
 await h.db.query('UPDATE "InterviewRoom" SET buffer=10 WHERE id=$1',[h.roomIds[0]]);scene=await h.api.getPanelProposalWorkspace(h.scope);assert.ok(scene.proposal.validation.issues.some(e=>e.code==='UNCONFIRMED'||e.code==='SESSION_CHANGED'));assert.equal((await h.db.query('SELECT public.outclass_valid_availability_override($1,$2,$3,$4,$5) valid',[base.requestId,i.club,i.round,base.slotId,i.panelMember])).rows[0].valid,false);
});
