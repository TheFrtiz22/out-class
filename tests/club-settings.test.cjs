const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {randomUUID}=require('node:crypto');
const clubId=randomUUID(), q1=randomUUID(),q2=randomUUID(),r1=randomUUID(),r2=randomUUID();
function load(file,mocks={}) {const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;}
function harness() {
 const state={allowed:true,disabled:false,member:{isOwner:true,status:'ACTIVE'},club:{applicationVersion:0,pipelineVersion:0},questions:[{id:q1,prompt:'Why?',type:'ESSAY',required:true,wordLimit:null,options:[],_count:{answers:1}},{id:q2,prompt:'Upload?',type:'FILE_UPLOAD',required:false,wordLimit:null,options:[],_count:{answers:0}}],rounds:[{id:r1,name:'Applied',type:'APPLICATION_REVIEW',configuration:{},archivedAt:null,_count:{applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0}},{id:r2,name:'Interview',type:'INTERVIEW',configuration:{futureOption:true},archivedAt:null,_count:{applications:1,interviewRooms:0,interviewRecords:1,votingSessions:0,scheduledBookings:0}}],historicalNames:[],activeApplicants:0,openRooms:0,voting:0,audits:[],invalidated:[]};
 const tx={evaluation:{findMany:async()=>state.historicalNames.map(round=>({round})),updateMany:async({where,data})=>{state.renamedReviews={where,data};}},$queryRaw:async()=>[],user:{findUnique:async()=>({disabledAt:state.disabled?new Date():null})},clubMember:{findUnique:async()=>state.member},club:{findUniqueOrThrow:async()=>state.club,update:async({data})=>{for(const[k,v]of Object.entries(data))state.club[k]=v?.increment?state.club[k]+v.increment:v;}},application:{count:async()=>state.activeApplicants},interviewRoom:{count:async()=>state.openRooms},votingSession:{count:async()=>state.voting},auditLog:{create:async({data})=>state.audits.push(data)}};
 for(const[model,key]of [['applicationQuestion','questions'],['pipelineRound','rounds']])tx[model]={findMany:async()=>state[key].filter(r=>!r.archivedAt),create:async({data})=>{if(state[key].some(r=>r.id===data.id))throw Error('Unique ID');state[key].push({...data,_count:{answers:0}});},update:async({where,data})=>Object.assign(state[key].find(r=>r.id===where.id),data),delete:async({where})=>{state[key]=state[key].filter(r=>r.id!==where.id);}};
 const prisma={$transaction:async fn=>{const before=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,before);throw e;}}};
 const api=load('actions/club-settings.ts',{'@/utils/prisma':{prisma},'@/utils/auth':{requireClubPermission:async()=>{if(!state.allowed)throw Error('Denied');return{user:{id:'actor'}};}},'next/cache':{revalidatePath:path=>state.invalidated.push(path),revalidateTag:()=>{}}});
 return{state,api};
}
const question=(id,prompt,type='ESSAY')=>({id,prompt,type,required:true,wordLimit:100,options:[]});
const round=(id,name,type)=>({id,name,type,configuration:{instructions:'Read the kit',duration:45}});
test('application builder persists ordering, required flags, real choices, availability and deadline; answers are archived rather than deleted',async()=>{
 const h=harness(),fresh=randomUUID();await h.api.saveApplicationSettings({clubId,version:0,open:false,deadline:'2026-11-01T12:00:00.000Z',questions:[{...question(fresh,'Choose a team','MULTIPLE_CHOICE'),options:['Finance','Research'],required:false}]});
 assert.ok(h.state.questions.find(q=>q.id===q1).archivedAt);assert.equal(h.state.questions.find(q=>q.id===q2),undefined);assert.equal(h.state.questions.find(q=>q.id===fresh).order,0);assert.equal(h.state.club.applicationOpen,false);assert.equal(h.state.club.applicationVersion,1);assert.equal(h.state.audits.length,1);assert.ok(h.state.invalidated.includes(`/club/${clubId}`));
});
test('stale edits, ungranted capability, suspension, type changes with answers and invalid choices cannot commit',async()=>{
 for(const mutate of [h=>h.state.allowed=false,h=>h.state.member={status:'ACTIVE',permissions:[]},h=>h.state.disabled=true,h=>h.state.club.applicationVersion=1]){const h=harness();mutate(h);await assert.rejects(h.api.saveApplicationSettings({clubId,version:0,open:true,deadline:null,questions:[question(q1,'Why?')]}));assert.equal(h.state.audits.length,0);assert.equal(h.state.questions.length,2);}
 const h=harness();await assert.rejects(h.api.saveApplicationSettings({clubId,version:0,open:true,deadline:null,questions:[question(q1,'PDF','FILE_UPLOAD')]}),/cannot change type/);assert.equal(h.state.questions.length,2);
 await assert.rejects(h.api.saveApplicationSettings({clubId,version:0,open:true,deadline:null,questions:[{...question(q1,'Choose','MULTIPLE_CHOICE'),options:['A','A']}]}),/distinct options/);
});
test('pipeline save renames/reorders real rounds, retains extension config, and archives historical rounds',async()=>{
 const h=harness();await h.api.savePipelineSettings({clubId,version:0,rounds:[round(r1,'Application Review','APPLICATION_REVIEW'),round(r2,'Panel','INTERVIEW')]});assert.equal(h.state.rounds[1].configuration.futureOption,true);assert.equal(h.state.rounds[1].name,'Panel');assert.equal(h.state.renamedReviews.where.round,'Interview');assert.equal(h.state.renamedReviews.data.round,'Panel');assert.equal(h.state.club.pipelineVersion,1);
 await h.api.savePipelineSettings({clubId,version:1,rounds:[round(r1,'Application Review','APPLICATION_REVIEW')]});assert.ok(h.state.rounds[1].archivedAt);assert.equal(h.state.rounds[1]._count.interviewRecords,1);
});
test('round removal rejects active applicants, open rooms and live voting; history-protected type and stale pipeline edits cannot commit',async()=>{
 for(const key of ['activeApplicants','openRooms','voting']){const h=harness();h.state[key]=1;await assert.rejects(h.api.savePipelineSettings({clubId,version:0,rounds:[round(r1,'Application Review','APPLICATION_REVIEW')]}));assert.equal(h.state.club.pipelineVersion,0);assert.equal(h.state.rounds[1].archivedAt,null);}
 const h=harness();await assert.rejects(h.api.savePipelineSettings({clubId,version:0,rounds:[round(r1,'Review','APPLICATION_REVIEW'),round(r2,'Vote','VOTE')]}),/protected/);assert.equal(h.state.rounds[0].name,'Applied');
 await assert.rejects(h.api.savePipelineSettings({clubId,version:9,rounds:[round(r1,'Review','APPLICATION_REVIEW')]}),/changed/);
});
test('choice responses are validated on the student submission boundary and legacy prompt-only choices stay usable',()=>{
 const {answerErrors}=load('lib/student-applications.ts');const q={...question(q1,'Pick','MULTIPLE_CHOICE'),options:['A','B']};assert.equal(answerErrors([q],[{questionId:q1,response:'forged'}],true)[q1],'Choose one of the available options.');assert.deepEqual(answerErrors([q],[{questionId:q1,response:'B'}],true),{});assert.deepEqual(answerErrors([{...q,options:[]}],[{questionId:q1,response:'legacy prompt selection'}],true),{});
});
test('open/close and deadlines use server time and settings sections reflect individual capabilities',()=>{
 const {applicationAvailability,availableSettings}=load('lib/club-settings.ts');const now=new Date('2026-10-05T12:00:00Z');assert.equal(applicationAvailability({applicationOpen:false},now),false);assert.equal(applicationAvailability({applicationOpen:true,applicationDeadline:now},now),false);assert.equal(applicationAvailability({applicationDeadline:'2026-11-01T12:00:00Z'},now),true);assert.deepEqual(availableSettings({permissions:['application.manage']}).map(s=>s.id),['application']);assert.deepEqual(availableSettings({permissions:['interviews.manage']}).map(s=>s.id),['interviews']);
});

