const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
// Each refusal asserts the specific server message and that the timer table is untouched.
const RECUSED="You've stepped out of reviewing this applicant because you know them. A recruitment lead can undo this.";
const ACTIVE={message:'Only active interviews can use the shared timer.'};
async function setup(){
 const h=await harness();const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts'),timer=h.load('actions/interview-timer.ts');
 await h.db.query(`UPDATE "PipelineRound" SET configuration='{"duration":20}' WHERE id=$1`,[h.ids.round]);
 for(const member of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids[member+'Member'],h.ids.owner]);
 h.as(h.ids.panel);await kit.openInterviewSession(h.scope);h.as(h.ids.peer);const peer=await kit.openInterviewSession(h.scope);
 h.as(h.ids.panel);const started=await timer.controlInterviewTimer({...h.scope,revision:0,requestId:randomUUID(),command:{type:'start'}});assert.equal(started.status,'ok');
 const snapshot=async()=>JSON.stringify((await h.db.query('SELECT * FROM "InterviewTimer" ORDER BY "sessionId"')).rows);
 const press=(userId,scope=h.scope,command={type:'reset'})=>{h.as(userId);return timer.controlInterviewTimer({...scope,revision:1,requestId:randomUUID(),command});};
 const read=(userId,scope=h.scope)=>{h.as(userId);return rooms.getInterviewCollaboration({...scope,clientId:randomUUID()});};
 const refused=async(promise,message)=>{const before=await snapshot();await assert.rejects(promise,message);assert.equal(await snapshot(),before,'no timer row written or changed');};
 return{...h,rooms,kit,timer,peer,press,read,refused,snapshot};
}
test('a panelist who has submitted cannot reset or otherwise drive the shared timer',async()=>{
 const h=await setup();try{
 h.as(h.ids.peer);await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.peer.draft,score:8.5},complete:true});
 await h.refused(h.press(h.ids.peer),ACTIVE);await h.refused(h.press(h.ids.peer,h.scope,{type:'pause'}),ACTIVE);
 assert.equal((await h.db.query('SELECT revision FROM "InterviewTimer"')).rows[0].revision,1);
 assert.equal((await h.press(h.ids.panel,h.scope,{type:'pause'})).status,'ok','an active panelist still can');
 }finally{await h.db.close();}
});
test('a panelist in the closing (post-interview) phase cannot drive the shared timer',async()=>{
 const h=await setup();try{
 h.as(h.ids.peer);await h.kit.saveInterviewSession({...h.scope,revision:0,draft:{...h.peer.draft,postInterview:true}});
 await h.refused(h.press(h.ids.peer),ACTIVE);
 assert.equal((await h.db.query('SELECT revision FROM "InterviewTimer"')).rows[0].revision,1);
 }finally{await h.db.close();}
});
test('a recused member can neither read nor change the timer',async()=>{
 const h=await setup();try{
 await h.db.query('INSERT INTO "ApplicantRecusal"(id,"clubId","applicationId","memberId","createdById") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.club,h.ids.app,h.ids.peerMember,h.ids.owner]);
 await h.refused(h.press(h.ids.peer),{message:RECUSED});await h.refused(h.read(h.ids.peer),{message:RECUSED});
 }finally{await h.db.close();}
});
test('an anonymous-review round exposes no timer and accepts no command',async()=>{
 const h=await setup();try{
 await h.db.query('UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1',[h.ids.round]);
 await h.refused(h.press(h.ids.panel),{message:'Identified interview unavailable under current privacy settings.'});await h.refused(h.read(h.ids.panel),{message:'Identified interview unavailable under current privacy settings.'});
 }finally{await h.db.close();}
});
test('an archived round refuses timer commands',async()=>{
 const h=await setup();try{
 await h.db.query('UPDATE "PipelineRound" SET "archivedAt"=NOW() WHERE id=$1',[h.ids.round]);
 await h.refused(h.press(h.ids.panel),ACTIVE);
 }finally{await h.db.close();}
});
test('an application that moved to another round refuses timer commands for the old round',async()=>{
 const h=await setup();try{
 const next=randomUUID();await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order",configuration) VALUES ($1,$2,\'Final\',2,\'{"duration":30}\')',[next,h.ids.club]);
 await h.db.query('UPDATE "Application" SET "roundId"=$1 WHERE id=$2',[next,h.ids.app]);
 await h.refused(h.press(h.ids.panel),ACTIVE);
 }finally{await h.db.close();}
});
test('a panelist not on the booked room\'s approved panel cannot reach that room\'s timer',async()=>{
 const h=await setup();try{
 const room=randomUUID(),slot=randomUUID(),start=new Date(Date.now()+86400000);
 await h.db.query(`INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration,"panelMemberIds","approvedPanelMemberIds","panelApprovedBy") VALUES ($1,$2,$3,'Room A','Rice 120','IN_PERSON','America/New_York',20,$4,$4,$5)`,[room,h.ids.club,h.ids.round,[h.ids.panelMember],h.ids.owner]);
 await h.db.query('INSERT INTO "InterviewSlot"(id,"clubId","roomId","startTime","endTime",location) VALUES ($1,$2,$3,$4,$5,\'Rice 120\')',[slot,h.ids.club,room,start,new Date(+start+20*60000)]);
 await h.db.query('INSERT INTO "InterviewBooking"(id,"slotId","applicationId","roundId") VALUES ($1,$2,$3,$4)',[randomUUID(),slot,h.ids.app,h.ids.round]);
 // The approved panelist reaches the booked room's own timer (a different room key from the manual panel room).
 h.as(h.ids.panel);const view=await h.read(h.ids.panel);assert.equal(view.timer.revision,0);
 await h.refused(h.press(h.ids.peer,h.scope,{type:'start'}),{message:'Current room assignment required.'});await h.refused(h.read(h.ids.peer),{message:'Current room assignment required.'});
 }finally{await h.db.close();}
});
test('a member of a second club cannot use that membership to reach this club\'s timer',async()=>{
 const h=await setup();try{
 const club=randomUUID(),round=randomUUID();
 await h.db.query('INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ($1,\'second-club\',\'Second\',\'\',\'\',\'\',\'\')',[club]);
 await h.db.query('INSERT INTO "ClubMember"(id,"clubId","userId","isOwner",permissions,"interviewOffices") VALUES ($1,$2,$3,false,$4,$5)',[randomUUID(),club,h.ids.peer,'{applications.review,applicants.identify}','{}']);
 await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order",configuration) VALUES ($1,$2,\'Interview\',1,\'{"duration":20}\')',[round,club]);
 for(const scope of [{...h.scope,clubId:club},{...h.scope,clubId:club,roundId:round}]){
  await h.refused(h.press(h.ids.peer,scope),{message:'Identified interview unavailable under current privacy settings.'});await h.refused(h.read(h.ids.peer,scope),{message:'Identified interview unavailable under current privacy settings.'});
 }
 }finally{await h.db.close();}
});
