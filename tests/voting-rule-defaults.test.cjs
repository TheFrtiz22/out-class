const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),roundId=uuid(2),userId=uuid(3);
const rule={mode:'THRESHOLD',threshold:{numerator:3,denominator:4},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true};
function harness(allowed=true){
 const rows=[],audit=[];
 const tx={pipelineRound:{findFirst:async({where})=>where.id===roundId&&where.clubId===clubId?{id:roundId}:null},
  votingRuleDefault:{findMany:async({where})=>rows.filter(r=>r.clubId===where.clubId&&where.OR.some(o=>o.roundId===r.roundId)),findFirst:async({where})=>rows.find(r=>r.clubId===where.clubId&&r.roundId===where.roundId)??null,
   create:async({data})=>{const r={id:uuid(50+rows.length),revision:1,updatedAt:new Date(),...data};rows.push(r);return r},update:async({where,data})=>Object.assign(rows.find(r=>r.id===where.id),data)},
  auditLog:{create:async({data})=>audit.push(data)}};
 const deny=async()=>{if(!allowed)throw Error('Denied');return{user:{id:userId}}};
 const api=load('actions/voting-rules.ts',{'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'@/utils/auth':{requireClubPermission:deny},'@/lib/club-transaction-authorization':{authorizeClubTransaction:async()=>{if(!allowed)throw Error('Denied')}},
  '@/utils/club-write-transaction':{clubWriteTransaction:fn=>fn(tx),votingWriteLimits:{}},'@/lib/voting-transaction-limits':{votingReadLimits:{}}});
 return {api,rows,audit};
}
test('club default and round override are revisioned, retry-safe, conflict-aware and require a reviewed automatic rule',async()=>{
 const h=harness();let view=await h.api.getVotingRuleDefaults({clubId,roundId});
 assert.deepEqual(view.club,{rules:{mode:'LEADER_CONFIRMS'},revision:0,updatedAt:null},'no default means leader-confirmed');
 assert.equal((await h.api.saveVotingRuleDefault({clubId,roundId:null,revision:0,rules:{...rule,reviewed:false}})).ok,false);
 assert.deepEqual(await h.api.saveVotingRuleDefault({clubId,roundId:null,revision:0,rules:rule}),{ok:true,revision:1});
 assert.deepEqual(await h.api.saveVotingRuleDefault({clubId,roundId:null,revision:0,rules:rule}),{ok:true,revision:1},'lost-response retry');
 const stale=await h.api.saveVotingRuleDefault({clubId,roundId:null,revision:0,rules:{mode:'LEADER_CONFIRMS'}});assert.equal(stale.ok,false);assert.match(stale.message,/Another leader/);
 assert.deepEqual(await h.api.saveVotingRuleDefault({clubId,roundId,revision:0,rules:{mode:'LEADER_CONFIRMS'}}),{ok:true,revision:1});
 view=await h.api.getVotingRuleDefaults({clubId,roundId});assert.deepEqual(view.club.rules,rule);assert.deepEqual(view.round.rules,{mode:'LEADER_CONFIRMS'});
 assert.equal(h.audit.length,2);await assert.rejects(h.api.getVotingRuleDefaults({clubId,roundId:uuid(9)}),/Round unavailable/);
 await assert.rejects(harness(false).api.saveVotingRuleDefault({clubId,roundId:null,revision:0,rules:rule}),/Denied/);
});
