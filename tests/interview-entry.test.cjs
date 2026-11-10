const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,id}=require('./helpers/interview-harness.cjs');
const {harness:demoHarness}=require('./helpers/demo-harness.cjs');
test('status does not invent completion or call a missed session upcoming; ongoing work precedes history',()=>{
 const api=harness().load('lib/interview-entry.ts'),now=Date.parse('2026-10-20T17:00:00Z'),base={id:'future',startTime:'2026-10-21T17:00:00Z',endTime:'2026-10-21T17:20:00Z',bookingId:'booking',started:false,completed:false,cancelled:false};
 assert.equal(api.interviewEntryStatus(base,now),'Upcoming');assert.equal(api.interviewEntryStatus({...base,bookingId:null},now),'Needs a time');assert.equal(api.interviewEntryStatus({...base,completed:true},now),'Review submitted');assert.equal(api.interviewEntryStatus({...base,cancelled:true},now),'Cancelled');
 const missed={...base,id:'missed',startTime:'2026-10-19T17:00:00Z',endTime:'2026-10-19T17:20:00Z'};assert.equal(api.interviewEntryStatus(missed,now),'Scheduled time has ended');assert.equal(api.interviewEntryStatus({...missed,started:true},now),'In progress');assert.deepEqual(api.sortInterviewEntries([missed,base,{...missed,id:'ongoing',started:true}],now).map(r=>r.id),['ongoing','future','missed']);
 const q=new URL(api.interviewEntryHref({...base,clubId:id(1),applicationId:id(2),roundId:id(3),slotId:id(5),roomId:id(6),reviewId:id(7)}),'https://out-class.net').searchParams;assert.equal(q.get('tool'),'reviews');assert.equal(q.has('interviewTab'),false);assert.equal(q.get('reviewId'),id(7));assert.equal(q.has('interview'),false);
});
test('exact destinations retain slot, booking, club and round; Back preserves originating filters and never accepts an external return',()=>{
 const api=harness().load('lib/interview-entry.ts'),entry={clubId:id(1),applicationId:id(2),roundId:id(3),bookingId:id(4),slotId:id(5),roomId:id(6)};
 const href=api.interviewEntryHref(entry,`/club/${id(1)}/workspace?section=recruitment&tool=interviews&interviewTab=schedule&date=2026-10-20&sessionId=${id(5)}`),q=new URL(href,'https://out-class.net').searchParams;
 for(const [k,v]of Object.entries(entry))if(k!=='clubId')assert.equal(q.get(k),v);
 assert.equal(q.get('date'),'2026-10-20');assert.equal(q.get('interviewTab'),'schedule');
 const back=new URL(api.interviewListHref(id(1),q.toString()),'https://out-class.net');assert.equal(back.searchParams.has('interview'),false);assert.equal(back.searchParams.get('date'),'2026-10-20');assert.equal(back.searchParams.has('applicationId'),false);
 assert.ok(href.startsWith(`/club/${id(1)}/interview?`),href);assert.equal(q.has('section'),false);assert.equal(q.has('interview'),false);
 assert.ok(api.interviewEntryHref(entry,'https://outside.test/other?injected=1').startsWith(`/club/${id(1)}/interview?`));
 // Advancing inside the room keeps the same list filters.
 assert.equal(new URL(api.interviewEntryHref(entry,'https://out-class.net'+href),'https://out-class.net').searchParams.get('date'),'2026-10-20');assert.ok(!api.interviewEntryHref(entry,'https://outside.test/other?injected=1').includes('injected'));
});
test('server exact entry returns unavailable (no thrown 500) for revoked, cross-club/round, cancelled and replaced bookings; supported manual assignments remain available',async()=>{
 const h=harness(),api=h.load('actions/interview-entry.ts');assert.deepEqual(await api.resolveInterviewRoomEntry(h.scope),{applicationId:h.scope.applicationId,roundId:h.scope.roundId});
 assert.match((await api.resolveInterviewRoomEntry({...h.scope,bookingId:id(4),slotId:id(5)})).unavailable,/changed|cancelled/);
 assert.match((await api.resolveInterviewRoomEntry({...h.scope,clubId:id(8)})).unavailable,/isn’t available with your current access/);
 assert.match((await api.resolveInterviewRoomEntry({...h.scope,roundId:id(8)})).unavailable,/isn’t available with your current access/);
 h.assignments[0].revokedAt=new Date();const denied=(await api.resolveInterviewRoomEntry(h.scope)).unavailable;assert.match(denied,/isn’t available with your current access/);
 // A non-panel member cannot tell a real application from a random ID.
 assert.equal((await api.resolveInterviewRoomEntry({...h.scope,applicationId:id(9)})).unavailable,denied);h.assignments[0].revokedAt=null;
 const room={id:id(6),clubId:h.scope.clubId,roundId:h.scope.roundId,isOpen:true,panelApprovedBy:h.members[0].userId,panelMemberIds:[h.members[0].id],approvedPanelMemberIds:[h.members[0].id]};
 const booking={id:id(4),applicationId:h.scope.applicationId,roundId:h.scope.roundId,slotId:id(5),slot:{id:id(5),roomId:room.id,room,panelScheduleVersionId:null}};
 h.tx.interviewBooking.findUnique=async()=>booking;h.tx.clubMember.findFirst=async({where})=>h.members.find(m=>m.userId===where.userId&&m.clubId===where.clubId&&m.isOwner&&m.status==='ACTIVE');
 const request={...h.scope,bookingId:booking.id,slotId:booking.slotId,roomId:room.id};await api.resolveInterviewRoomEntry(request);
 assert.match((await api.resolveInterviewRoomEntry({...request,slotId:id(7)})).unavailable,/changed/);room.isOpen=false;assert.match((await api.resolveInterviewRoomEntry(request)).unavailable,/assignment/);room.isOpen=true;
 room.approvedPanelMemberIds=[];assert.match((await api.resolveInterviewRoomEntry(request)).unavailable,/assignment/);
});
test('assignment notification projects the identical current booking destination and never adds a time gate',async()=>{
 const h=harness(),member=h.members[0];h.tx.clubMember.findFirst=async()=>member;h.tx.interviewPanelAssignment.findFirst=async()=>h.assignments[0];
 const room={id:id(6),clubId:h.scope.clubId,roundId:h.scope.roundId,isOpen:true,panelApprovedBy:member.userId,panelMemberIds:[member.id],approvedPanelMemberIds:[member.id],name:'Synthetic room'};
 const booking={id:id(4),applicationId:h.scope.applicationId,roundId:h.scope.roundId,slotId:id(5),slot:{id:id(5),roomId:room.id,room,panelScheduleVersionId:null,startTime:new Date('2099-10-20T17:00:00Z')}};h.tx.interviewBooking.findUnique=async()=>booking;
 const api=h.load('utils/interview-assignment-notifications.ts'),route=h.load('lib/interview-entry.ts');const notice={clubId:h.scope.clubId,eventKey:'interview-assignment:synthetic:assigned:booking',href:`/club/${h.scope.clubId}/workspace?interview=1&applicationId=${h.scope.applicationId}&roundId=${h.scope.roundId}`};
 const result=await api.currentAssignmentNotification(h.tx,notice,member.userId);assert.equal(result.href,route.interviewEntryHref({...h.scope,bookingId:booking.id,slotId:booking.slotId,roomId:room.id}));
 assert.equal(await api.currentAssignmentNotification(h.tx,{...notice,eventKey:'interview-assignment:synthetic:cancelled:booking'},member.userId),null);
});
test('server list is official-panel and personal-grant scoped; withheld/empty slots never expose a candidate',async()=>{
 const h=harness(),member=h.members[0];for(const m of h.members){m.club={name:'Synthetic club'};m.user.studentProfile={firstName:'Synthetic',lastName:m.id};}
 const room={id:id(6),clubId:h.scope.clubId,roundId:h.scope.roundId,round:h.round,name:'Synthetic room',location:'Synthetic location',timezone:'America/New_York',duration:20,buffer:5,isOpen:true,panelApprovedBy:member.userId,panelMemberIds:[member.id],approvedPanelMemberIds:[member.id]};
 const slot={id:id(5),clubId:h.scope.clubId,roomId:room.id,room,panelScheduleVersionId:null,panelScheduleVersion:null,startTime:new Date('2026-10-20T17:00:00Z'),endTime:new Date('2026-10-20T17:20:00Z'),bookings:[]};
 h.tx.clubMember.findMany=async({where})=>where.isOwner?h.members.filter(m=>m.isOwner):h.members;h.tx.clubMember.findFirst=async()=>member;h.tx.interviewSlot={findMany:async()=>[slot]};
 const api=h.load('actions/interview-entry.ts');let rows=await api.getAssignedInterviewRooms(h.scope.clubId);assert.equal(rows.length,1);assert.equal(rows[0].candidate,null);assert.equal(rows[0].canOpen,false);
 const booking={id:id(4),slotId:slot.id,applicationId:h.app.id,roundId:h.round.id,application:{...h.app,student:{studentProfile:{firstName:'Synthetic',lastName:'Candidate'}}}};slot.bookings.push(booking);
 rows=await api.getAssignedInterviewRooms(h.scope.clubId);assert.equal(rows[0].applicationId,h.app.id);assert.equal(rows[0].candidate,'Synthetic Candidate');assert.equal(rows[0].canOpen,true);
 h.assignments[0].revokedAt=new Date();assert.deepEqual(await api.getAssignedInterviewRooms(h.scope.clubId),[]);h.assignments[0].revokedAt=null;
 room.round.anonymousReview=true;rows=await api.getAssignedInterviewRooms(h.scope.clubId);assert.equal(rows[0].canOpen,false);assert.equal(rows[0].applicationId,null);assert.notEqual(rows[0].candidate,'Synthetic Candidate');assert.deepEqual(rows[0].interviewers,[]);
});
function demo(){const h=demoHarness(),s=h.load('lib/demo/store.ts'),f=h.load('lib/demo/interview-foundation.ts'),entry=h.load('lib/demo/interview-entry.ts');s.demoStore.start(h.load('lib/demo/seed.ts').createDemoSeed('2026-10-18'));s.demoStore.mutate(v=>v.perspective={role:'leader',clubId:v.clubs[0].id});return{h,s,f,entry,clubId:s.demoStore.get().clubs[0].id};}
test('Demo booked rooms open exactly, including simultaneous different rounds; drafts, own phases, refresh and submitted review remain scoped',()=>{
 const x=demo(),rows=x.entry.getAssignedInterviewRooms(x.clubId),booked=rows.filter(r=>r.canOpen);assert.ok(booked.length>=2);assert.notEqual(booked[0].roundId,booked[1].roundId);
 const a=booked[0],b=booked[1],scope=r=>({clubId:r.clubId,applicationId:r.applicationId,roundId:r.roundId,bookingId:r.bookingId,slotId:r.slotId,roomId:r.roomId});
 x.s.demoStore.mutate(v=>{const room=v.interviewRooms.find(r=>r.id===b.roomId),slot=room.slots.find(s=>s.id===b.slotId),booking=v.roomBookings.find(r=>r.id===b.bookingId);slot.startTime=a.startTime;slot.endTime=a.endTime;booking.startTime=a.startTime;booking.endTime=a.endTime;const legacy=v.slots.find(s=>s.id===booking.id);legacy.startTime=new Date(a.startTime);legacy.endTime=new Date(a.endTime)});
 for(const row of booked)assert.equal(x.entry.resolveInterviewRoomEntry(scope(row)).applicationId,row.applicationId);
 const own=x.f.openInterviewSession(scope(a));if(!own.completedAt){assert.ok(!own.draft.postInterview);x.f.saveInterviewSession({...scope(a),revision:own.revision,draft:{...own.draft,postInterview:true,additionalNotes:'Synthetic discussion draft'}});x.s.demoStore.refresh();assert.equal(x.f.openInterviewSession(scope(a)).draft.postInterview,true);assert.equal(x.f.openInterviewSession(scope(a)).draft.additionalNotes,'Synthetic discussion draft');}
 const other=x.f.openInterviewSession(scope(b));if(!other.completedAt)assert.ok(!other.draft.postInterview);
 const latest=x.f.openInterviewSession(scope(a));if(!latest.completedAt){x.f.saveInterviewSession({...scope(a),revision:latest.revision,draft:{...latest.draft,score:8.5},complete:true});assert.ok(x.entry.getAssignedInterviewRooms(x.clubId).find(r=>r.id===a.id).completed);assert.ok(x.f.openInterviewSession(scope(a)).completedAt);assert.throws(()=>x.f.saveInterviewSession({...scope(a),revision:latest.revision,draft:{...latest.draft,score:9},complete:true}),/completed/);}
 assert.ok(rows.some(r=>!r.bookingId&&!r.canOpen));
 x.s.demoStore.mutate(v=>{v.interviewFoundation.assignments.find(g=>g.applicationId===a.applicationId&&g.roundId===a.roundId&&g.memberId===x.s.demoMember().id).revokedAt=new Date().toISOString()});assert.throws(()=>x.entry.resolveInterviewRoomEntry(scope(a)),/assignment/);assert.ok(!x.entry.getAssignedInterviewRooms(x.clubId).some(r=>r.applicationId===a.applicationId));
 x.s.demoStore.mutate(v=>{v.interviewRooms.find(r=>r.id===b.roomId).isOpen=false});assert.throws(()=>x.entry.resolveInterviewRoomEntry(scope(b)),/cancelled/);assert.ok(x.entry.getAssignedInterviewRooms(x.clubId).some(r=>r.roomId===b.roomId&&r.cancelled&&!r.candidate));
 assert.equal(x.h.calls(),0);x.s.demoStore.stop();
});
test('saved Demo initialization is additive/idempotent and unchanged room reads never persist',()=>{
 const x=demo(),before=structuredClone(x.s.demoStore.get().interviews);let writes=0,notices=0;const write=localStorage.setItem;localStorage.setItem=(...args)=>{writes++;return write.apply(localStorage,args)};const off=x.s.demoStore.subscribe(()=>notices++);
 for(let i=0;i<5;i++){x.entry.getAssignedInterviewRooms(x.clubId);x.s.demoStore.refresh();}
 assert.equal(writes,0);assert.equal(notices,0);assert.deepEqual(x.s.demoStore.get().interviews,before);
 const old=structuredClone(x.s.demoStore.get());delete old.interviewFoundation.roomEntrySeeded;const originalCount=old.interviewRooms.length;x.h.load('lib/demo/interview-improvements.ts').ensureInterviewRoomEntries(old);assert.equal(old.interviewRooms.length,originalCount);assert.deepEqual(old.interviews,before);off();x.s.demoStore.stop();
});

