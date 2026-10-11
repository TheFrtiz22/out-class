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
