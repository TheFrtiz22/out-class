const {test}=require('node:test'),assert=require('node:assert/strict');
const room=require('./helpers/voting-room-harness.cjs');
const legacy=require('./helpers/voting-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));

/** Walk a payload and collect every place a member identifier sits next to a ballot choice. */
function choiceLeaks(payload,selfId){
 const found=[];
 (function walk(v,path){
  if(Array.isArray(v))return v.forEach((x,i)=>walk(x,`${path}[${i}]`));
  if(!v||typeof v!=='object')return;
  if(('decision'in v||'choice'in v)&&'memberId'in v&&v.memberId!==selfId)found.push(path);
  for(const [k,x] of Object.entries(v))walk(x,`${path}.${k}`);
 })(payload,'$');
 return found;
}

test('live rooms: own ballot only, counts while open, totals after closing — for leader, voter, non-participant, outsider and revoked member',async()=>{
 const h=room.harness();await h.create();ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));
 ok(await h.vote('ACCEPT'));h.as(room.voterId);ok(await h.vote('REJECT'));h.as(room.leaderId);
 for(const [who,id,choice] of [['leader',room.leaderId,'ACCEPT'],['voter',room.voterId,'REJECT']]){
  h.as(id);const view=await h.read(),entry=view.history[0].candidates[0];
  assert.deepEqual(choiceLeaks(view,id),[],`${who} receives no other member's choice`);
  assert.equal(JSON.stringify(view).includes('"ballots"'),false,`${who} receives no ballot list`);
  assert.equal(entry.ownBallot.choice,choice,`${who} sees their own ballot`);
  assert.equal('totals'in entry,false,`${who} sees no totals while open`);assert.equal(view.ballotsReceived,2);assert.equal(view.ruleResult,null);
 }
 // A club member who is not a participant, leader or observer; an outsider; a revoked voter.
 h.as(room.uuid(7));await assert.rejects(h.read(),/denied/i);
 h.as(room.uuid(99));await assert.rejects(h.read(),/Denied/);
 h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='decisions.vote');h.as(room.voterId);await assert.rejects(h.read(),/denied/i);
 h.as(room.leaderId);ok(await h.command('CLOSE_VOTING'));
 const closed=(await h.read()).history[0].candidates[0];assert.deepEqual(closed.totals,{ACCEPT:1,HOLD:0,REJECT:1});assert.deepEqual(choiceLeaks(closed,room.leaderId),[]);
 // Leader override stays attributed and audited; ballot audits never carry a choice.
 ok(await h.command('CONFIRM',{choice:'ACCEPT',reason:'Leader judgment'}));
 const confirm=h.state().audit.find(a=>a.action==='voting.room.confirm');assert.equal(confirm.actorId,room.leaderId);assert.equal(confirm.details.overridden,true);assert.equal(confirm.reason,'Leader judgment');
 for(const a of h.state().audit.filter(a=>/ballot/.test(a.action)))assert.deepEqual(Object.keys(a.details).sort(),['applicationId','passNumber']);
 for(const r of h.state().receipts.filter(r=>r.result&&'ballotRevision'in r.result))assert.deepEqual(Object.keys(r.result).sort(),['accepted','ballotRevision']);
 // The leader summary used for finalization exposes no individual choices either.
 const summary=await room.load('actions/voting-room-finalization.ts',h.mocks).getLiveVotingSummary(h.scope).catch(e=>({error:e.message}));
 assert.deepEqual(choiceLeaks(summary,room.leaderId),[]);
});

test('legacy board sessions: each viewer receives only their own ballot and a count; open-pass outcomes stay hidden; new audits omit the choice',async()=>{
 const h=legacy.harness();await h.create([legacy.memberId,legacy.otherId]);
 await h.command('START_PASS',{applicationIds:[legacy.ids[0]]});
 await h.vote(legacy.ids[0],'PASS');h.as(legacy.otherId);await h.vote(legacy.ids[0],'NOT_PASS');
 for(const [who,id,choice] of [['leader',legacy.memberId,'PASS'],['voter',legacy.otherId,'NOT_PASS']]){
  h.as(id);const view=await h.read(),entry=view.session.passes[0].candidates[0];
  assert.deepEqual(choiceLeaks(view,id),[],`${who} receives no other member's choice`);
  assert.equal(entry.ballots.length,1);assert.equal(entry.ballots[0].memberId,id);assert.equal(entry.ballots[0].decision,choice);assert.equal(entry.ballotCount,2);
  assert.equal(view.summary.outcomes[0].outcome,'UNRESOLVED','no aggregate outcome while the pass is open');
 }
 const stored=h.state().sessions[0].passes[0].candidates[0].ballots;assert.equal(stored.length,2,'server keeps one ballot per voter');
 for(const a of h.state().audit.filter(a=>a.action==='voting.ballot.submitted'))assert.equal('decision'in a.details,false);
 // Outsider is denied at the backend.
 h.as(legacy.uuid(99));await assert.rejects(h.read());
});

test('platform audit views hide choices from historical legacy ballot rows without changing them',()=>{
 const {redactBallotAudit}=room.load('lib/ballot-audit-privacy.ts');
 const old={action:'voting.ballot.submitted',details:{applicationId:'a',pass:1,decision:'PASS'}};
 assert.deepEqual(redactBallotAudit(old).details,{applicationId:'a',pass:1});assert.equal(old.details.decision,'PASS','source row unchanged');
 const override={action:'voting.override',details:{decision:'HOLD'}};assert.equal(redactBallotAudit(override),override,'leader overrides stay attributed with their decision');
});