test('scheduled times are context only: the same entry action before, during, after and days after the slot (controlled clock)',()=>{
 const api=harness().load('lib/interview-entry.ts');
 const row={id:'r',slotId:'s',roomId:'m',bookingId:'b',clubId:id(1),roundId:id(3),roundName:'Round A',roomName:'Room',location:'',timezone:'America/New_York',startTime:'2026-11-06T20:00:00Z',endTime:'2026-11-06T20:20:00Z',applicationId:id(2),candidate:'Synthetic Candidate',interviewers:[],completed:false,started:false,cancelled:false,canOpen:true};
 const at=t=>Date.parse(t),times={before:at('2026-11-06T19:50:00Z'),during:at('2026-11-06T20:10:00Z'),after:at('2026-11-06T20:45:00Z'),later:at('2026-11-09T15:00:00Z')};
 assert.equal(api.interviewTimingContext(row,times.before),'Scheduled for 3:00–3:20 PM EST · Starts in 10 minutes');
 assert.equal(api.interviewTimingContext(row,times.during),'Scheduled for 3:00–3:20 PM EST · Scheduled now');
 assert.equal(api.interviewTimingContext(row,times.after),'Scheduled for 3:00–3:20 PM EST · Scheduled time has ended');
 assert.equal(api.interviewTimingContext({...row,startTime:'2026-11-06T16:30:00Z',endTime:'2026-11-06T17:10:00Z'},times.before),'Scheduled for 11:30 AM–12:10 PM EST · Scheduled time has ended');
 for(const now of Object.values(times)){assert.equal(api.interviewEntryAction(row),'Enter interview');assert.equal(row.canOpen,true);}
 assert.deepEqual([api.interviewEntryStatus(row,times.before),api.interviewEntryStatus(row,times.during),api.interviewEntryStatus(row,times.after),api.interviewEntryStatus(row,times.later)],['Upcoming','Scheduled now','Scheduled time has ended','Scheduled time has ended']);
 // Each interviewer's own state decides the action; ended time never hides it.
 assert.equal(api.interviewEntryAction({...row,started:true}),'Resume interview');assert.equal(api.interviewEntryAction({...row,completed:true}),'View review');
 assert.equal(api.interviewEntryStatus({...row,started:true},times.later),'In progress');
 // Distinct states: cancelled booking vs submitted review vs ended time.
 assert.equal(api.interviewEntryStatus({...row,cancelled:true},times.after),'Cancelled');assert.equal(api.interviewEntryStatus({...row,completed:true},times.after),'Review submitted');
 // Unfinished interviews remain discoverable after their date; not future, finished, cancelled, unbooked or unopenable ones.
 const rows=[{...row,id:'past'},{...row,id:'resumed',started:true},{...row,id:'future',startTime:'2026-11-20T20:00:00Z',endTime:'2026-11-20T20:20:00Z'},{...row,id:'done',completed:true},{...row,id:'cancel',cancelled:true},{...row,id:'unbooked',bookingId:null},{...row,id:'denied',canOpen:false,applicationId:null}];
 assert.deepEqual(api.unfinishedInterviewEntries(rows,times.later).map(r=>r.id),['past','resumed']);
 assert.deepEqual(api.unfinishedInterviewEntries(rows,times.before).map(r=>r.id),[]);
});
test('server entry is identical for a slot far in the past: open after a later date, denials unchanged',async()=>{
 const h=harness(),member=h.members[0];for(const m of h.members){m.club={name:'Synthetic club'};m.user.studentProfile={firstName:'Synthetic',lastName:m.id};}
 const room={id:id(6),clubId:h.scope.clubId,roundId:h.scope.roundId,round:h.round,name:'Synthetic room',location:'Synthetic location',timezone:'America/New_York',duration:20,buffer:5,isOpen:true,panelApprovedBy:member.userId,panelMemberIds:[member.id],approvedPanelMemberIds:[member.id]};
 const slot={id:id(5),clubId:h.scope.clubId,roomId:room.id,room,panelScheduleVersionId:null,panelScheduleVersion:null,startTime:new Date('2020-01-06T17:00:00Z'),endTime:new Date('2020-01-06T17:20:00Z'),bookings:[]};
 h.tx.clubMember.findMany=async({where})=>where.isOwner?h.members.filter(m=>m.isOwner):h.members;h.tx.clubMember.findFirst=async()=>member;h.tx.interviewSlot={findMany:async()=>[slot]};
 const booking={id:id(4),slotId:slot.id,applicationId:h.app.id,roundId:h.round.id,application:{...h.app,student:{studentProfile:{firstName:'Synthetic',lastName:'Candidate'}}}};slot.bookings.push(booking);
 const api=h.load('actions/interview-entry.ts');let rows=await api.getAssignedInterviewRooms(h.scope.clubId);
 assert.equal(rows[0].canOpen,true);assert.equal(rows[0].applicationId,h.app.id,'a long-past unfinished interview can still be entered');
 h.tx.interviewBooking.findUnique=async()=>({...booking,slot:{...slot,room}});
 assert.deepEqual(await api.resolveInterviewRoomEntry({...h.scope,bookingId:booking.id,slotId:slot.id,roomId:room.id}),{applicationId:h.scope.applicationId,roundId:h.scope.roundId},'direct link opens after the scheduled end');
 room.isOpen=false;rows=await api.getAssignedInterviewRooms(h.scope.clubId);assert.equal(rows[0].cancelled,true);assert.equal(rows[0].canOpen,false);room.isOpen=true;
 h.assignments[0].revokedAt=new Date();assert.deepEqual(await api.getAssignedInterviewRooms(h.scope.clubId),[]);h.assignments[0].revokedAt=null;
 h.round.archivedAt=new Date();rows=await api.getAssignedInterviewRooms(h.scope.clubId);assert.equal(rows[0].canOpen,false,'closed/archived rounds keep their lifecycle restriction');h.round.archivedAt=null;
});
test('every authorizeInterview denial message is recognised as an expected access denial',()=>{
 const {isInterviewAccessDenial}=require('./helpers/interview-harness.cjs').harness().load('utils/interview-access.ts');
 const src=require('node:fs').readFileSync('utils/interview-access.ts','utf8');const start=src.indexOf('export async function authorizeInterview'),end=src.indexOf('export async function authorizeQuestionBank');
 const messages=[...src.slice(src.indexOf('export async function interviewActor'),end).matchAll(/throw new Error\("([^"]+)"\)/g)].map(m=>m[1]);
 assert.ok(messages.length>=3&&start>0);for(const m of messages)assert.ok(isInterviewAccessDenial(new Error(m)),m);
 assert.equal(isInterviewAccessDenial(new Error('Database offline')),false);
});
