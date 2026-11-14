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
// Production QA follow-up: the room's one-off calls (applicant panel, résumé pin, résumé annotation
// save/delete, advance prepare/confirm, question library) threw the same denial as HTTP 500.
test('a panelist removed mid-interview gets the same typed refusal, no data and no writes, from the one-off room calls',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts'),resumes=h.load('actions/interview-resumes.ts');
 for(const member of ['panel','peer'])await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids[member+'Member'],h.ids.owner]);
 const documentId=randomUUID(),annotationId=randomUUID(),moveId=randomUUID(),room={...h.scope,clientId:randomUUID()},doc={...h.scope,documentId};
 await h.db.query(`INSERT INTO "InterviewResumeDocument"(id,"applicationId","roundId","sourcePath","contentHash",content) VALUES ($1,$2,$3,$4,repeat('a',64),decode('255044462d','hex'))`,[documentId,h.ids.app,h.ids.round,`${h.ids.student}/cv.pdf`]);
 await h.db.query(`INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,comment,"updatedAt") VALUES ($1,$2,$3,'GENERAL_NOTE','panel-private remark',NOW())`,[annotationId,documentId,h.ids.panelMember]);
 h.as(h.ids.panel);await kit.openInterviewSession(h.scope);
 // Before removal every call works for this panelist.
 assert.equal((await resumes.getInterviewApplicantPanel(h.scope)).document.id,documentId);
 assert.equal((await resumes.pinInterviewResume(h.scope)).id,documentId);
 assert.equal((await kit.getInterviewKit(h.ids.club,h.ids.round)).questions[0].prompt,'Preserved question');
 const view=await rooms.getInterviewCollaboration(room);
 // An issued advance receipt from this room, as prepareInterviewAdvance leaves it before arrival.
 const destinationId=randomUUID();await h.db.query(`INSERT INTO "InterviewCollaboration"(id,"clubId","applicationId","roundId","roomKey",questions) SELECT $1,"clubId","applicationId","roundId",'panel:destination',questions FROM "InterviewCollaboration" WHERE id=$2`,[destinationId,view.sessionId]);
 await h.db.query(`INSERT INTO "InterviewMove"(id,"sourceId","destinationId","memberId","expiresAt") VALUES ($1,$2,$3,$4,NOW()+interval '1 hour')`,[moveId,view.sessionId,destinationId,h.ids.panelMember]);
 const count=async table=>(await h.db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
 const writes=async()=>({audit:await count('AuditLog'),annotations:JSON.stringify((await h.db.query('SELECT id,revision,"deletedAt",comment FROM "InterviewResumeAnnotation" ORDER BY id')).rows),revisions:await count('InterviewAnnotationRevision'),moves:JSON.stringify((await h.db.query('SELECT id,"confirmedAt" FROM "InterviewMove" ORDER BY id')).rows),invitations:await count('InterviewInvitation'),presence:await count('InterviewPresence')});
 const before=await writes();
 await h.db.query('UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "memberId"=$1',[h.ids.panelMember]);
 await revoked(resumes.getInterviewApplicantPanel(h.scope));
 await revoked(resumes.pinInterviewResume(h.scope));
 await revoked(resumes.saveInterviewResumeAnnotation({...doc,id:randomUUID(),content:{kind:'GENERAL_NOTE',comment:'panel-private new note',anchor:null}}));
 await revoked(resumes.saveInterviewResumeAnnotation({...doc,id:randomUUID(),content:{kind:'AREA_HIGHLIGHT',comment:'panel-private highlight',anchor:{page:1,rect:{x:0.1,y:0.1,width:0.2,height:0.1}}}}));
 await revoked(resumes.saveInterviewResumeAnnotation({...doc,id:annotationId,revision:0,content:{kind:'GENERAL_NOTE',comment:'panel-private edit',anchor:null}}));
 await revoked(resumes.deleteInterviewResumeAnnotation({...doc,id:annotationId,revision:0}));
 await revoked(rooms.prepareInterviewAdvance(room));
 await revoked(rooms.confirmInterviewAdvance({moveId,clientId:room.clientId}));
 await revoked(kit.getInterviewKit(h.ids.club,h.ids.round));
 assert.deepEqual(await writes(),before,'no annotation, revision, audit, advance confirmation, invitation or presence was written');
 // Authorization strength is unchanged: the peer still on the panel keeps working.
 h.as(h.ids.peer);assert.equal((await resumes.getInterviewApplicantPanel(h.scope)).document.id,documentId);assert.equal((await kit.getInterviewKit(h.ids.club,h.ids.round)).version,0);
 }finally{await h.db.close();}
});
test('the one-off room calls give the same refusal to a never-assigned member and to the applicant',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts'),resumes=h.load('actions/interview-resumes.ts');
 const room={...h.scope,clientId:randomUUID()},doc={...h.scope,documentId:randomUUID()};
 for(const who of ['peer','student']){h.as(h.ids[who]);
  await revoked(resumes.getInterviewApplicantPanel(h.scope));await revoked(resumes.deleteInterviewResumeAnnotation({...doc,id:randomUUID(),revision:0}));
  await revoked(resumes.saveInterviewResumeAnnotation({...doc,id:randomUUID(),content:{kind:'GENERAL_NOTE',comment:'x',anchor:null}}));
  await revoked(rooms.prepareInterviewAdvance(room));await revoked(kit.getInterviewKit(h.ids.club,h.ids.round));}
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
test('stepping out of the applicant (recusal) mid-interview is the same typed refusal, with no write',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts'),kit=h.load('actions/interview-kits.ts');
 await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.app,h.ids.round,h.ids.panelMember,h.ids.owner]);
 h.as(h.ids.panel);const session=await kit.openInterviewSession(h.scope);const room={...h.scope,clientId:randomUUID()};await rooms.getInterviewCollaboration(room);
 await h.db.query('INSERT INTO "ApplicantRecusal"(id,"clubId","applicationId","memberId","createdById") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),h.ids.club,h.ids.app,h.ids.panelMember,h.ids.panel]);
 await revoked(rooms.getInterviewCollaboration(room));await revoked(kit.saveInterviewSession({...h.scope,revision:0,draft:{...session.draft,additionalNotes:'after recusal'}}));
 assert.equal((await h.db.query('SELECT revision FROM "InterviewRecord"')).rows[0].revision,0,'nothing saved');
 }finally{await h.db.close();}
});
test('failures that are not access denials still throw (the client keeps its connection fallback)',async()=>{
 const h=await harness();try{
 const rooms=h.load('actions/interview-collaboration.ts');
 await assert.rejects(rooms.getInterviewCollaboration({...h.scope,clientId:'not-a-uuid'}),error=>error.refused!==true);
 const resumes=h.load('actions/interview-resumes.ts'),kit=h.load('actions/interview-kits.ts');
 // Validation and lookups that are not access denials keep throwing.
 await assert.rejects(resumes.saveInterviewResumeAnnotation({...h.scope,documentId:randomUUID(),id:randomUUID(),content:{kind:'GENERAL_NOTE',comment:'',anchor:null}}),error=>error.refused!==true);
 await assert.rejects(rooms.confirmInterviewAdvance({moveId:'not-a-uuid',clientId:randomUUID()}),error=>error.refused!==true);
 await assert.rejects(kit.getInterviewKit(h.ids.club,randomUUID()),error=>error.refused!==true&&/Round unavailable/.test(error.message));
 }finally{await h.db.close();}
});
// The room's collaboration poll (every 3 s) is the call that kept returning 500s after removal.
function hookHarness(getCollaboration){
 const fs=require('node:fs'),ts=require('typescript'),slots=[],effects=[],cleanups=[],timers=new Map(),calls=[];let index=0,id=0;
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useRef(v){const i=index++;return slots[i]??={current:v}},useCallback(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const api={getInterviewCollaboration:async input=>{calls.push('read');return getCollaboration(input)},leaveInterviewCollaboration:async()=>{calls.push('leave')},selectSharedInterviewQuestion:async()=>{},dismissInterviewInvitation:async()=>{}};
 const listeners=[];const target={addEventListener:(t,f)=>listeners.push([t,f]),removeEventListener(){}};
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync('hooks/use-interview-workspace.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const actionResult=require('./helpers/communications-loader.cjs').loader({})('lib/action-result.ts');
 new Function('require','module','exports','setTimeout','clearTimeout','setInterval','clearInterval','window','document','crypto','localStorage',code)(n=>n==='react'?react:n==='@/lib/workspace-api'?api:n==='@/lib/action-result'?actionResult:n==='@/lib/interview-collaboration'?{COLLABORATION_POLL_MS:3000,newerCollaboration:(_o,n)=>n}:n==='@/lib/interview-shared-timer'?{clockOffsetMs:()=>0}:n==='@/lib/interview-access'?{}:require(n),mod,mod.exports,fn=>{timers.set(++id,fn);return id},t=>timers.delete(t),()=>0,()=>{},target,{...target,visibilityState:'visible'},{randomUUID:()=>'00000000-0000-4000-8000-000000000000'},{getItem:()=>null,setItem(){},removeItem(){}});
 let revoked=0;
 return{calls,revoked:()=>revoked,timers,render(){index=0;const v=mod.exports.useInterviewWorkspace({clubId:'c',applicationId:'a',roundId:'r'},true,()=>revoked++);while(effects.length)effects.shift()();return v},tick(){const p=[...timers.values()];timers.clear();p.forEach(f=>f())},unmount(){cleanups.forEach(f=>f?.())},UserFacingError:actionResult.UserFacingError};
}
test('the collaboration poll stops for good on ACCESS_REVOKED, reports it once and skips the leave call',async()=>{
 const flush=()=>new Promise(r=>setImmediate(r));let deny=false,h;
 h=hookHarness(async()=>{if(deny)throw new h.UserFacingError('You no longer have access to this interview.','ACCESS_REVOKED');return{sessionId:'s',revision:1,participants:[],selection:null,invitation:null,timing:null,timer:null}});
 h.render();await flush();assert.equal(h.calls.filter(c=>c==='read').length,1);assert.equal(h.timers.size,1,'next poll scheduled');
 deny=true;h.tick();await flush();const v=h.render();
 assert.equal(h.revoked(),1);assert.equal(v.view,null);assert.equal(v.error,'','no "Room connection unavailable" message');assert.equal(h.timers.size,0,'no further poll scheduled');
 h.tick();await flush();assert.equal(h.calls.filter(c=>c==='read').length,2,'polling stopped');
 h.unmount();assert.equal(h.calls.includes('leave'),false,'no leave call that would be refused');assert.equal(h.revoked(),1);
});
test('an ordinary poll failure keeps polling and still shows the connection message',async()=>{
 const flush=()=>new Promise(r=>setImmediate(r));let fail=false;
 const h=hookHarness(async()=>{if(fail)throw Error('network');return{sessionId:'s',revision:1,participants:[],selection:null,invitation:null,timing:null,timer:null}});
 h.render();await flush();fail=true;h.tick();await flush();const v=h.render();
 assert.equal(h.revoked(),0);assert.match(v.error,/Room connection unavailable/);assert.equal(h.timers.size,1,'polling continues');
 h.unmount();assert.ok(h.calls.includes('leave'));
});
