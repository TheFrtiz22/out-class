const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,uuid,clubId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r)),third=uuid(7);
const twoThirds={mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:2,denominator:3},belowThreshold:'HOLD',reviewed:true};
async function room(rules,extra={}){
 const h=harness();await h.create({participantIds:[leaderId,voterId,third],presentationOptions:{fields:['name'],highlights:{},...(rules?{rules}:{})},...extra});ok(await h.command('START'));return h;
}
async function votes(h,choices){for(const [who,choice] of choices){h.as(who);ok(await h.vote(choice));}h.as(leaderId);}
const decide=(h,choice,extra={})=>{const s=h.state().sessions[0];return h.command('DECIDE_AND_ADVANCE',{applicationId:s.activeApplicationId,passNumber:s.currentPass,choice,...extra});};

test('existing and unconfigured sessions keep leader-confirmed behaviour with no rule snapshots',async()=>{
 const h=await room(null);ok(await h.command('OPEN_VOTING'));await votes(h,[[leaderId,'ACCEPT'],[voterId,'REJECT'],[third,'REJECT']]);ok(await h.command('CLOSE_VOTING'));
 assert.equal(h.state().ballotRules.length,0);const view=await h.read();assert.equal(view.rule.mode,'LEADER_CONFIRMS');assert.equal(view.ruleResult,null);
 // The leader may still confirm against the leading choice with a reason, exactly as before.
 assert.equal((await decide(h,'ACCEPT')).code,'REASON_REQUIRED');ok(await decide(h,'ACCEPT',{reason:'Leader judgment'}));
});

test('threshold rule is snapshotted per ballot, decides on close, and the leader cannot silently override it',async()=>{
 const h=await room(twoThirds);ok(await h.command('OPEN_VOTING'));
 const snap=h.state().ballotRules[0];assert.equal(snap.version,1);assert.deepEqual(snap.electorate,[leaderId,voterId,third].sort());assert.deepEqual(snap.rules,twoThirds);
 await votes(h,[[leaderId,'ACCEPT'],[voterId,'ACCEPT'],[third,'HOLD']]);
 assert.equal((await h.read()).ruleResult,null,'no counts while voting is open');
 ok(await h.command('CLOSE_VOTING'));const view=await h.read();assert.equal(view.ruleResult.outcome,'ACCEPT');assert.match(view.ruleResult.summary,/2 Pass votes of 3 ballots cast; 2 needed/);
 const blocked=await decide(h,'HOLD',{reason:'Prefer to wait'});assert.equal(blocked.code,'RULE_DECIDED');
 ok(await decide(h,'ACCEPT'));assert.equal(h.state().sessions[0].passes[0].candidates[0].confirmedDecision,'PASS');
 const audit=h.state().audit.filter(a=>a.details?.rule);assert.ok(audit.some(a=>a.action==='voting.room.close_voting'&&a.details.rule.outcome==='ACCEPT'));
 // Below threshold → configured Hold; Hold passes get fresh snapshots and the earlier one is unchanged.
 ok(await h.command('OPEN_VOTING'));await votes(h,[[leaderId,'ACCEPT'],[voterId,'REJECT'],[third,'HOLD']]);ok(await h.command('CLOSE_VOTING'));
 assert.equal((await h.read()).ruleResult.outcome,'HOLD');ok(await decide(h,'HOLD'));
 ok(await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[2],passNumber:1,reason:'Clear fit',confirmed:true}));
 ok(await h.command('NEXT_PASS'));ok(await h.command('OPEN_VOTING'));
 const rows=h.state().ballotRules;assert.deepEqual(rows.map(r=>[r.passNumber,r.applicationId]),[[1,apps[0]],[1,apps[1]],[2,apps[1]]]);assert.deepEqual(rows[0],snap);
});

