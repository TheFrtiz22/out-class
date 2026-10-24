// Executes original read loaders against the reserved local fixture, outside Next.
// Framework cookies/redirects and support-session resolution are adapted; Auth,
// session revocation SQL, account reads, permission gates and Prisma queries are real.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),ts=require('typescript');
const {performance}=require('node:perf_hooks');
const {PrismaClient}=require('@prisma/client');
const {Actor,readConfig}=require('../tests/helpers/onboarding-e2e.cjs');
const {distribution}=require('./navigation-audit.cjs');
const root=path.join(os.tmpdir(),'outclass-onboarding-e2e');
async function main(){
 const config=readConfig(path.join(root,'config.json'));
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'navigation-fixture.json')));
 Object.assign(process.env,{DATABASE_URL:config.status.DB_URL,POSTGRES_PRISMA_URL:config.status.DB_URL,NEXT_PUBLIC_SUPABASE_URL:config.status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.status.PUBLISHABLE_KEY,SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',RESEND_API_KEY:'',SMTP_HOST:'',COMMUNICATIONS_EMAIL_ENABLED:'false'});
 const actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const jar={getAll:()=>[...actor.cookies].map(([name,value])=>({name,value})),get:name=>actor.cookies.has(name)?{value:actor.cookies.get(name)}:undefined,has:name=>actor.cookies.has(name),set:(name,value)=>actor.cookies.set(name,value)};
 let queries=[],auth=[];
 const db=new PrismaClient({datasourceUrl:config.status.DB_URL,log:[{emit:'event',level:'query'}]});
 db.$on('query',e=>{const table=e.query.match(/(?:FROM|INTO|UPDATE|JOIN)\s+(?:"public"\.)?"?(\w+)"?/i)?.[1]||null;queries.push({operation:e.query.trim().split(/\s+/)[0],table,durationMs:e.duration});});
 const originalFetch=global.fetch;
 global.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input.url||String(input));assert.equal(u.origin,config.status.API_URL,'Loader audit must never contact an external service');const start=performance.now();const response=await originalFetch(input,init);if(u.pathname.startsWith('/auth/'))auth.push({path:u.pathname,durationMs:performance.now()-start,status:response.status});return response;};
 const cache={};
 const mocks={'@/utils/prisma':{prisma:db},'@/utils/platform-view-as':{platformViewSession:async()=>null},'next/headers':{cookies:async()=>jar},'next/cache':{revalidatePath(){},revalidateTag(){},unstable_cache:fn=>fn},'next/navigation':{redirect(){throw Error('Fixture authorization denied');}},'next/server':{after(){throw Error('Read unexpectedly scheduled a background write');}}};
 function load(file){
  file=path.resolve(file);if(file===path.resolve('utils/prisma.ts'))return mocks['@/utils/prisma'];if(cache[file])return cache[file].exports;
  const mod={exports:{}};cache[file]=mod;
  const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',compiled)(name=>{if(Object.hasOwn(mocks,name))return mocks[name];if(name==='server-only')return{};if(name.startsWith('@/')||name.startsWith('.')){let target=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);for(const suffix of ['','.ts','.tsx','/index.ts'])if(fs.existsSync(target+suffix)&&fs.statSync(target+suffix).isFile())return load(target+suffix);throw Error('Missing local dependency '+name);}return require(name);},mod,mod.exports);
  return mod.exports;
 }
 try{
  const clubId=fixture.clubIds[0],app=await db.application.findFirst({where:{clubId},select:{id:true}});
  const cases=[['overview','actions/club-overview.ts','getClubWorkspaceOverview',[clubId]],['members','actions/organization-members.ts','getOrganizationMemberManagement',[clubId]],['pipeline','actions/crm.ts','getClubPipeline',[clubId]],['tasks','actions/tasks.ts','getTaskWorkspace',[clubId]],['meetings','actions/meetings.ts','listMeetings',[clubId]],['announcements','actions/communications.ts','getClubAnnouncements',[clubId]],['voting','actions/voting.ts','getVotingWorkspace',[clubId]],['applicantDisplay','actions/applicant-intelligence.ts','getApplicantDisplay',[{clubId,applicationId:app.id}]],['assignedRooms','actions/interview-entry.ts','getAssignedInterviewRooms',[clubId]],['interviewWorkspace','actions/interview-kits.ts','getInterviewWorkspace',[clubId]],['interviewRounds','actions/interview-kits.ts','getInterviewRounds',[clubId]],['roomWorkspace','actions/interview-rooms.ts','getRoomWorkspace',[clubId]]];
  if(process.argv.includes('--pipeline-study')) cases.splice(0,cases.length,
    ['pipeline','actions/crm.ts','getClubPipeline',[clubId]],
    ['pipelineList','actions/crm.ts','getClubPipelineList',[clubId]],
    ['pipelineDetail','actions/crm.ts','getClubPipeline',[clubId,{applicationId:app.id}]]);
  const results=[];
  for(const [name,file,fn,args]of cases){
   try{
    const api=load(file),samples=[];assert.equal(typeof api[fn],'function');
    for(let i=0;i<22;i++){queries=[];auth=[];const start=performance.now();const value=await api[fn](...args);const elapsedMs=performance.now()-start;assert.ok(!queries.some(q=>['INSERT','DELETE','UPDATE'].includes(q.operation)),'Read must not mutate fixture');if(i>=2)samples.push({elapsedMs,auth:[...auth],queries:[...queries],jsonBytes:Buffer.byteLength(JSON.stringify(value))});}
    results.push({name,file,fn,samples,elapsedMs:distribution(samples.map(s=>s.elapsedMs)),queryCount:distribution(samples.map(s=>s.queries.length)),authVerificationCount:distribution(samples.map(s=>s.auth.filter(a=>a.path.endsWith('/user')).length)),jsonBytes:distribution(samples.map(s=>s.jsonBytes))});console.log(name+': '+JSON.stringify(results.at(-1).elapsedMs));
   }catch(e){results.push({name,file,fn,unavailable:e.name+': '+String(e.message).split('\n').filter(Boolean).at(-1)});console.log(name+': unavailable');}
  }
  const output=process.argv.includes('--pipeline-study')?path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||''):path.resolve('docs/performance/evidence/loader-samples.json');
  if(process.argv.includes('--pipeline-study')){assert.ok(output.startsWith(path.resolve('docs/performance/phase3')+path.sep));assert.ok(!fs.existsSync(output));assert.ok(results.every(r=>r.samples?.length===20),'Every planned loader sample is required');}
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),environment:'original TypeScript loaders, real local Auth/PostgreSQL; Next cookie context adapted; outside RSC cache dispatcher',limitations:['Not Next HTTP latency or production timing.','Provider durations measure headers, not body consumption.','Prisma event duration is engine-reported integer milliseconds, not application phase attribution.','No support-session/demo behavior profiled.'],results},null,2));
 }finally{global.fetch=originalFetch;await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error(e.name);process.exitCode=1;});
