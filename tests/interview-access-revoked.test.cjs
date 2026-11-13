const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/interview-sql-harness.cjs');
const {refused}=require('./helpers/action-result.cjs');
const {randomUUID}=require('node:crypto');
// Production QA 2026-11-13: an interviewer removed from the panel while the room was open
// got HTTP 500s from the room's polling, autosave and leave calls ("Current panel assignment
// or explicit leadership permission required." thrown, masked by Next). The same denial is now a
// returned { ok: false, code: 'ACCESS_REVOKED' } refusal carrying no interview data.
const REVOKED=/no longer have access to this interview/;
async function revoked(promise){const outcome=await refused(promise,REVOKED);assert.equal(outcome.code,'ACCESS_REVOKED');assert.equal('data' in outcome,false);assert.doesNotMatch(JSON.stringify(outcome),/panel-private|Preserved question|sessionId|participants|timer/);return outcome;}
test('a panelist removed mid-interview gets typed refusals, no data and no writes, from every room call',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts'),timer=h.load('actions/interview-timer.ts'),resumes=h.load('actions/interview-resumes.ts');
 await h.db.query('UPDATE "PipelineRound" SET configuration=\'{"duration":20}\' WHERE id=$1',[h.ids.round]);
 for(const member of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids[member+'Member'],h.ids.owner]);
 const room={...h.scope,clientId:randomUUID()};
 h.as(h.ids.panel);const session=await kit.openInterviewSession(h.scope);
 const view=await rooms.getInterviewCollaboration(room);assert.ok(view.sessionId);
 await kit.saveInterviewSession({...h.scope,revision:0,draft:{...session.draft,additionalNotes:'panel-private'}});
 const before=JSON.stringify((await h.db.query('SELECT revision,draft FROM "InterviewRecord" ORDER BY id')).rows);
 // The owner removes this interviewer from the slot's panel.
 await h.db.query('UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "memberId"=$1',[h.ids.panelMember]);
 await revoked(rooms.getInterviewCollaboration(room));
 await revoked(rooms.leaveInterviewCollaboration(room));
 await revoked(rooms.selectSharedInterviewQuestion({...room,questionId:h.ids.question}));
 await revoked(rooms.dismissInterviewInvitation({...room,invitationId:randomUUID()}));
 await revoked(kit.saveInterviewSession({...h.scope,revision:1,draft:{...session.draft,additionalNotes:'panel-private and more'}}));
 await revoked(kit.openInterviewSession(h.scope));
 await revoked(kit.getPreviousInterviewScores(h.scope));
 await revoked(timer.controlInterviewTimer({...h.scope,revision:0,requestId:randomUUID(),command:{type:'start'}}));
 await revoked(resumes.getInterviewResumeAnnotations({...h.scope,documentId:randomUUID()}));
 assert.equal(JSON.stringify((await h.db.query('SELECT revision,draft FROM "InterviewRecord" ORDER BY id')).rows),before,'the revoked save wrote nothing');
 assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewTimer"')).rows[0].n,0,'no timer row written');
 // Authorization strength is unchanged: the peer still on the panel keeps working.
 h.as(h.ids.peer);await kit.openInterviewSession(h.scope);assert.ok((await rooms.getInterviewCollaboration({...h.scope,clientId:randomUUID()})).sessionId);
 }finally{await h.db.close();}
});
test('every interview access denial maps to the same refusal, so the message reveals nothing about why',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts');
 const room={...h.scope,clientId:randomUUID()};
 // Never assigned (panel denial), the applicant themself (privacy denial) and a non-member (membership denial).
 h.as(h.ids.peer);await revoked(rooms.getInterviewCollaboration(room));await revoked(kit.openInterviewSession(h.scope));
 h.as(h.ids.student);await revoked(rooms.getInterviewCollaboration(room));await revoked(kit.openInterviewSession(h.scope));
 await h.db.query('UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1',[h.ids.round]);
 h.as(h.ids.peer);await revoked(kit.openInterviewSession(h.scope));
 }finally{await h.db.close();}
});
test('failures that are not access denials still throw (the client keeps its connection fallback)',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts');
 await assert.rejects(rooms.getInterviewCollaboration({...h.scope,clientId:'not-a-uuid'}),error=>error.refused!==true);
 }finally{await h.db.close();}
});