test('unmet participation or zero ballots never auto-rejects: Hold for another vote, or an explicit reasoned decision',async()=>{
 const h=await room({...twoThirds,belowThreshold:'REJECT',denominator:'ELIGIBLE_VOTERS'});
 ok(await h.command('OPEN_VOTING'));await votes(h,[[voterId,'REJECT']]);
 assert.equal((await h.command('CLOSE_VOTING',{confirmed:false})).code,'EARLY_CLOSE_CONFIRMATION','missing ballots still need the existing confirmation');
 ok(await h.command('CLOSE_VOTING'));let view=await h.read();assert.equal(view.ruleResult.outcome,null);assert.equal(view.ruleResult.noResult,'PARTICIPATION');assert.match(view.ruleResult.summary,/Nobody is rejected automatically/);
 assert.equal((await decide(h,'REJECT')).code,'REASON_REQUIRED');ok(await decide(h,'HOLD'));
 ok(await h.command('OPEN_VOTING'));ok(await h.command('CLOSE_VOTING'));view=await h.read();assert.equal(view.ruleResult.noResult,'NO_BALLOTS');
 ok(await decide(h,'ACCEPT',{reason:'Discussed in person; members agreed'}));assert.equal(h.state().audit.at(-1).details.overridden,true);
 // Eligible-voter denominator: missing ballots stay in the total (2 Pass of 3 eligible meets 2/3; 1 Pass of 3 does not).
 ok(await h.command('OPEN_VOTING'));await votes(h,[[leaderId,'ACCEPT'],[voterId,'HOLD']]);ok(await h.command('CLOSE_VOTING'));
 view=await h.read();assert.equal(view.ruleResult.base,3);assert.equal(view.ruleResult.outcome,'REJECT');assert.equal(view.ruleResult.missing,1);
});

test('a voter losing eligibility pauses automatic counting until an audited recount; their ballot no longer counts',async()=>{
 const h=await room(twoThirds);ok(await h.command('OPEN_VOTING'));await votes(h,[[leaderId,'ACCEPT'],[voterId,'REJECT'],[third,'REJECT']]);
 h.members[2].permissions=h.members[2].permissions.filter(p=>p!=='decisions.vote');
 h.as(third);assert.notEqual((await h.vote('ACCEPT').catch(e=>({ok:false,message:e.message}))).ok,true,'revoked access is immediate');h.as(leaderId);
 assert.equal((await h.command('CLOSE_VOTING')).code,'ELECTORATE_CHANGED');assert.equal(h.state().sessions[0].passes[0].candidates[0].ballotState,'OPEN');
 assert.equal((await h.command('CLOSE_VOTING',{resolveElectorate:true})).code,'ELECTORATE_CHANGED','a reason is required');
 ok(await h.command('CLOSE_VOTING',{resolveElectorate:true,reason:'Member left the board'}));
 const [v1,v2]=h.state().ballotRules;assert.equal(v2.version,2);assert.deepEqual(v2.rules,v1.rules);assert.equal(v2.electorate.length,2);assert.equal(v1.electorate.length,3,'original snapshot preserved');
 assert.ok(h.state().audit.some(a=>a.action==='voting.room.electorate_resolved'&&a.reason==='Member left the board'));
 const view=await h.read();assert.equal(view.ruleResult.cast,2);assert.equal(view.ruleResult.outcome,'HOLD','1 of 2 is below 2/3 after the recount');
});

test('concurrent closure applies once; session rules cannot change after start',async()=>{
 const h=await room(twoThirds);ok(await h.command('OPEN_VOTING'));await votes(h,[[leaderId,'ACCEPT'],[voterId,'ACCEPT']]);
 const s=h.state().sessions[0],body=extra=>h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(900+extra),revision:s.revision,action:'CLOSE_VOTING',confirmed:true});
 const results=await Promise.all([body(1),body(2)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).code,'STALE_STATE');
 const plans=load('actions/voting-session-setup.ts',h.mocks);
 await assert.rejects(plans.updateVotingSessionSetup({...h.scope,requestId:uuid(950),revision:h.state().sessions[0].revision,cycleId:s.cycleId,roundId:s.roundId,leaderMemberIds:[leaderId],participantIds:[leaderId,voterId,third],applicationIds:apps,targetSize:null,presentationOptions:{fields:['name'],highlights:{},rules:{mode:'LEADER_CONFIRMS'}}}),/locked|started/);
 assert.deepEqual(h.state().sessions[0].presentationOptions.rules,twoThirds);
});

test('an unreviewed automatic rule is refused at session creation',async()=>{
 const h=harness();await assert.rejects(h.create({presentationOptions:{fields:['name'],highlights:{},rules:{...twoThirds,reviewed:false}}}),/Review/);assert.equal(h.state().sessions.length,0);
});
