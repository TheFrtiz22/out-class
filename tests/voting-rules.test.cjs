const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const r=load('lib/voting-rules.ts');
const rule=(extra={})=>r.votingRulesSchema.parse({mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true,...extra});
const voters=n=>Array.from({length:n},(_,i)=>`m${i}`);
const ballots=(pass,hold=0,reject=0)=>[...Array(pass).fill('PASS'),...Array(hold).fill('HOLD'),...Array(reject).fill('NOT_PASS')].map((decision,i)=>({memberId:`m${i}`,decision}));

test('2/3 of ten counted ballots requires seven Pass votes; exact fractions at every boundary',()=>{
 const two3=rule();
 assert.equal(r.evaluateThreshold(two3,voters(10),ballots(7,3)).outcome,'ACCEPT');
 const six=r.evaluateThreshold(two3,voters(10),ballots(6,2,2));assert.equal(six.outcome,'HOLD');assert.equal(six.requiredPass,7);
 // 6 of 9 is exactly 2/3 and meets "at least".
 assert.equal(r.evaluateThreshold(two3,voters(9),ballots(6,3)).outcome,'ACCEPT');assert.equal(r.evaluateThreshold(two3,voters(9),ballots(5,4)).outcome,'HOLD');
 // 3/4: 3 of 4 passes, 5 of 7 fails (needs 6), floating point never involved.
 const three4=rule({threshold:{numerator:3,denominator:4}});
 assert.equal(r.evaluateThreshold(three4,voters(4),ballots(3,1)).outcome,'ACCEPT');assert.equal(r.evaluateThreshold(three4,voters(7),ballots(5,2)).requiredPass,6);
 // 1/2 ties meet the threshold ("at least half").
 assert.equal(r.evaluateThreshold(rule({threshold:{numerator:1,denominator:2}}),voters(4),ballots(2,0,2)).outcome,'ACCEPT');
 assert.throws(()=>rule({threshold:{numerator:4,denominator:3}}));assert.throws(()=>rule({reviewed:false}),/Review/);
});

test('denominators: Hold and Do not pass count in ballots cast; missing ballots count only in the eligible-voter total and are never fabricated rejections',()=>{
 const cast=rule(),eligible=rule({denominator:'ELIGIBLE_VOTERS'});
 // 10 eligible, 8 vote: 6 Pass, 1 Hold, 1 Do not pass.
 const a=r.evaluateThreshold(cast,voters(10),ballots(6,1,1));assert.equal(a.base,8);assert.equal(a.requiredPass,6);assert.equal(a.outcome,'ACCEPT');assert.equal(a.missing,2);assert.equal(a.rejectVotes,1,'missing ballots are not Do not pass votes');
 const b=r.evaluateThreshold(eligible,voters(10),ballots(6,1,1));assert.equal(b.base,10);assert.equal(b.requiredPass,7);assert.equal(b.outcome,'HOLD');
 assert.equal(r.evaluateThreshold(rule({belowThreshold:'REJECT'}),voters(10),ballots(1,9)).outcome,'REJECT');
 assert.match(r.describeVotingRules(eligible),/missing ballots still count/);assert.match(r.describeVotingRules(cast),/missing ballots do not/);
});

test('unmet participation, zero ballots and no electorate produce no automatic outcome, never a rejection',()=>{
 const strict=rule({belowThreshold:'REJECT',minimumParticipation:{numerator:3,denominator:4}});
 const low=r.evaluateThreshold(strict,voters(8),ballots(0,0,5));assert.equal(low.outcome,null);assert.equal(low.noResult,'PARTICIPATION');assert.equal(low.requiredParticipation,6);
 assert.equal(r.evaluateThreshold(strict,voters(8),ballots(0,0,6)).outcome,'REJECT');
 assert.deepEqual([r.evaluateThreshold(strict,voters(8),[]).noResult,r.evaluateThreshold(strict,[],[]).noResult],['NO_BALLOTS','NO_ELIGIBLE_VOTERS']);
 // Ballots from outside the snapshotted electorate (e.g. a revoked voter after recount) are ignored.
 const res=r.evaluateThreshold(rule(),['m0','m1','m2'],[...ballots(3),{memberId:'gone',decision:'NOT_PASS'}]);assert.equal(res.cast,3);assert.equal(res.outcome,'ACCEPT');
});

test('missing or legacy configuration is leader-confirmed; previews use the same arithmetic',()=>{
 for(const v of [undefined,null,{},{mode:'AUTO'},{mode:'THRESHOLD'}])assert.deepEqual(r.readVotingRules(v),{mode:'LEADER_CONFIRMS'});
 const examples=r.votingRuleExamples(rule(),10);assert.ok(examples.some(e=>/If 10 voters of 10 vote: 7 Pass votes needed/.test(e)),examples.join('\n'));
 assert.ok(examples.some(e=>/no automatic result \(at least 5 must vote\)/.test(e)),examples.join('\n'));
 assert.match(r.ruleResultSummary(r.evaluateThreshold(rule(),voters(10),ballots(7,3)),rule()),/7 Pass votes of 10 ballots cast; 7 needed \(2\/3\)/);
});
