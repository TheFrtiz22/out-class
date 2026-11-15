// Pre-join meeting preview: only eligible voters see name, scheduled start and location; denied viewers get no new fields.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,clubId,sessionId,leaderId,voterId,uuid}=require('./helpers/voting-room-harness.cjs');
const demoHarness=require('./helpers/demo-harness.cjs').harness;
const scope={clubId,sessionId};
const later=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+2*86400000)).replace(' ','T');
const meeting=()=>({version:1,name:'Synthetic scheduled vote',timing:'LATER',localTime:later(),timeZone:'America/New_York',occurrence:'EARLIER',plannedAt:null,duration:30,location:'QA Hall',instructions:'Private synthetic instructions',status:'SCHEDULED',announcedUserIds:[]});

test('an eligible voter reads only the meeting name, scheduled start and location before joining',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);
 await h.create({notifyVoters:true,presentationOptions:{fields:['name','gpa'],highlights:{},meeting:meeting()}});
 const stored=h.state().sessions[0].presentationOptions.meeting;assert.ok(stored.plannedAt);assert.ok(stored.announcedUserIds.includes(voterId),'fixture stores private announcement recipients');
 h.as(voterId);const info=await api.getLiveVotingJoinInfo(scope);
 assert.deepEqual(info,{status:'READY',meeting:{name:'Synthetic scheduled vote',plannedAt:stored.plannedAt,location:'QA Hall'}});
 assert.doesNotMatch(JSON.stringify(info),new RegExp(`${voterId}|${leaderId}|instructions|announced|Private synthetic`));
 await api.joinLiveVotingRoom(scope);assert.deepEqual(Object.keys(await api.getLiveVotingJoinInfo(scope)),['status','meeting']);
 h.as(leaderId);await h.command('START',{confirmed:true});h.as(voterId);
 assert.deepEqual((await api.getLiveVotingJoinInfo(scope)).meeting,{name:'Synthetic scheduled vote',plannedAt:null,location:'QA Hall'},'a started session no longer shows a scheduled start');
});

test('denied, outside, expired and ended viewers receive no meeting fields; cancelled sessions follow the room as ended',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);await h.create({presentationOptions:{fields:['name','gpa'],highlights:{},meeting:meeting()}});
 h.as(uuid(7));assert.deepEqual(await api.getLiveVotingJoinInfo(scope),{status:'DENIED'});
 h.as(voterId);assert.deepEqual(await api.getLiveVotingJoinInfo({...scope,sessionId:uuid(99)}),{status:'EXPIRED'});
 h.members[1].permissions=[];assert.deepEqual(await api.getLiveVotingJoinInfo(scope),{status:'DENIED'});
 const c=harness(),cApi=load('actions/voting-room-setup.ts',c.mocks),plans=load('actions/voting-session-setup.ts',c.mocks);await c.create({presentationOptions:{fields:['name','gpa'],highlights:{},meeting:meeting()}});
 await plans.cancelVotingSession({clubId,sessionId,revision:0,requestId:uuid(1000),notify:false});c.as(voterId);assert.deepEqual(await cApi.getLiveVotingJoinInfo(scope),{status:'ENDED'});
});

test('a session without meeting details keeps the plain pre-join state',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);await h.create();h.as(voterId);
 assert.deepEqual(await api.getLiveVotingJoinInfo(scope),{status:'READY',meeting:null});
});

test('the preview helper drops cancelled meetings, private fields and the start time once started',()=>{
 const {joinMeetingPreview}=load('lib/voting-session-setup.ts');const m={...meeting(),plannedAt:'2026-11-12T15:00:00.000Z',announcedUserIds:[voterId]};
 assert.deepEqual(joinMeetingPreview(m,true),{name:m.name,plannedAt:m.plannedAt,location:'QA Hall'});
 assert.equal(joinMeetingPreview(m,false).plannedAt,null);assert.equal(joinMeetingPreview({...m,status:'CANCELLED'},true),null);
 assert.equal(joinMeetingPreview(undefined,true),null);assert.equal(joinMeetingPreview({name:'legacy'},true),null);
});

test('Demo join info returns the same preview for an isolated voter without live calls or writes',async()=>{
 const h=demoHarness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),dClub=s.clubs[0].id,roundId=s.clubs[0].rounds.find(r=>r.name==='Interview').id;
 const leader=s.memberships.find(m=>m.clubId===dClub&&m.isOwner),voter=s.memberships.find(m=>m.clubId===dClub&&!m.isOwner);
 demoStore.mutate(s=>s.memberships.find(m=>m.id===voter.id).permissions.push('decisions.vote'));
 const api=h.load('lib/voting-room-api.ts'),setup=await api.getLiveVotingSetup({clubId:dClub,roundId,cycleId:dClub}),ids=setup.applicants.slice(0,2).map(a=>a.id);
 const plain={clubId:dClub,sessionId:crypto.randomUUID()},planned={clubId:dClub,sessionId:crypto.randomUUID()};
 await api.createLiveVotingRoom({...plain,cycleId:dClub,roundId,targetSize:null,applicationIds:ids,leaderMemberIds:[leader.id],participantIds:[leader.id,voter.id]});
 await api.createLiveVotingRoom({...planned,cycleId:dClub,roundId,targetSize:null,applicationIds:ids,leaderMemberIds:[leader.id],participantIds:[leader.id,voter.id],presentationOptions:{fields:['name'],highlights:{},meeting:meeting()}});
 let writes=0;const save=localStorage.setItem.bind(localStorage);localStorage.setItem=(...args)=>{writes++;save(...args)};
 assert.deepEqual(await api.getLiveVotingJoinInfo(plain,voter.id),{status:'READY',meeting:null});
 const info=await api.getLiveVotingJoinInfo(planned,voter.id);assert.equal(info.status,'READY');assert.deepEqual(Object.keys(info.meeting).sort(),['location','name','plannedAt']);assert.equal(info.meeting.name,'Synthetic scheduled vote');assert.ok(info.meeting.plannedAt);
 assert.doesNotMatch(JSON.stringify(info),/instructions|announced|Private synthetic/);
 const outsider=s.memberships.find(m=>m.clubId!==dClub);if(outsider)assert.deepEqual(await api.getLiveVotingJoinInfo(planned,outsider.id),{status:'DENIED'});
 assert.equal(writes,0);assert.equal(h.calls(),0);demoStore.stop();
});
