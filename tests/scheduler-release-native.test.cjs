const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {loader}=require('./helpers/communications-loader.cjs');
const url=process.env.OUTCLASS_AUDIENCE_TEST_DATABASE_URL;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('release defects on actual bounded PostgreSQL/Prisma',{skip:!url,timeout:45000},async t=>{
 const parsed=new URL(url);assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,'58453');assert.equal(parsed.pathname,'/outclass_audiences_test');
 const {PrismaClient}=require('@prisma/client'),op=new PrismaClient({datasourceUrl:url}),db=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@')});
 const one=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@').replace('connection_limit=8','connection_limit=1')});
 t.after(()=>Promise.all([op.$disconnect(),db.$disconnect(),one.$disconnect()]));
 let actor=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});
 const owner=actor,club=await db.club.create({data:{slug:randomUUID(),name:'Draft isolation',tagline:'',description:'',category:'Other',color:'#142d45'}});
 const member=await db.clubMember.create({data:{clubId:club.id,userId:actor.id,isOwner:true}});
 const api=loader({'@/utils/prisma':{prisma:db},'@/utils/auth':{requireAuth:async()=>({user:actor})}})('actions/editor-drafts.ts');
 const scope={kind:'announcement',clubId:club.id},input={scope,revision:0,mutationId:randomUUID(),base:'new',content:{title:'Unpublished',body:'Retained draft'}};
 await t.test('legacy void query reproduces P2010; fixed action persists and reloads without domain publication',async()=>{
  await assert.rejects(db.$transaction(tx=>tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.id+':legacy'},0))`),e=>e.code==='P2010'&&/void/.test(e.message));
  assert.deepEqual(await api.saveEditorDraft(input),{revision:1});assert.deepEqual((await api.getEditorDraft(scope)).content,input.content);
  assert.equal(await db.scheduledCommunication.count({where:{clubId:club.id}}),0);assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id}}),0);assert.equal(await db.userNotification.count({where:{clubId:club.id}}),0);
 });
 await t.test('real first-create race, stale revision and lost acknowledgement are fenced',async()=>{
  const a={...input,scope:{...scope,resourceId:randomUUID()},mutationId:randomUUID()},b={...a,mutationId:randomUUID(),content:{title:'Other tab'}};
  const results=await Promise.all([api.saveEditorDraft(a),api.saveEditorDraft(b)]);
  assert.equal(results.filter(r=>r.revision===1).length,1);assert.equal(results.filter(r=>r.error==='conflict').length,1);
  const winner=results[0].revision===1?a:b;assert.deepEqual(await api.saveEditorDraft(winner),{revision:1});assert.equal((await api.getEditorDraft(a.scope)).revision,1);
 });
 await t.test('account/club isolation, revocation, disabled users, suspension and browser denial remain enforced',async()=>{
  actor=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});await db.clubMember.create({data:{clubId:club.id,userId:actor.id,isOwner:true}});
  assert.equal(await api.getEditorDraft(scope),null);await api.saveEditorDraft({...input,mutationId:randomUUID()});actor=owner;
  const foreign=await db.club.create({data:{slug:randomUUID(),name:'Foreign',tagline:'',description:'',category:'Other',color:'#142d45'}});
  await assert.rejects(api.saveEditorDraft({...input,scope:{...scope,clubId:foreign.id}}),/denied/);
  await db.clubMember.update({where:{id:member.id},data:{isOwner:false,permissions:[]}});await assert.rejects(api.saveEditorDraft({...input,revision:1}),/denied/);
  await db.clubMember.update({where:{id:member.id},data:{isOwner:true}});await db.user.update({where:{id:owner.id},data:{disabledAt:new Date()}});await assert.rejects(api.getEditorDraft(scope),/denied/);
  await db.user.update({where:{id:owner.id},data:{disabledAt:null}});await db.club.update({where:{id:club.id},data:{suspendedAt:new Date()}});await assert.rejects(api.saveEditorDraft({...input,revision:1}),/suspended/);await db.club.update({where:{id:club.id},data:{suspendedAt:null}});
  for(const role of ['anon','authenticated']){const [r]=await op.$queryRaw`SELECT has_table_privilege(${role},'public."EditorDraft"','SELECT,INSERT,UPDATE,DELETE') allowed`;assert.equal(r.allowed,false);}
 });
 const logs=[],prior=console.error;console.error=(event,detail)=>logs.push({event,detail});t.after(()=>console.error=prior);
 const worker=client=>loader({'@/utils/prisma':{prisma:client}})('utils/scheduled-communications.ts');
 await t.test('occupied one-connection pool reproduces pre-callback P2028; budget stays bounded and next invocation recovers',async()=>{
  let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const held=one.$transaction(async tx=>{await tx.$queryRaw`SELECT 1`;entered();await gate;},{timeout:10000});await ready;logs.length=0;const started=Date.now();
  let result;try{result=await worker(one).processScheduledCommunications(3);}finally{release();await held;}
  const claims=logs.filter(r=>r.detail.stage==='claim');assert.equal(result.claimErrors,3);assert.equal(result.claimed,0);assert.equal(result.skipped,0);
  assert.equal(claims.length,3);for(const {detail:d}of claims){assert.equal(d.code,'P2028');assert.equal(d.phase,'acquisition');assert.equal(d.transactionMs,null);assert.ok(d.acquisitionMs>=900);}
  const elapsed=Date.now()-started;assert.ok(elapsed<6000);assert.equal((await worker(one).processScheduledCommunications(1)).claimErrors,0);
  console.log(JSON.stringify({case:'pool_acquisition',elapsedMs:elapsed,claims:claims.map(r=>r.detail)}));
 });
 await t.test('actual advisory-lock wait is SQLSTATE55P03 in callback, not acquisition or an ordinary skip',async()=>{
  let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const held=op.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(72707370)::text`;entered();await gate;},{timeout:10000});await ready;logs.length=0;
  let result;try{result=await worker(db).processScheduledCommunications(1);}finally{release();await held;}
  const d=logs.find(r=>r.detail.stage==='claim').detail;assert.equal(result.claimErrors,1);assert.equal(result.skipped,0);assert.equal(d.phase,'advisory_lock');assert.equal(d.sqlState,'55P03');assert.ok(d.transactionMs>=900);assert.ok(d.acquisitionMs<900);
  assert.equal((await worker(db).processScheduledCommunications(1)).claimErrors,0);console.log(JSON.stringify({case:'lock_wait',diagnostic:d}));
 });
 await t.test('three claim lanes sharing one slow connection reproduce two acquisition failures without SQL lock waits',async()=>{
  logs.length=0;const actual=one.$transaction.bind(one);
  const delayed=new Proxy(one,{get(target,key){if(key==='$transaction')return(fn,options)=>actual(tx=>fn(new Proxy(tx,{get(t,k){if(k==='$queryRaw')return async(...args)=>{
   const result=await t.$queryRaw(...args);if(options.timeout===4000&&(/set_config|count\(\*\) total/.test(String(args[0]))))await sleep(650);return result;
  };return Reflect.get(t,k);}})),options);return Reflect.get(target,key);}});
  const result=await worker(delayed).processScheduledCommunications(3),claims=logs.filter(r=>r.detail.stage==='claim');
  assert.equal(result.claimErrors,2);assert.equal(result.skipped,1);assert.equal(result.deferrals.noCandidate,1);assert.equal(claims.length,2);
  for(const {detail:d} of claims){assert.equal(d.code,'P2028');assert.equal(d.phase,'acquisition');assert.equal(d.transactionMs,null);}
  console.log(JSON.stringify({case:'single_connection_parallel_claims',errors:claims.map(r=>r.detail)}));
 });
 await t.test('transaction expiry after acquisition is distinguishable and rolls back any claim',async()=>{
  logs.length=0;const actual=db.$transaction.bind(db);
  const delayed=new Proxy(db,{get(target,key){if(key==='$transaction')return(fn,options)=>actual(async tx=>{
   if(options.timeout!==4000)return fn(tx);
   return fn(new Proxy(tx,{get(t,k){if(k==='$queryRaw')return async(...args)=>{if(String(args[0]).includes('pg_advisory_xact_lock'))await sleep(4200);return t.$queryRaw(...args);};return Reflect.get(t,k);}}));
  },options);return Reflect.get(target,key);}});
  const result=await worker(delayed).processScheduledCommunications(1),d=logs.find(r=>r.detail.stage==='claim').detail;
  assert.equal(result.claimErrors,1);assert.equal(d.code,'P2028');assert.equal(d.phase,'advisory_lock');assert.ok(d.transactionMs>=4000);assert.equal(await db.scheduledCommunication.count({where:{clubId:club.id}}),0);
  console.log(JSON.stringify({case:'transaction_expiry',diagnostic:d}));
 });
});