test('round names from archived or renamed evaluation history cannot be reassigned to another round',async()=>{
 const h=harness();h.state.historicalNames=['Old Interview'];await assert.rejects(h.api.savePipelineSettings({clubId,version:0,rounds:[round(r1,'Review','APPLICATION_REVIEW'),round(r2,'Old Interview','INTERVIEW')]}),/existing review history/);assert.equal(h.state.club.pipelineVersion,0);assert.equal(h.state.rounds[0].name,'Applied');
});

test('legacy prompt-only multiple choice can retain its immutable answers while new questions require defined choices',async()=>{
 const h=harness();h.state.questions[0].type='MULTIPLE_CHOICE';await h.api.saveApplicationSettings({clubId,version:0,open:false,deadline:null,questions:[question(q1,'Select from the choices in the prompt','MULTIPLE_CHOICE')]});assert.equal(h.state.club.applicationOpen,false);assert.deepEqual(h.state.questions[0].options,[]);assert.equal(h.state.questions[0]._count.answers,1);
 const fresh=harness();await assert.rejects(fresh.api.saveApplicationSettings({clubId,version:0,open:true,deadline:null,questions:[question(randomUUID(),'Choose','MULTIPLE_CHOICE')]}),/at least two/);assert.equal(fresh.state.club.applicationVersion,0);
});

test('removing a progressed round with manual evaluation history archives the stage instead of deleting it',async()=>{
 const h=harness();h.state.rounds[1]._count={applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0};h.state.historicalNames=['Interview'];await h.api.savePipelineSettings({clubId,version:0,rounds:[round(r1,'Applied','APPLICATION_REVIEW')]});assert.equal(h.state.rounds.length,2);assert.ok(h.state.rounds[1].archivedAt);
});
