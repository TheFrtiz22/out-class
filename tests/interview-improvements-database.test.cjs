const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
test('migrated database captures immutable final questions, deduplicates notifications, and scopes later-round history and averages',async t=>{
 const h=await harness();t.after(()=>h.db.close());const i=h.ids,grants=h.load('actions/organization-members.ts'),api=h.load('actions/interview-kits.ts');
 for(const memberId of [i.panelMember,i.peerMember])await grants.setInterviewPanelAssignment({...h.scope,memberId,assigned:true});
 await grants.setInterviewPanelAssignment({...h.scope,memberId:i.panelMember,assigned:true});assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "UserNotification" WHERE type=\'INTERVIEW\'')).rows[0].n,2);
 h.as(i.panel);await assert.rejects(api.getInterviewRoundScore(h.scope),/Submit your own/);
 const first=await api.openInterviewSession(h.scope),draft={...first.draft,score:8,questionNotes:[{questionId:i.question,notes:'Published final evidence'}],additionalNotes:'Final misc',applicantQuestions:'Applicant asked this'};
 const result=await api.saveInterviewSession({...h.scope,revision:0,draft,complete:true});await api.saveInterviewSession({...h.scope,revision:0,draft,complete:true});assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "Evaluation"')).rows[0].n,1);assert.equal(result.session.completedAt!==null,true);
 let summary=await api.getInterviewRoundScore(h.scope);assert.deepEqual(summary,{average:8,submitted:1,required:2,provisional:true});
 await assert.rejects(h.db.query('UPDATE "InterviewRecord" SET "submittedQuestions"=\'[]\' WHERE "interviewerId"=$1',[i.panelMember]),/immutable/);
 h.as(i.peer);await assert.rejects(api.getInterviewRoundScore(h.scope),/Submit your own/);const peer=await api.openInterviewSession(h.scope);assert.deepEqual(peer.draft.questionNotes,[]);await api.saveInterviewSession({...h.scope,revision:peer.revision,draft:{...peer.draft,score:7.5},complete:true});summary=await api.getInterviewRoundScore(h.scope);assert.deepEqual(summary,{average:7.75,submitted:2,required:2,provisional:false});
 const later=randomUUID();await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ($1,$2,\'Later\',2)',[later,i.club]);await h.db.query('UPDATE "Application" SET "roundId"=$1 WHERE id=$2',[later,i.app]);h.as(i.owner);await grants.setInterviewPanelAssignment({...h.scope,roundId:later,memberId:i.panelMember,assigned:true});
 const scope={...h.scope,roundId:later};h.as(i.panel);const history=await api.getEarlierInterviewReviews(scope);assert.equal(history.length,2);assert.equal(history.find(r=>r.questions?.length)?.questions[0].notes,'Published final evidence');assert.ok(history.every(r=>r.roundId===i.round));await assert.rejects(api.getEarlierInterviewReviews({...scope,clubId:randomUUID()}));
 h.as(i.student);await assert.rejects(api.getEarlierInterviewReviews(scope));h.as(i.owner);await grants.setInterviewPanelAssignment({...scope,memberId:i.panelMember,assigned:false});h.as(i.panel);await assert.rejects(api.getEarlierInterviewReviews(scope),/panel/);
 assert.equal((await h.db.query('SELECT "submittedQuestions" FROM "InterviewRecord" WHERE "interviewerId"=$1',[i.panelMember])).rows[0].submittedQuestions[0].notes,'Published final evidence');
});
test('booking cancellation notifies direct grants once without revoking their independent access; stale round notices reveal no context',async t=>{
 const h=await harness();t.after(()=>h.db.close());const i=h.ids,grants=h.load('actions/organization-members.ts'),notices=h.load('utils/interview-assignment-notifications.ts');
 await grants.setInterviewPanelAssignment({...h.scope,memberId:i.panelMember,assigned:true});
 const booking={id:randomUUID(),applicationId:i.app,roundId:i.round};
 for(let n=0;n<2;n++)await h.prisma.$transaction(tx=>notices.notifyInterviewBookingChange(tx,booking));
 assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "UserNotification" WHERE "eventKey" LIKE \'%:cancelled:%\'')).rows[0].n,1);
 assert.equal((await h.db.query('SELECT "revokedAt","bookingManaged" FROM "InterviewPanelAssignment" WHERE "memberId"=$1',[i.panelMember])).rows[0].revokedAt,null);
 const notice=(await h.db.query('SELECT * FROM "UserNotification" WHERE "eventKey" LIKE \'%:assigned:%\'')).rows[0];
 const later=randomUUID();await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ($1,$2,\'Later\',2)',[later,i.club]);await h.db.query('UPDATE "Application" SET "roundId"=$1 WHERE id=$2',[later,i.app]);
 assert.equal(await h.prisma.$transaction(tx=>notices.currentAssignmentNotification(tx,notice,i.panel)),null);
});
test('assignment inbox projects current contexts and removes all identity after revocation without aborting the read',async t=>{
 const h=await harness();t.after(()=>h.db.close());const i=h.ids,grants=h.load('actions/organization-members.ts'),notices=h.load('utils/interview-assignment-notifications.ts'),inbox=h.load('actions/communications.ts');
 await h.db.query('INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES ($1,$2,\'Synthetic\',\'Applicant\',\'inbox-fixture\',\'Economics\',2027)',[randomUUID(),i.student]);
 await grants.setInterviewPanelAssignment({...h.scope,memberId:i.panelMember,assigned:true});
 const grant=(await h.db.query('SELECT * FROM "InterviewPanelAssignment" WHERE "memberId"=$1',[i.panelMember])).rows[0];
 for(let n=0;n<3;n++)await h.prisma.$transaction(tx=>notices.notifyInterviewAssignment(tx,{...grant,bookingId:randomUUID()},'assigned'));
 h.as(i.panel);const current=await inbox.getDurableNotifications();assert.equal(current.items.length,4);assert.ok(current.items.every(n=>n.body.includes('Synthetic Applicant')));
 h.as(i.owner);await grants.setInterviewPanelAssignment({...h.scope,memberId:i.panelMember,assigned:false});h.as(i.panel);
 const revoked=await inbox.getDurableNotifications();assert.equal(revoked.items.length,5);assert.ok(revoked.items.every(n=>!n.body.includes('Synthetic Applicant')&&!n.href.includes('applicationId')));
});
