const {unwrapActions}=require('./helpers/action-result.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {randomUUID}=require('node:crypto');
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;}
const clubA=randomUUID(),clubB=randomUUID(),appliedA=randomUUID(),roundA=randomUUID(),roundB=randomUUID(),cycleA=randomUUID(),cycleB=randomUUID();
const bands={green:{start:1,end:20},yellow:{start:21,end:40},red:{start:41}};
const leader={status:'ACTIVE',permissions:['recruitment.manage','applicants.identify','applications.review']};
const reviewer={status:'ACTIVE',permissions:['applications.review','applicants.identify']};
function harness(memberA=leader,memberB=null){
 const state={actor:'actor',members:{[clubA]:memberA,[clubB]:memberB},club:{[clubA]:{pipelineVersion:0},[clubB]:{pipelineVersion:0}},
  rounds:[{id:appliedA,clubId:clubA,name:'Applied',type:'APPLICATION_REVIEW',order:0,archivedAt:null,configuration:{},_count:{applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0}},
   {id:roundA,clubId:clubA,name:'Interview',type:'INTERVIEW',order:1,archivedAt:null,configuration:{instructions:'Kit',duration:30,futureOption:true},_count:{applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0}},
   {id:roundB,clubId:clubB,name:'Interview',type:'INTERVIEW',order:1,archivedAt:null,configuration:{instructions:'B'},_count:{applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0}}],
  cycles:[{id:cycleA,clubId:clubA,name:'Fall',createdAt:new Date(2)},{id:cycleB,clubId:clubB,name:'Other club',createdAt:new Date(1)}],audits:[],locks:[]};
 const match=(row,where={})=>Object.entries(where).every(([k,v])=>k==='archivedAt'&&v===null?row.archivedAt==null:row[k]===v);
 const tx={
  $queryRaw:async(strings,...values)=>{state.locks.push(strings.join('?').trim());return [];},
  user:{findUnique:async()=>({disabledAt:null})},
  clubMember:{findUnique:async({where})=>state.members[where.userId_clubId.clubId]??null},
  club:{findUniqueOrThrow:async({where})=>state.club[where.id],update:async({where,data})=>{for(const[k,v]of Object.entries(data))state.club[where.id][k]=v?.increment?state.club[where.id][k]+v.increment:v;}},
  pipelineRound:{findFirst:async({where})=>{const r=state.rounds.find(r=>match(r,where));return r?structuredClone({id:r.id,configuration:r.configuration,anonymousReview:!!r.anonymousReview}):null;},
   findMany:async({where})=>state.rounds.filter(r=>r.clubId===where.clubId).map(r=>structuredClone(r)),
   update:async({where,data})=>Object.assign(state.rounds.find(r=>r.id===where.id),structuredClone(data)),create:async()=>{throw Error('unexpected create');},delete:async()=>{throw Error('unexpected delete');}},
  recruitmentCycle:{findFirst:async({where})=>state.cycles.find(c=>c.id===where.id&&c.clubId===where.clubId)??null,findMany:async({where})=>state.cycles.filter(c=>c.clubId===where.clubId).map(({id,name})=>({id,name}))},
  evaluation:{findMany:async()=>[]},application:{count:async()=>0},interviewRoom:{count:async()=>0},votingSession:{count:async()=>0},
  auditLog:{create:async({data})=>state.audits.push(data)},
 };
 const {hasPermission}=load('lib/permissions.ts');
 const prisma={$transaction:async fn=>{const before=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,before);throw e;}}};
 const auth={requireClubPermission:async(clubId,permissions)=>{const m=state.members[clubId];if(!m||!permissions.every(p=>hasPermission(m,p)))throw Error('You do not have permission for this club action.');return{user:{id:state.actor},membership:m};}};
 const mocks={'@/utils/prisma':{prisma},'@/utils/auth':auth,'next/cache':{revalidatePath:()=>{},revalidateTag:()=>{}}};
 return {state,api:load('actions/ranked-review.ts',mocks),settings:unwrapActions(load('actions/club-settings.ts',mocks))};
}
const save=(over={})=>({clubId:clubA,roundId:roundA,cycleKey:cycleA,expectedRevision:0,bands,...over});

