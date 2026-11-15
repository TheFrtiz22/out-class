const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,clubId,cycleId,roundId,sessionId,leaderId,voterId,apps,uuid}=require('./helpers/voting-room-harness.cjs');
const meeting={version:1,name:'Synthetic scheduled vote',timing:'LATER',localTime:'',timeZone:'America/New_York',occurrence:'EARLIER',plannedAt:null,duration:30,location:'QA meeting',instructions:'Synthetic only',status:'SCHEDULED',announcedUserIds:[]};
function future(){const date=new Date(Date.now()+2*86400000);return new Intl.DateTimeFormat('sv-SE',{timeZone:meeting.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(' ','T');}
const options=()=>({fields:['name','gpa'],highlights:{},meeting:{...meeting,localTime:future()}});
const body=()=>({clubId,cycleId,roundId,sessionId,leaderMemberIds:[leaderId],participantIds:[voterId],applicationIds:apps,targetSize:null,presentationOptions:options()});
test('scheduled creation is idempotent, waiting until explicit early-confirmed start, without ballots, notifications or decisions',async()=>{
 const h=harness(),d=body();await h.api.createLiveVotingRoom(d);await h.api.createLiveVotingRoom(d);let s=await h.read();assert.equal(s.status,'DRAFT');assert.equal(s.meeting.status,'SCHEDULED');assert.equal(s.participation.eligible,1);assert.equal(s.permissions.voter,false);assert.equal(h.state().sessions.length,1);assert.equal(h.state().sessions[0].passes.length,0);assert.equal(h.state().notifications.length,0);assert.equal((await h.command('START')).code,'EARLY_CONFIRMATION_REQUIRED');assert.equal((await h.command('START',{confirmed:true})).ok,true);assert.equal(h.state().sessions[0].passes.length,1);assert.ok(h.state().apps.every(a=>a.status==='IN_REVIEW'));assert.equal(h.state().notifications.length,0);
});
test('notification consent creates exact-session intents once, cancellation is explicit and retry-safe',async()=>{
 const h=harness(),d={...body(),notifyVoters:true};await h.api.createLiveVotingRoom(d);await h.api.createLiveVotingRoom(d);assert.equal(h.state().notifications.length,1);assert.equal(h.state().notifications[0].userId,voterId);assert.equal(h.state().notifications[0].href,`/voting/rooms/${sessionId}?clubId=${clubId}&view=member`);const api=load('actions/voting-session-setup.ts',h.mocks),cancel={clubId,sessionId,revision:0,requestId:uuid(1000),notify:true};await api.cancelVotingSession(cancel);await api.cancelVotingSession(cancel);assert.equal(h.state().notifications.length,2);assert.equal((await h.read()).meeting.status,'CANCELLED');assert.equal((await h.command('START')).ok,false);assert.equal(h.state().sessions[0].passes.length,0);assert.ok(h.state().apps.every(a=>a.status==='IN_REVIEW'));
});
test('editing replaces only an unstarted explicit roster, stale concurrent edits preserve committed data, history and receipts',async()=>{
 const h=harness(),d=body();await h.api.createLiveVotingRoom(d);const api=load('actions/voting-session-setup.ts',h.mocks),edit={...d,requestId:uuid(1001),revision:0,participantIds:[leaderId],applicationIds:[apps[1]],presentationOptions:{...d.presentationOptions,meeting:{...d.presentationOptions.meeting,name:'Revised synthetic vote'}}};const a=await api.updateVotingSessionSetup(edit);await api.updateVotingSessionSetup(edit);assert.equal(a.revision,1);assert.deepEqual(h.state().sessions[0].candidates.map(c=>c.applicationId),[apps[1]]);assert.deepEqual(h.state().sessions[0].participants.map(p=>p.memberId),[leaderId]);await assert.rejects(api.updateVotingSessionSetup({...edit,requestId:uuid(1002)}),/changed in another tab/);assert.equal(h.state().audit.filter(a=>a.action==='voting.session.setup_updated').length,1);await h.command('START',{confirmed:true});await assert.rejects(api.updateVotingSessionSetup({...edit,revision:2,requestId:uuid(1003)}),/locked/);assert.equal(h.state().sessions[0].passes.length,1);
});
test('saved eligibility is rechecked at start without silently replacing applicants or voters',async()=>{
 const h=harness();await h.api.createLiveVotingRoom(body());h.members[1].permissions=[];await assert.rejects(h.command('START',{confirmed:true}),/permissions/);assert.equal(h.state().sessions[0].state,'DRAFT');assert.equal(h.state().sessions[0].participants.length,1);h.members[1].permissions=['applications.review','applicants.identify','decisions.vote'];h.state().apps[0].status='WAITLISTED';assert.equal((await h.command('START',{confirmed:true})).code,'SELECTION_CHANGED');assert.equal(h.state().sessions[0].passes.length,0);
});
test('setup reading/editing/cancelling requires current explicit leadership, club scope and membership',async()=>{
 const h=harness();await h.api.createLiveVotingRoom(body());const api=load('actions/voting-session-setup.ts',h.mocks);h.as(voterId);await assert.rejects(api.getVotingSessionSetup({clubId,sessionId}),/Denied/);await assert.rejects(api.updateVotingSessionSetup({...body(),requestId:uuid(1010),revision:0}),/Denied/);await assert.rejects(api.cancelVotingSession({clubId,sessionId,requestId:uuid(1011),revision:0}),/Denied/);h.as(leaderId);h.members[0].status='REMOVED';await assert.rejects(api.getVotingSessionSetup({clubId,sessionId}),/Denied/);
});
test('calendar gaps are rejected, repeated times resolve explicitly, caller UTC/history cannot override authority',()=>{
 const {resolveVotingMeeting}=load('lib/voting-session-setup.ts');assert.throws(()=>resolveVotingMeeting({...meeting,localTime:'2027-03-14T02:30'},{future:false}),/does not exist/);const early=resolveVotingMeeting({...meeting,localTime:'2026-11-01T01:30',plannedAt:'2000-01-01T00:00:00.000Z',announcedUserIds:[leaderId]},{future:false}),late=resolveVotingMeeting({...meeting,localTime:'2026-11-01T01:30',occurrence:'LATER'},{future:false});assert.equal(+new Date(late.plannedAt)-+new Date(early.plannedAt),3600000);assert.deepEqual(early.announcedUserIds,[]);assert.throws(()=>resolveVotingMeeting({...meeting,localTime:'2020-01-01T12:00'}),/future/);
});
test('failed notification intent rolls creation back; retry creates one waiting session and one notice',async()=>{
 const h=harness(),create=h.tx.userNotification.createMany;h.tx.userNotification.createMany=async()=>{throw Error('Synthetic outbox unavailable')};const d={...body(),notifyVoters:true};await assert.rejects(h.api.createLiveVotingRoom(d),/outbox unavailable/);assert.equal(h.state().sessions.length,0);assert.equal(h.state().receipts.length,0);h.tx.userNotification.createMany=create;await h.api.createLiveVotingRoom(d);assert.equal(h.state().sessions.length,1);assert.equal(h.state().notifications.length,1);
});
test('unfinished setup drafts use private revisioned editor storage, require leadership, and never create a room or notify',async()=>{
 const h=harness(),api=load('actions/editor-drafts.ts',h.mocks),plans=load('actions/voting-session-setup.ts',h.mocks),scope={kind:'voting-setup',clubId,resourceId:uuid(2000)},content={version:1,step:1,cycle:cycleId,round:roundId,name:'Unfinished synthetic setup',timing:'NOW',localTime:'',timeZone:'America/New_York',occurrence:'EARLIER',duration:'',location:'',instructions:'',applicants:[],voters:[],target:'',fields:[],highlights:{},notify:false,initialized:true,sessionId:uuid(2000),planRevision:null};const d={scope,content,base:'',revision:0,mutationId:uuid(2001)};
 assert.equal((await api.saveEditorDraft(d)).revision,1);assert.equal((await api.saveEditorDraft(d)).revision,1);assert.equal((await api.getEditorDraft(scope)).content.name,content.name);assert.equal((await plans.listVotingSetupDrafts({clubId})).length,1);assert.equal((await api.saveEditorDraft({...d,mutationId:uuid(2002)})).error,'conflict');h.as(voterId);await assert.rejects(api.getEditorDraft(scope),/Denied|permission/);assert.equal(h.state().sessions.length,0);assert.equal(h.state().notifications.length,0);
});
test('Discard draft tombstones only the caller own club-scoped setup draft, requires leadership and hides drafts of created sessions',async()=>{
 const h=harness(),api=load('actions/editor-drafts.ts',h.mocks),plans=load('actions/voting-session-setup.ts',h.mocks),content=(id,name)=>({version:1,step:1,cycle:cycleId,round:roundId,name,timing:'NOW',localTime:'',timeZone:'America/New_York',occurrence:'EARLIER',duration:'',location:'',instructions:'',applicants:[],voters:[],target:'',fields:[],highlights:{},notify:false,initialized:true,sessionId:id,planRevision:null});
 const save=(id,name,n)=>api.saveEditorDraft({scope:{kind:'voting-setup',clubId,resourceId:id},content:content(id,name),base:'',revision:0,mutationId:uuid(3000+n)});
 await save(uuid(2100),'Keep me',1);await save(uuid(2101),'Discard me',2);await save(sessionId,'Scheduled already',3);await h.api.createLiveVotingRoom(body());
 assert.deepEqual((await plans.listVotingSetupDrafts({clubId})).map(d=>d.name).sort(),['Discard me','Keep me']);
 h.as(voterId);await assert.rejects(plans.discardVotingSetupDraft({clubId,draftId:uuid(2101)}),/Denied|permission/);h.as(leaderId);
 await assert.rejects(plans.discardVotingSetupDraft({clubId,draftId:'../other'}));
 assert.deepEqual(await plans.discardVotingSetupDraft({clubId,draftId:uuid(2101)}),{discarded:true});assert.deepEqual(await plans.discardVotingSetupDraft({clubId,draftId:uuid(2101)}),{discarded:true});
 const row=h.state().drafts.find(d=>d.key===`voting-setup:${clubId}:${uuid(2101)}`);assert.equal(row.content,null);assert.equal(row.revision,2);
 assert.deepEqual((await plans.listVotingSetupDrafts({clubId})).map(d=>d.name),['Keep me']);assert.equal(h.state().sessions.length,1);
 // An open editor still holding revision 1 cannot resurrect the discarded draft.
 assert.equal((await api.saveEditorDraft({scope:{kind:'voting-setup',clubId,resourceId:uuid(2101)},content:content(uuid(2101),'Stale tab'),base:'',revision:1,mutationId:uuid(3999)})).error,'conflict');
});
test('setup drafts accept saved rule-editor state and bound its size',()=>{
 const {setupDraftSchema}=require('./helpers/communications-loader.cjs').loader({})('lib/voting-session-setup.ts');
 const draft={version:1,step:2,cycle:'',round:'',name:'',timing:'NOW',localTime:'',timeZone:'America/New_York',occurrence:'EARLIER',duration:'',location:'',instructions:'',applicants:[],voters:[],target:'',fields:[],highlights:{},notify:false,initialized:false,sessionId:uuid(1),planRevision:null};
 const rules={mode:'THRESHOLD',numerator:'2',denominator:'3',base:'BALLOTS_CAST',pNumerator:'1',pDenominator:'2',below:'HOLD',reviewed:false};
 assert.deepEqual(setupDraftSchema.parse({...draft,rules}).rules,rules);assert.equal(setupDraftSchema.parse(draft).rules,undefined);
 assert.equal(setupDraftSchema.safeParse({...draft,rules:{mode:'THRESHOLD',list:Array(1000).fill('x')}}).success,false);
 assert.equal(setupDraftSchema.safeParse({...draft,rules:Object.fromEntries(Array.from({length:17},(_,i)=>['k'+i,'']))}).success,false);
});
test('editing a scheduled session with prepared slides is a diff: kept highlights stay, reorder/add work, removed highlights are discarded and audited, stale or started edits are refused',async()=>{
 const h=harness(),d={...body(),applicationIds:apps.slice(0,2)};await h.api.createLiveVotingRoom(d);
 const api=load('actions/voting-session-setup.ts',h.mocks),prep=a=>({sessionId,applicationId:a,highlights:[{id:a}],revision:2,updatedBy:leaderId});
 h.state().preparations.push(prep(apps[0]),prep(apps[1]));
 let revision=0,n=0;const edit=async(applicationIds,extra={})=>{const r=await api.updateVotingSessionSetup({...d,applicationIds,requestId:uuid(1100+n++),revision,...extra});revision=r.revision;return r;};
 const order=()=>h.state().sessions[0].candidates.slice().sort((a,b)=>a.position-b.position).map(c=>[c.applicationId,c.position,c.expectedStatus]);
 const prepared=()=>h.state().preparations.map(p=>[p.applicationId,p.highlights[0].id,p.revision]).sort();
 // Same applicants: succeeds, highlights untouched; a changed application status is re-snapshotted in place.
 h.state().apps[0].status='WAITLISTED';
 await edit(apps.slice(0,2));assert.deepEqual(order(),[[apps[0],0,'WAITLISTED'],[apps[1],1,'IN_REVIEW']]);assert.deepEqual(prepared(),[[apps[0],apps[0],2],[apps[1],apps[1],2]]);
 // Reorder.
 await edit([apps[1],apps[0]]);assert.deepEqual(order().map(c=>c.slice(0,2)),[[apps[1],0],[apps[0],1]]);assert.equal(prepared().length,2);
 // Add.
 await edit([apps[1],apps[2],apps[0]]);assert.deepEqual(order().map(c=>c.slice(0,2)),[[apps[1],0],[apps[2],1],[apps[0],2]]);assert.equal(prepared().length,2);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.slides.discarded').length,0);
 // Removing a prepared applicant without confirming it is refused with the current list and writes nothing.
 const unconfirmed=await api.updateVotingSessionSetup({...d,applicationIds:[apps[2],apps[0]],requestId:uuid(1149),revision});
 assert.deepEqual(unconfirmed,{ok:false,code:'HIGHLIGHTS_CHANGED',applicationIds:[apps[1]]});assert.equal(h.state().sessions[0].revision,revision);assert.equal(prepared().length,2);assert.equal(h.state().receipts.filter(x=>x.requestId===uuid(1149)).length,0);
 // Confirmed: only their highlights are discarded, and audited with IDs, revisions and authors only.
 const removal={...d,applicationIds:[apps[2],apps[0]],requestId:uuid(1150),revision,confirmDiscard:[apps[1]]};const r=await api.updateVotingSessionSetup(removal);revision=r.revision;
 assert.deepEqual(order().map(c=>c.slice(0,2)),[[apps[2],0],[apps[0],1]]);assert.deepEqual(prepared(),[[apps[0],apps[0],2]]);
 const discarded=h.state().audit.filter(a=>a.action==='voting.slides.discarded');
 assert.equal(discarded.length,1);assert.deepEqual(discarded[0].details,{revision:r.revision,count:1,applicationIds:[apps[1]],preparations:[{applicationId:apps[1],revision:2,updatedBy:leaderId}]});assert.doesNotMatch(JSON.stringify(discarded[0].details),/highlights/);assert.equal(discarded[0].targetId,sessionId);assert.equal(discarded[0].clubId,clubId);
 // Request-ID replay returns the receipt without writing again.
 assert.deepEqual(await api.updateVotingSessionSetup(removal),r);assert.equal(h.state().audit.filter(a=>a.action==='voting.slides.discarded').length,1);
 // Stale revision, and two concurrent edits from the same revision: one wins, the other is refused with nothing lost.
 await assert.rejects(api.updateVotingSessionSetup({...d,applicationIds:[apps[0]],requestId:uuid(1160),revision:revision-1}),/changed in another tab/);
 const results=await Promise.allSettled([[apps[0],apps[2]],[apps[0]]].map((ids,i)=>api.updateVotingSessionSetup({...d,applicationIds:ids,requestId:uuid(1170+i),revision})));
 assert.deepEqual(results.map(x=>x.status),['fulfilled','rejected']);assert.match(results[1].reason.message,/changed in another tab/);revision=results[0].value.revision;
 assert.deepEqual(order().map(c=>c[0]),[apps[0],apps[2]]);assert.deepEqual(prepared(),[[apps[0],apps[0],2]]);
 // Started: setup stays locked and preparation history is retained.
 await h.command('START',{confirmed:true});assert.equal(h.state().sessions[0].passes.length,1);
 await assert.rejects(api.updateVotingSessionSetup({...d,applicationIds:[apps[2]],requestId:uuid(1180),revision:h.state().sessions[0].revision}),/locked/);
 assert.deepEqual(prepared(),[[apps[0],apps[0],2]]);assert.deepEqual(order().map(c=>c[0]),[apps[0],apps[2]]);
});
test('a stale page cannot silently discard highlights another leader saved after it loaded; the refreshed list is confirmed under a new request',async()=>{
 const h=harness(),d={...body(),applicationIds:apps};await h.api.createLiveVotingRoom(d);
 const api=load('actions/voting-session-setup.ts',h.mocks),otherLeader=uuid(77);
 // Leader A loads setup: nothing prepared yet.
 assert.deepEqual((await api.getVotingSessionSetup({clubId,sessionId})).preparedApplicationIds,[]);
 // Leader B then saves highlights for applicant X (preparation saves do not bump the session revision); an empty preparation exists for another.
 h.state().preparations.push({sessionId,applicationId:apps[1],highlights:[{id:'quote'}],revision:3,updatedBy:otherLeader},{sessionId,applicationId:apps[2],highlights:[],revision:2,updatedBy:otherLeader});
 assert.deepEqual((await api.getVotingSessionSetup({clubId,sessionId})).preparedApplicationIds,[apps[1]],'only non-empty preparations are reported');
 // A's page still believes nothing is prepared and removes X (and the applicant with an empty preparation).
 const stale=await api.updateVotingSessionSetup({...d,applicationIds:[apps[0]],requestId:uuid(1300),revision:0,confirmDiscard:[]});
 assert.deepEqual(stale,{ok:false,code:'HIGHLIGHTS_CHANGED',applicationIds:[apps[1]]});
 assert.equal(h.state().sessions[0].revision,0);assert.equal(h.state().sessions[0].candidates.length,3);assert.equal(h.state().preparations.length,2);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.slides.discarded').length,0);
 // Confirming a different applicant is not enough.
 assert.equal((await api.updateVotingSessionSetup({...d,applicationIds:[apps[0]],requestId:uuid(1301),revision:0,confirmDiscard:[apps[2]]})).code,'HIGHLIGHTS_CHANGED');
 // A confirms the refreshed list and retries under a new request ID.
 const saved=await api.updateVotingSessionSetup({...d,applicationIds:[apps[0]],requestId:uuid(1302),revision:0,confirmDiscard:[apps[1]]});
 assert.equal(saved.revision,1);assert.deepEqual(h.state().sessions[0].candidates.map(c=>c.applicationId),[apps[0]]);assert.equal(h.state().preparations.length,0);
 const [audit]=h.state().audit.filter(a=>a.action==='voting.slides.discarded');
 assert.deepEqual(audit.details,{revision:1,count:2,applicationIds:[apps[1],apps[2]].sort(),preparations:[{applicationId:apps[1],revision:3,updatedBy:otherLeader},{applicationId:apps[2],revision:2,updatedBy:otherLeader}].sort((a,b)=>a.applicationId.localeCompare(b.applicationId))});
 await assert.rejects(api.updateVotingSessionSetup({...d,applicationIds:[apps[0]],requestId:uuid(1303),revision:0,confirmDiscard:new Array(2001).fill(apps[1])}));
});
