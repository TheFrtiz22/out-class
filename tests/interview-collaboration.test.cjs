const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/interview-sql-harness.cjs');
const {randomUUID}=require('node:crypto');
async function setup(){
 const h=await harness();const api=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts');
 for(const member of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids[member+'Member'],h.ids.owner]);
 h.as(h.ids.panel);const a=await kit.openInterviewSession(h.scope);h.as(h.ids.peer);const b=await kit.openInterviewSession(h.scope);
 return{...h,api,kit,a,b,one:{...h.scope,clientId:randomUUID()},two:{...h.scope,clientId:randomUUID()}};
}
async function addCandidate(h,id){const student=randomUUID();await h.db.query('INSERT INTO "User"(id,email) VALUES ($1,$2)',[student,student+'@virginia.edu']);await h.db.query('INSERT INTO "Application"(id,"clubId","roundId","studentId",status) VALUES ($1,$2,$3,$4,\'INTERVIEWING\')',[id,h.ids.club,h.ids.round,student]);}
test('shared selection is ordered and narrow; private notes, phase, completion remain per reviewer; revoked peers disappear',async()=>{
 const h=await setup();try{
 h.as(h.ids.panel);const first=await h.api.getInterviewCollaboration(h.one);
 await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.a.draft,questionNotes:[{questionId:h.ids.question,notes:'panel-private'}]}});
 const pick=await h.api.selectSharedInterviewQuestion({...h.one,questionId:h.ids.question});assert.equal(pick.revision,1);
 h.as(h.ids.peer);const incoming=await h.api.getInterviewCollaboration(h.two);assert.equal(incoming.sessionId,first.sessionId);assert.equal(incoming.selection.question.id,h.ids.question);
 assert.doesNotMatch(JSON.stringify(incoming),/panel-private|questionNotes|score|postInterview|completedAt|draft/);
 assert.deepEqual((await h.kit.openInterviewSession(h.scope)).draft,h.b.draft);
 await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.b.draft,postInterview:true,additionalNotes:'peer-private'}});
 await assert.rejects(h.api.selectSharedInterviewQuestion({...h.two,questionId:h.ids.question}),/active interviews/);
 h.as(h.ids.panel);await h.api.selectSharedInterviewQuestion({...h.one,questionId:h.ids.question});assert.equal((await h.api.getInterviewCollaboration(h.one)).revision,2);
 await h.db.query('UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "memberId"=$1',[h.ids.peerMember]);
 assert.equal((await h.api.getInterviewCollaboration(h.one)).participants.length,1);
 h.as(h.ids.peer);await assert.rejects(h.api.getInterviewCollaboration(h.two),/assignment/);
 }finally{await h.db.close();}
});
test('same member tabs deduplicate presence; distinct candidate sessions isolate; shared snapshots cannot be rewritten; browser roles denied',async()=>{
 const h=await setup();try{
 h.as(h.ids.panel);const v=await h.api.getInterviewCollaboration(h.one);await h.api.getInterviewCollaboration({...h.one,clientId:randomUUID()});assert.equal((await h.api.getInterviewCollaboration(h.one)).participants.length,1);
 const second=randomUUID();await addCandidate(h,second);await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),second,h.ids.round,h.ids.panelMember,h.ids.owner]);
 const scope={...h.one,applicationId:second};await h.kit.openInterviewSession(scope);assert.notEqual((await h.api.getInterviewCollaboration(scope)).sessionId,v.sessionId);
 await h.api.selectSharedInterviewQuestion({...scope,questionId:h.ids.question});assert.equal((await h.api.getInterviewCollaboration(h.one)).selection,null);
 await assert.rejects(h.db.query('UPDATE "InterviewCollaboration" SET questions=\'[]\',revision=revision+1 WHERE id=$1',[v.sessionId]),/immutable/);
 for(const table of ['InterviewCollaboration','InterviewPresence','InterviewMove','InterviewInvitation'])assert.equal((await h.db.query('SELECT has_table_privilege(\'authenticated\',$1,\'SELECT\') AS allowed',['"'+table+'"'])).rows[0].allowed,false);
 await h.api.leaveInterviewCollaboration(h.one);assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewPresence" WHERE "memberId"=$1 AND "clientId"=$2',[h.ids.panelMember,h.one.clientId])).rows[0].n,0);
 }finally{await h.db.close();}
});
test('exact destination invitations require own final review; confirm is idempotent and acceptance cannot create a loop',async()=>{
 const h=await setup();try{
 const destination=randomUUID();await addCandidate(h,destination);
 for(const m of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),destination,h.ids.round,h.ids[m+'Member'],h.ids.owner]);
 h.as(h.ids.panel);const source=await h.api.getInterviewCollaboration(h.one);h.as(h.ids.peer);await h.api.getInterviewCollaboration(h.two);
 await assert.rejects(h.api.prepareInterviewAdvance(h.two),/Finish/);
 h.as(h.ids.panel);await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.a.draft,score:6.5},complete:true});
 // Issue a server receipt in this SQL harness (the separately tested queue action uses nested Prisma selects).
 h.load('utils/prisma.ts');const destinationSession=randomUUID(),moveId=randomUUID();
 await h.db.query('INSERT INTO "InterviewCollaboration"(id,"clubId","applicationId","roundId","roomKey",questions) VALUES ($1,$2,$3,$4,$5,$6)',[destinationSession,h.ids.club,destination,h.ids.round,'panel:'+destination,JSON.stringify([{id:h.ids.question,prompt:'Preserved question',guidance:''}])]);
 await h.db.query('INSERT INTO "InterviewMove"(id,"sourceId","destinationId","memberId","expiresAt") VALUES ($1,$2,$3,$4,NOW()+interval \'10 minutes\')',[moveId,source.sessionId,destinationSession,h.ids.panelMember]);
 await assert.rejects(h.api.confirmInterviewAdvance({moveId,clientId:h.one.clientId}),/loaded/);
 await h.kit.openInterviewSession({...h.scope,applicationId:destination});await h.api.confirmInterviewAdvance({moveId,clientId:h.one.clientId});await h.api.confirmInterviewAdvance({moveId,clientId:h.one.clientId});
 assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewInvitation"')).rows[0].n,1);
 h.as(h.ids.peer);const invitation=(await h.api.getInterviewCollaboration(h.two)).invitation;assert.ok(invitation);
 await assert.rejects(h.api.prepareInterviewAdvance({...h.two,invitationId:invitation.id}),/Finish/);
 await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.b.draft,score:7},complete:true});
 const accepted=await h.api.prepareInterviewAdvance({...h.two,invitationId:invitation.id});assert.equal(accepted.scope.applicationId,destination);
 await h.kit.openInterviewSession(accepted.scope);await h.api.confirmInterviewAdvance({moveId:accepted.moveId,clientId:h.two.clientId});
 assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewInvitation"')).rows[0].n,1);
 }finally{await h.db.close();}
});