test('a leader with recruitment.manage saves bands for club + cycle + round, keeping every other configuration key',async()=>{
 const h=harness();const result=await h.api.saveRankedReviewBands(save());
 assert.equal(result.revision,1);const config=h.state.rounds.find(r=>r.id===roundA).configuration;
 assert.equal(config.instructions,'Kit');assert.equal(config.duration,30);assert.equal(config.futureOption,true);
 assert.deepEqual(config.rankedReviewBands.scopes[cycleA].bands,bands);
 assert.ok(h.state.locks.some(l=>/FROM "Club" WHERE id=\? FOR UPDATE/.test(l)),'serializes on the club row like savePipelineSettings');
 assert.equal(h.state.audits.at(-1).action,'round.ranked-review-bands.configure');
 await h.api.saveRankedReviewBands(save({cycleKey:'no-cycle',bands:{green:{start:1,end:5},yellow:{start:6,end:9},red:{start:10}}}));
 const read=await h.api.getRankedReviewSettings(clubA,roundA);
 assert.deepEqual(read.scopes[cycleA],{bands,revision:1});assert.equal(read.scopes['no-cycle'].bands.green.end,5);assert.equal(read.canManage,true);assert.deepEqual(read.cycles,[{id:cycleA,name:'Fall'}]);
});

test('stale revisions are rejected without writing',async()=>{
 const h=harness();await h.api.saveRankedReviewBands(save());
 await assert.rejects(h.api.saveRankedReviewBands(save({bands:{green:{start:1,end:10},yellow:{start:11,end:20},red:{start:21}}})),/changed/);
 assert.equal(h.state.rounds.find(r=>r.id===roundA).configuration.rankedReviewBands.scopes[cycleA].bands.green.end,20);
 await h.api.saveRankedReviewBands(save({expectedRevision:1,bands:null}));
 assert.deepEqual((await h.api.getRankedReviewSettings(clubA,roundA)).scopes[cycleA],{bands:null,revision:2});
});

test('a reviewer without recruitment.manage can read but not save; invalid bands never reach the database',async()=>{
 const h=harness(reviewer);
 await assert.rejects(h.api.saveRankedReviewBands(save()),/permission/);
 assert.equal(h.state.rounds.find(r=>r.id===roundA).configuration.rankedReviewBands,undefined);assert.equal(h.state.audits.length,0);
 const read=await h.api.getRankedReviewSettings(clubA,roundA);assert.equal(read.canManage,false);assert.deepEqual(read.scopes,{});
 const l=harness();
 for(const bad of [{green:{start:1,end:20},yellow:{start:22,end:40},red:{start:41}},{green:{start:1,end:20},yellow:{start:21,end:40},red:{start:40}}])
  await assert.rejects(l.api.saveRankedReviewBands(save({bands:bad})));
 assert.equal(l.state.audits.length,0);
 const none=harness({status:'ACTIVE',permissions:['events.manage']});await assert.rejects(none.api.getRankedReviewSettings(clubA,roundA),/Applicant access denied/);
});

test('cross-club rounds, cycles and clubs are denied',async()=>{
 const h=harness();
 await assert.rejects(h.api.saveRankedReviewBands(save({roundId:roundB})),/Round unavailable/);
 await assert.rejects(h.api.saveRankedReviewBands(save({cycleKey:cycleB})),/Cycle unavailable/);
 await assert.rejects(h.api.saveRankedReviewBands(save({clubId:clubB,roundId:roundB})),/permission/);
 await assert.rejects(h.api.getRankedReviewSettings(clubB,roundB),/permission/);
 await assert.rejects(h.api.getRankedReviewSettings(clubA,roundB),/Round unavailable/);
 assert.deepEqual(h.state.rounds.find(r=>r.id===roundB).configuration,{instructions:'B'});assert.equal(h.state.audits.length,0);
});

test('the existing pipeline settings writer preserves saved discussion bands',async()=>{
 const h=harness();await h.api.saveRankedReviewBands(save());
 await h.settings.savePipelineSettings({clubId:clubA,version:0,rounds:[{id:appliedA,name:'Applied',type:'APPLICATION_REVIEW',configuration:{instructions:'',duration:30}},{id:roundA,name:'Panel',type:'INTERVIEW',configuration:{instructions:'New kit',duration:45}}]});
 const config=h.state.rounds.find(r=>r.id===roundA).configuration;
 assert.equal(config.instructions,'New kit');assert.equal(config.futureOption,true);assert.deepEqual(config.rankedReviewBands.scopes[cycleA].bands,bands);
 assert.equal(h.state.club[clubA].pipelineVersion,1,'band saves do not consume the pipeline settings version');
});
test('reading bands follows the pipeline rule: without applicants.identify only anonymous rounds, never cycle names; no editor id is stored',async()=>{
 const h=harness();await h.api.saveRankedReviewBands(save());
 assert.equal(JSON.stringify(h.state.rounds.find(r=>r.id===roundA).configuration).includes('actor'),false,'the audit log, not round configuration, records the editor');
 const blind=harness({status:'ACTIVE',permissions:['applications.review']});
 await assert.rejects(blind.api.getRankedReviewSettings(clubA,roundA),/denied/);
 blind.state.rounds.find(r=>r.id===roundA).anonymousReview=true;const anon=await blind.api.getRankedReviewSettings(clubA,roundA);
 assert.deepEqual(anon.cycles,[]);assert.equal(anon.canManage,false);
});
