const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/panel-publication-fixture.cjs')
test('a scheduler asks the owners to confirm interviewers once per draft revision; the request needs a saved draft and another owner',async t=>{
 const h=await fixture(t),request=h.load('actions/panel-approval-request.ts'),ask=async()=>{const r=await request.requestPanelApproval(h.scope);if(r&&r.ok===false)throw Error(r.error);return r.ok?r.value:r}
 h.as(h.ids.scheduler);await assert.rejects(ask(),/Assign interviewers first/)
 await h.generate();const first=await ask();assert.equal(first.owners.length,1)
 const notices=async()=>(await h.db.query(`SELECT * FROM "UserNotification" WHERE "eventKey" LIKE 'interview-panel-approval:%'`)).rows
 let rows=await notices();assert.equal(rows.length,1);assert.equal(rows[0].userId,h.ids.owner);assert.equal(rows[0].title,'Confirm interviewers');assert.match(rows[0].href,/interviewTab=schedule.*schedule=review/)
 await ask();assert.equal((await notices()).length,1)
 // A discarded and recreated draft starts again at revision 1; its request still reaches the owners.
 await h.db.query(`DELETE FROM "InterviewPanelProposal" WHERE "roundId"=$1`,[h.scope.roundId]);await h.generate()
 assert.equal((await h.db.query(`SELECT revision FROM "InterviewPanelProposal" WHERE "roundId"=$1`,[h.scope.roundId])).rows[0].revision,1)
 await ask();assert.equal((await notices()).length,2)
 h.as(h.ids.owner);await assert.rejects(ask(),/no other owner/)
 h.as(h.ids.student);await assert.rejects(ask())
})
