const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,load,clubId,cycleId,roundId,apps,voterId,uuid}=require('./helpers/voting-room-harness.cjs');
const navigation=load('lib/voting-navigation.ts',{});

test('canonical links preserve scope without accepting a return URL or applicant names',()=>{
 for(const [old,tab] of [['voting','voting'],['letters','letters'],['decision-letters','letters'],['applicants',null]])assert.equal(navigation.legacyDecisionTab(old),tab);
 const href=navigation.decisionsHref(clubId,'voting',`cycleId=${cycleId}&roundId=${roundId}&demo=1&sessionId=${uuid(4)}&next=https://evil.invalid`);
 const q=new URL(href,'http://fixture').searchParams;
 assert.equal(q.get('decisionTab'),'voting');assert.equal(q.get('roundId'),roundId);assert.equal(q.get('cycleId'),cycleId);assert.equal(q.get('demo'),'1');assert.equal(q.has('next'),false);assert.equal(q.has('sessionId'),false);
 assert.equal(new URL(navigation.votingSetupHref(clubId,q.toString(),'opaque-selection'),'http://fixture').searchParams.get('selection'),'opaque-selection');
});

test('selection handoff is account, club and Demo scoped and retains stable IDs',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)},scope={userId:uuid(5),clubId,demo:false};
 const key=navigation.saveVotingSelection(storage,{...scope,applicationIds:apps});
 assert.deepEqual(navigation.readVotingSelection(storage,key,scope),apps);
 for(const changed of [{userId:uuid(88)},{clubId:uuid(89)},{demo:true}])assert.throws(()=>navigation.readVotingSelection(storage,key,{...scope,...changed}),/another account or workspace/);
 assert.throws(()=>navigation.readVotingSelection(storage,'missing',scope),/unavailable in this tab/);
});

test('server resolves stale and mixed-scope selections without creating sessions or exposing foreign IDs',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);
 h.state().apps.forEach(a=>{a.round=h.round;a.recruitmentCycle=h.cycle});
 h.state().apps[1].recruitmentCycleId=uuid(77);h.state().apps[2].status='ACCEPTED';
 const result=await api.resolveLiveVotingSelection({clubId,applicationIds:[...apps,uuid(99)]});
 assert.equal(result.scopes.length,2);assert.equal(result.rejected,2);assert.deepEqual(result.scopes.flatMap(s=>s.applicationIds),apps.slice(0,2));assert.equal(h.state().sessions.length,0);assert.equal(h.state().audit.length,0);assert.equal(h.state().notifications.length,0);
 h.as(voterId);await assert.rejects(api.resolveLiveVotingSelection({clubId,applicationIds:[apps[0]]}),/Denied/);
 h.as(uuid(5));h.members[0].status='INACTIVE';await assert.rejects(api.resolveLiveVotingSelection({clubId,applicationIds:[apps[0]]}),/Denied/);
});

test('landing metadata is role projected and never includes ballots or applicant identities',async()=>{
 const h=harness();await h.create();const rows=await h.api.listLiveVotingRooms({clubId});assert.equal(rows[0].view,'leader');
 h.as(voterId);const own=await h.api.listLiveVotingRooms({clubId});assert.equal(own[0].view,'member');
 assert.doesNotMatch(JSON.stringify(own),/ballots|leaderMemberIds|studentProfile|applicationIds|participants/);
 h.members[1].permissions=[];await assert.rejects(h.api.listLiveVotingRooms({clubId}),/Denied/);
});
