const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{harness}=require('./helpers/interview-sql-harness.cjs')
async function fixture(t, runtimeRole=false){
 const h=await harness({permissiveDefaults:true,runtimeRole});t.after(()=>h.db.close());h.api=h.load('actions/panel-proposals.ts');h.rooms=h.load('actions/interview-rooms.ts')
 h.scope={clubId:h.ids.club,roundId:h.ids.round};h.window={start:'2030-10-12T09:00:00.000Z',end:'2030-10-12T11:00:00.000Z'};h.options={maxConsecutiveMinutes:null,breakMinutes:15}
 const schedule={timezone:'UTC',weeklySubmitted:true,weekly:Array.from({length:7},()=>[[0,1440]]),exceptions:{}}
 for(const k of ['panel','peer']){await h.db.query('UPDATE "ClubMember" SET "accessRole"=\'INTERVIEWER\' WHERE id=$1',[h.ids[k+'Member']]);await h.db.query('INSERT INTO "InterviewRoundParticipation"(id,"clubId","memberId","roundId",availability,"confirmedAt") VALUES ($1,$2,$3,$4,$5,now())',[randomUUID(),h.ids.club,h.ids[k+'Member'],h.ids.round,JSON.stringify(schedule)])}
 h.roomId=randomUUID();h.slotIds=[]
 await h.db.query('INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration,"panelMemberIds","approvedPanelMemberIds","panelApprovedBy") VALUES ($1,$2,$3,\'Room A\',\'Hall\',\'IN_PERSON\',\'UTC\',30,$4,$4,$5)',[h.roomId,h.ids.club,h.ids.round,'{'+h.ids.panelMember+'}',h.ids.owner])
 for(const hour of [9,10]){const id=randomUUID();h.slotIds.push(id);await h.db.query('INSERT INTO "InterviewSlot"(id,"clubId","roomId","startTime","endTime",location) VALUES ($1,$2,$3,$4,$5,\'Hall\')',[id,h.ids.club,h.roomId,`2030-10-12 ${hour}:00`, `2030-10-12 ${hour}:30`])}
 await h.db.query('INSERT INTO "InterviewBooking"(id,"applicationId","roundId","slotId") VALUES ($1,$2,$3,$4)',[randomUUID(),h.ids.app,h.ids.round,h.slotIds[0]])
 await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"roundId","applicationId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.round,h.ids.app,h.ids.panelMember,h.ids.owner])
 await h.db.query('INSERT INTO "UserNotification"(id,"userId","eventKey",type,title,body,href) VALUES ($1,$2,\'existing\',\'interview.booking\',\'Baseline\',\'Baseline\',\'/\')',[randomUUID(),h.ids.panel])
 h.snapshot=async()=>Object.fromEntries(await Promise.all(['InterviewRoom','InterviewSlot','InterviewBooking','InterviewPanelAssignment','UserNotification','NotificationEmailOutbox','NotificationEmailDelivery'].map(async table=>[table,(await h.db.query(`SELECT * FROM "${table}" ORDER BY 1`)).rows])))
 h.generate=(revision=0,extra={})=>h.api.generatePanelProposal({...h.scope,window:h.window,options:h.options,revision,mode:'REGENERATE',...extra})
 return h
}
test('actual proposal actions generate, edit, save, reopen and discard without changing official tables or applicant APIs',async t=>{
 const h=await fixture(t),before=await h.snapshot();h.as(h.ids.student);const applicantBefore=await h.rooms.getApplicantSchedule(h.ids.app);h.as(h.ids.owner)
 const generated=await h.generate(),draft=generated.proposal;assert.equal(draft.status,'UNPUBLISHED');assert.equal(draft.validation.filled,4);assert.equal(draft.revision,1);assert.equal(generated.scene.members.some(m=>'commitments'in m||'baselineWorkloadMinutes'in m),false)
 assert.deepEqual(await h.snapshot(),before);await assert.rejects(h.generate(),/another tab/)
 const edits=draft.document.assignments.slice(1),input={...h.scope,proposalId:draft.id,revision:draft.revision,assignments:edits}
 const preview=await h.api.previewPanelProposalEdits(input);assert.equal(preview.document.assignments.length,3);assert.equal((await h.api.getPanelProposalWorkspace(h.scope)).proposal.document.assignments.length,4)
 const saved=await h.api.savePanelProposalDraft(input);assert.equal(saved.revision,2);assert.deepEqual((await h.api.getPanelProposalWorkspace(h.scope)).proposal.document,saved.document)
 await assert.rejects(h.api.savePanelProposalDraft(input),/another tab/)
 const locked=saved.document.assignments.map(a=>({...a,locked:true})),refilled=await h.generate(2,{mode:'FILL_MISSING',assignments:locked});assert.equal(refilled.proposal.document.assignments.filter(a=>a.locked).length,3);assert.equal(refilled.proposal.validation.filled,4)
 const repeated=await h.generate(3);assert.deepEqual(repeated.proposal.document.assignments,refilled.proposal.document.assignments)
 await h.api.discardPanelProposal({...h.scope,proposalId:draft.id,revision:4});assert.equal((await h.api.getPanelProposalWorkspace(h.scope)).proposal,null)
 assert.deepEqual(await h.snapshot(),before);h.as(h.ids.student);assert.deepEqual(await h.rooms.getApplicantSchedule(h.ids.app),applicantBefore)
})
test('staffing requirements preserve approvals and enforce revisions; changed availability locks remain explicit conflicts',async t=>{
 const h=await fixture(t),roomBefore=(await h.snapshot()).InterviewRoom[0]
 await h.rooms.setInterviewStaffingRequirement({clubId:h.ids.club,roomId:h.roomId,needed:3,revision:0})
 await assert.rejects(h.rooms.setInterviewStaffingRequirement({clubId:h.ids.club,roomId:h.roomId,needed:4,revision:0}),/changed/)
 await h.rooms.setInterviewStaffingRequirement({clubId:h.ids.club,roomId:h.roomId,slotId:h.slotIds[1],needed:1,revision:0})
 const generated=await h.generate();assert.deepEqual(generated.proposal.document.sessions.map(s=>s.required),[3,1]);assert.equal(generated.proposal.validation.required,4)
 const row=(await h.snapshot()).InterviewRoom[0];assert.deepEqual(row.approvedPanelMemberIds,roomBefore.approvedPanelMemberIds);assert.equal(row.panelApprovedBy,roomBefore.panelApprovedBy)
 const assignment=generated.proposal.document.assignments[0];await h.db.query('UPDATE "InterviewRoundParticipation" SET "confirmedAt"=NULL WHERE "memberId"=$1',[assignment.memberId])
 const stale=await h.api.getPanelProposalWorkspace(h.scope);assert.equal(stale.proposal.stale,true);assert.ok(stale.proposal.validation.issues.some(i=>i.code==='UNCONFIRMED'))
 const regenerated=await h.generate(1,{assignments:generated.proposal.document.assignments.map(a=>({...a,locked:a.memberId===assignment.memberId}))});assert.equal(regenerated.proposal.validation.status,'CONFLICT_DETECTED');assert.ok(regenerated.proposal.document.assignments.some(a=>a.memberId===assignment.memberId&&a.locked))
 h.as(h.ids.panel);await assert.rejects(h.rooms.setInterviewStaffingRequirement({clubId:h.ids.club,roomId:h.roomId,needed:8,revision:1}),/access denied/)
})
test('cross-club official commitments block confirmed interviewers without exposing foreign schedules; manual invalid additions are rejected',async t=>{
 const h=await fixture(t),otherClub=randomUUID(),otherRound=randomUUID(),otherMember=randomUUID(),otherRoom=randomUUID(),otherSlot=randomUUID()
 await h.db.query('INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ($1,$1,\'Private Other Club\',\'\',\'\',\'\',\'\')',[otherClub])
 await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ($1,$2,\'Interview\',1)',[otherRound,otherClub])
 await h.db.query('INSERT INTO "ClubMember"(id,"clubId","userId") VALUES ($1,$2,$3)',[otherMember,otherClub,h.ids.peer])
 await h.db.query('INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration,"panelMemberIds","approvedPanelMemberIds","panelApprovedBy") VALUES ($1,$2,$3,\'Private room\',\'Private hall\',\'IN_PERSON\',\'UTC\',30,$4,$4,$5)',[otherRoom,otherClub,otherRound,'{'+otherMember+'}',h.ids.owner])
 await h.db.query('INSERT INTO "InterviewSlot"(id,"clubId","roomId","startTime","endTime",location) VALUES ($1,$2,$3,\'2030-10-12 09:00\',\'2030-10-12 09:30\',\'Private hall\')',[otherSlot,otherClub,otherRoom])
 const generated=await h.generate(),draft=generated.proposal;assert.equal(draft.validation.filled,3);assert.ok(generated.scene.members.find(m=>m.id===h.ids.peerMember).blocks[h.slotIds[0]].includes('OFFICIAL_COMMITMENT'));assert.equal(JSON.stringify(generated).includes('Private'),false)
 const input={...h.scope,proposalId:draft.id,revision:1,assignments:[...draft.document.assignments,{slotId:h.slotIds[0],memberId:h.ids.peerMember,locked:false,source:'AUTO'}]};await assert.rejects(h.api.savePanelProposalDraft(input),/official commitment/)
 h.as(h.ids.peer);await assert.rejects(h.api.getPanelProposalWorkspace(h.scope),/access denied/);h.as(h.ids.owner);await assert.rejects(h.api.getPanelProposalWorkspace({clubId:otherClub,roundId:otherRound}),/access denied/)
 await assert.rejects(h.api.generatePanelProposal({...h.scope,roundId:otherRound,revision:0,window:h.window,options:h.options,mode:'REGENERATE'}),/active interview round/)
})
test('database guards roll back unpublished official writes; proposal scope, status, browser access and runtime ownership are enforced',async t=>{
 const h=await fixture(t,true),before=await h.snapshot()
 for(const query of ['UPDATE "InterviewRoom" SET "panelMemberIds"=\'{}\'','UPDATE "InterviewSlot" SET capacity=8','DELETE FROM "InterviewBooking"','DELETE FROM "InterviewPanelAssignment"','UPDATE "UserNotification" SET title=\'changed\'','DELETE FROM "NotificationEmailOutbox"'])await assert.rejects(h.db.transaction(async tx=>{await tx.query("SELECT set_config('outclass.panel_proposal_mode','unpublished',true)");await tx.exec(query)}),/cannot write official/)
 await assert.rejects(h.db.transaction(async tx=>{await tx.query("SELECT set_config('outclass.panel_proposal_mode','unpublished',true)");await tx.query('INSERT INTO "NotificationEmailDelivery"(id,"userId",payload) VALUES ($1,$2,\'{}\')',[randomUUID(),h.ids.panel])}),/cannot write official/)
 for(const table of ['UserNotification','NotificationEmailOutbox','NotificationEmailDelivery']) { const triggers=(await h.db.query('SELECT tgname FROM pg_trigger WHERE tgrelid=$1::regclass',[`"${table}"`])).rows;assert.ok(triggers.some(t=>t.tgname==='outclass_panel_preview_guard')) }
 assert.deepEqual(await h.snapshot(),before)
 const generated=await h.generate();await h.db.exec('GRANT SELECT ON "InterviewSlot","InterviewRoom","ClubMember" TO outclass_production_app; SET ROLE outclass_production_app');assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewPanelProposal"')).rows[0].n,1);await h.db.query('UPDATE "InterviewPanelProposal" SET revision=revision+1');await h.db.exec('RESET ROLE')
 await assert.rejects(h.db.query('UPDATE "InterviewPanelProposal" SET status=\'PUBLISHED\',revision=revision+1'),/check constraint/)
 await assert.rejects(h.db.query('UPDATE "InterviewPanelProposal" SET "createdBy"=$1,revision=revision+1',[h.ids.peer]),/identity is immutable/)
 const invalid={...generated.proposal.document,assignments:[{slotId:h.slotIds[0],memberId:randomUUID(),locked:false,source:'MANUAL'}]};await assert.rejects(h.db.query('UPDATE "InterviewPanelProposal" SET document=$1,revision=revision+1',[JSON.stringify(invalid)]),/belong to this club/)
 for(const role of ['anon','authenticated']){await h.db.exec(`SET ROLE ${role}`);for(const operation of ['SELECT *','DELETE'])await assert.rejects(h.db.query(`${operation} FROM "InterviewPanelProposal"`),/permission denied/);await h.db.exec('RESET ROLE')}
})
test('confirmed local-date exceptions and the full following buffer determine eligibility; global changes never silently alter a snapshot',async t=>{
 const h=await fixture(t),core=h.load('lib/availability.ts'),schedule=core.emptySchedule('UTC');schedule.weeklySubmitted=true;schedule.weekly=Array.from({length:7},()=>[[540,570]])
 await h.db.query('UPDATE "InterviewRoom" SET buffer=15 WHERE id=$1',[h.roomId])
 await h.db.query('UPDATE "InterviewRoundParticipation" SET availability=$1 WHERE "memberId"=$2',[JSON.stringify(schedule),h.ids.panelMember])
 const exception={...schedule,weeklySubmitted:false,exceptions:{'2030-10-12':[[540,585]]}};await h.db.query('UPDATE "InterviewRoundParticipation" SET availability=$1 WHERE "memberId"=$2',[JSON.stringify(exception),h.ids.peerMember])
 await h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)',[h.ids.panel,JSON.stringify({...schedule,weekly:Array.from({length:7},()=>[[0,1440]])})])
 const result=await h.generate();assert.equal(result.proposal.validation.filled,1);assert.equal(result.proposal.document.assignments[0].memberId,h.ids.peerMember);assert.ok(result.scene.members.find(m=>m.id===h.ids.panelMember).blocks[h.slotIds[0]].includes('UNAVAILABLE'));assert.ok(result.scene.members.find(m=>m.id===h.ids.peerMember).blocks[h.slotIds[1]].includes('UNAVAILABLE'))
})
test('manual replacements, moves and swaps validate atomically and cannot spoof automatic provenance or official access',async t=>{
 const h=await fixture(t),schedule={timezone:'UTC',weeklySubmitted:true,weekly:Array.from({length:7},()=>[[0,1440]]),exceptions:{}}
 await h.db.query('UPDATE "ClubMember" SET "accessRole"=\'INTERVIEWER\',permissions=\'{applications.review,applicants.identify}\' WHERE id=$1',[h.ids.schedulerMember])
 await h.db.query('INSERT INTO "InterviewRoundParticipation"(id,"clubId","memberId","roundId",availability,"confirmedAt") VALUES ($1,$2,$3,$4,$5,now())',[randomUUID(),h.ids.club,h.ids.schedulerMember,h.ids.round,JSON.stringify(schedule)])
 const generated=await h.generate(),draft=generated.proposal,before=await h.snapshot(),first=h.slotIds[0],second=h.slotIds[1],scope={...h.scope,proposalId:draft.id,revision:1}
 const custom=[{slotId:first,memberId:h.ids.panelMember,locked:false,source:'AUTO'},{slotId:first,memberId:h.ids.peerMember,locked:false,source:'AUTO'},{slotId:second,memberId:h.ids.schedulerMember,locked:false,source:'AUTO'}]
 let view=await h.api.previewPanelProposalEdits({...scope,assignments:custom});assert.equal(view.validation.filled,3)
 const replace=custom.map(a=>a.memberId===h.ids.panelMember?{...a,memberId:h.ids.schedulerMember}:a)
 view=await h.api.previewPanelProposalEdits({...scope,assignments:replace});assert.equal(view.validation.filled,3)
 const moved=replace.filter(a=>a.memberId!==h.ids.peerMember).map(a=>a.slotId===first?{...a,slotId:second}:a)
 await assert.rejects(h.api.previewPanelProposalEdits({...scope,assignments:moved})) // Duplicate interviewer in a destination is never accepted.
 const validMove=custom.filter(a=>a.memberId!==h.ids.panelMember).map(a=>a.slotId===second?{...a,slotId:first}:a)
 view=await h.api.previewPanelProposalEdits({...scope,assignments:validMove});assert.equal(view.validation.filled,2)
 const swap=custom.map(a=>a.memberId===h.ids.panelMember?{...a,memberId:h.ids.schedulerMember}:a.memberId===h.ids.schedulerMember?{...a,memberId:h.ids.panelMember}:a)
 const saved=await h.api.savePanelProposalDraft({...scope,assignments:swap});assert.equal(saved.validation.filled,3)
 for(const a of saved.document.assignments)if(!draft.document.assignments.some(old=>old.slotId===a.slotId&&old.memberId===a.memberId))assert.equal(a.source,'MANUAL')
 assert.deepEqual(await h.snapshot(),before)
})
