const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const {loader}=require('./helpers/communications-loader.cjs');
const url=process.env.OUTCLASS_AUDIENCE_TEST_DATABASE_URL;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('real PostgreSQL voting polling versus scheduler progress',{skip:!url,timeout:90000},async t=>{
 const target=new URL(url);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'58453');assert.equal(target.pathname,'/outclass_audiences_test');
 const {PrismaClient}=require('@prisma/client');
 const op=new PrismaClient({datasourceUrl:url}),db=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@')}),poll=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@').replace('connection_limit=8','connection_limit=4')});
 t.after(async()=>Promise.all([op.$disconnect(),db.$disconnect(),poll.$disconnect()]));
 const user=await db.user.create({data:{email:randomUUID()+'@virginia.edu'}});
 const clubs=[];
 for(let i=0;i<2;i++){const club=await db.club.create({data:{slug:randomUUID(),name:'Polling fixture '+i,tagline:'',description:'',category:'Other',color:'#142d45'}});const member=await db.clubMember.create({data:{clubId:club.id,userId:user.id,isOwner:true}});const round=await db.pipelineRound.create({data:{clubId:club.id,name:'Review',order:0,type:'CUSTOM'}});await db.votingSession.create({data:{clubId:club.id,roundId:round.id,createdBy:user.id,targetSize:1}});clubs.push({club,member,round});}
 // Exercise the current getSession -> getUser(token) -> auth.sessions chain.
 const fixtureSessionId=randomUUID();
 const fixtureToken=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:user.id,session_id:fixtureSessionId})).toString('base64url'),'fixture'].join('.');
 await op.$executeRaw`INSERT INTO auth.sessions (id,user_id,not_after) VALUES (${fixtureSessionId}::uuid,${user.id}::uuid,clock_timestamp()+interval '1 day')`;
 let impersonating=false,supportActive=true;
 const mocks=client=>({'@/utils/prisma':{prisma:client},'next/headers':{cookies:async()=>({has:()=>impersonating,get:()=>undefined})},'next/navigation':{redirect:()=>{throw Error('Denied')}},'@/utils/supabase/server':{createClient:async()=>({auth:{getSession:async()=>({data:{session:{access_token:fixtureToken}},error:null}),getUser:async token=>{assert.equal(token,fixtureToken);return{data:{user:{id:user.id,email:user.email,email_confirmed_at:'2026-01-01'}},error:null}}}})},'@/utils/platform-view-as':{platformViewSession:async()=>supportActive?{targetUserId:user.id}:null},'@/utils/support-audit':{supportContext:async()=>null,supportTransactionScope:new AsyncLocalStorage()},'next/cache':{revalidatePath(){}}});
 const originalMocks=mocks;const resolvedMocks=client=>{const m=originalMocks(client);m['./prisma']=m['@/utils/prisma'];m['./supabase/server']=m['@/utils/supabase/server'];return m;};
 const actions=loader(resolvedMocks(db))('actions/communication-schedules.ts'),worker=loader(resolvedMocks(db))('utils/scheduled-communications.ts');
 const future=()=>new Date(Date.now()+3600000).toISOString().slice(0,16);
 async function schedule(club){const id=randomUUID();await actions.saveCommunicationSchedule({id,clubId:club.id,revision:null,title:'Polling progress',body:'Synthetic only',audience:{include:[{source:'MEMBERS'}]},recipientMode:'SEND_TIME',localTime:future(),timeZone:'UTC',occurrence:'EARLIER'});await op.scheduledCommunication.update({where:{id},data:{scheduledAt:new Date(Date.now()-1000)}});return id;}
 const pids=new Set(),timings=[],errors=[];let mutations=0,delay=70,afterSnapshot=null;
 const wrapped=new Proxy(poll,{get(target,key){if(key==='$transaction')return (fn,options)=>{const begin=Date.now();return poll.$transaction(async tx=>{let pid;const started=Date.now();
  async function invoke(object,name,args){if(name==='$executeRaw'&&String(args[0]).includes('READ ONLY'))return object[name](...args);if(!pid){pid=(await tx.$queryRaw`SELECT pg_backend_pid() pid`)[0].pid;pids.add(pid);}const at=Date.now();const result=await object[name](...args);timings.push({category:name==='$queryRaw'&&String(args[0]).includes('FOR SHARE')?'shared_lock':'query',databaseMs:Date.now()-at,acquireMs:started-begin});if(delay)await sleep(delay);return result;}
  const proxy=new Proxy(tx,{get(object,name){if(typeof name==='string'&&name.startsWith('$'))return(...args)=>invoke(object,name,args);const model=object[name];if(!model||typeof model!=='object')return model;return new Proxy(model,{get(m,operation){return async(...args)=>{if(/^(create|update|delete|upsert)/.test(operation))mutations++;return invoke(m,operation,args);};}});}});
  try{const value=await fn(proxy);if(afterSnapshot)await afterSnapshot();return value;}finally{if(pid)pids.delete(pid);timings.push({category:'transaction',elapsedMs:Date.now()-started,acquireMs:started-begin});}
 },options).catch(e=>{errors.push({code:/^P\d{4}$/.test(e.code||'')?e.code:'OTHER'});throw e;});};return typeof target[key]==='function'?target[key].bind(target):target[key];}});
 async function run(source,expectProgress){
  timings.length=0;errors.length=0;
  const voting=loader(resolvedMocks(wrapped))(source),ids=[await schedule(clubs[0].club),await schedule(clubs[0].club),await schedule(clubs[1].club)];
  let running=true,reads=0,occupancy=0,samples=0,maxAgeMs=0,maxBlockers=0;const results=[];
  const loop=async()=>{while(running){await voting.getVotingWorkspace(clubs[0].club.id);reads++;}};
  const first=loop();while(!pids.size)await sleep(5);await sleep(180);const second=loop();await sleep(180);
  const monitor=(async()=>{while(running){if(pids.size){const [sample]=await op.$queryRaw`SELECT count(*) FILTER(WHERE EXISTS(SELECT FROM pg_locks l WHERE l.pid=a.pid AND l.relation='public."Club"'::regclass AND l.mode='RowShareLock'))::int shared,COALESCE(max(extract(epoch FROM (clock_timestamp()-a.xact_start))*1000),0)::float8 age,COALESCE(max(cardinality(pg_blocking_pids(a.pid))),0)::int blockers FROM pg_stat_activity a WHERE a.pid=ANY(${[...pids]}::int[])`;samples++;if(sample.shared)occupancy++;maxAgeMs=Math.max(maxAgeMs,sample.age);maxBlockers=Math.max(maxBlockers,sample.blockers);}await sleep(15);}})();
  const started=Date.now();while(Date.now()-started<1800){results.push(await worker.processScheduledCommunications(8));await sleep(100);}
  const during=await db.scheduledCommunication.findMany({where:{id:{in:ids}},select:{id:true,status:true,updatedAt:true,scheduledAt:true}});const polled= during.filter(r=>ids.slice(0,2).includes(r.id));
  running=false;await Promise.all([first,second,monitor]);
  assert.equal(during.find(r=>r.id===ids[2]).status,'PUBLISHED','another club progresses');
  assert.equal(polled.filter(r=>r.status==='PUBLISHED').length,expectProgress?2:0);
  const stoppedAt=Date.now(),follow=await worker.processScheduledCommunications(8),afterStoppingMs=Date.now()-stoppedAt;assert.equal(await db.scheduledCommunication.count({where:{id:{in:ids},status:'PUBLISHED'}}),3);
  assert.equal(errors.length,0,'real database/pool exceptions are distinct from locked-row skips');assert.equal(mutations,0,'steady polling performs no ORM mutations');
  console.log(JSON.stringify({polling:expectProgress?'fixed':'baseline',reads,workerInvocations:results.length,publishedWhilePolling:results.reduce((n,r)=>n+r.published,0),lockedShareOccupancy:samples?occupancy/samples:0,maxReadTransactionAgeMs:Math.round(maxAgeMs),maxBlockers,poolAcquireP95Ms:timings.filter(r=>r.acquireMs!==undefined).map(r=>r.acquireMs).sort((a,b)=>a-b)[Math.floor(timings.length*.95)]??0,exceptions:errors.length,claimErrors:results.reduce((n,r)=>n+(r.claimErrors||0),0),claimDeferrals:results.reduce((n,r)=>n+(r.deferrals?.noCandidate||0),0),publishedAfterStopping:follow.published,afterStoppingMs,latenessMs:polled.filter(r=>r.status==='PUBLISHED').map(r=>r.updatedAt-r.scheduledAt)}));
 }
 await t.test('baseline: actual legacy voting read locks defer only its club, with no pool/SQL error',async()=>{assert.ok(process.env.OUTCLASS_POLL_BASELINE_SOURCE);await run(process.env.OUTCLASS_POLL_BASELINE_SOURCE,false);});
 if(process.env.OUTCLASS_POLL_REPRO_ONLY==='1')return;
 await t.test('fixed: actual voting polling stays active while both clubs publish',async()=>run('actions/voting.ts',true));
 await t.test('revocation during snapshot prevents protected response; next poll remains denied',async()=>{
  const other=await db.user.create({data:{email:randomUUID()+'@virginia.edu'}});await db.clubMember.create({data:{clubId:clubs[0].club.id,userId:other.id,isOwner:true}});
  afterSnapshot=async()=>{afterSnapshot=null;await db.clubMember.update({where:{id:clubs[0].member.id},data:{isOwner:false,status:'LEFT'}});};
  const voting=loader(resolvedMocks(wrapped))('actions/voting.ts');await assert.rejects(voting.getVotingWorkspace(clubs[0].club.id),/permission|access|changed/i);await assert.rejects(voting.getVotingWorkspace(clubs[0].club.id));await db.clubMember.update({where:{id:clubs[0].member.id},data:{isOwner:true,status:'ACTIVE'}});
 });
 await t.test('disabled account, suspension and expired support session suppress snapshot payload',async()=>{
  const voting=loader(resolvedMocks(wrapped))('actions/voting.ts');
  afterSnapshot=async()=>{afterSnapshot=null;await db.user.update({where:{id:user.id},data:{disabledAt:new Date()}});};
  await assert.rejects(voting.getVotingWorkspace(clubs[0].club.id));await db.user.update({where:{id:user.id},data:{disabledAt:null}});
  afterSnapshot=async()=>{afterSnapshot=null;await db.club.update({where:{id:clubs[0].club.id},data:{suspendedAt:new Date()}});};
  await assert.rejects(voting.getVotingWorkspace(clubs[0].club.id),/suspended/i);await db.club.update({where:{id:clubs[0].club.id},data:{suspendedAt:null}});
  impersonating=true;supportActive=true;afterSnapshot=async()=>{afterSnapshot=null;supportActive=false;};
  await assert.rejects(voting.getVotingWorkspace(clubs[0].club.id),/Impersonation expired/i);impersonating=false;
  const foreign=await db.club.create({data:{slug:randomUUID(),name:'Foreign',tagline:'',description:'',category:'Other',color:'#142d45'}});
  await assert.rejects(voting.getVotingWorkspace(foreign.id),/permission/i);
 });
});
