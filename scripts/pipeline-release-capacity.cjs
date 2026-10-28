// Bounded local HTTP diagnostic, separate from browser navigation distributions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{spawn,spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs');
const local=require('./pipeline-release-local.cjs'),{source}=require('./pipeline-release-study.cjs');
async function main(){
 assert.ok(!fs.existsSync(path.join(local.root,'release-study.stop')),'Owned study stop requested');
 const out=path.join(local.repo,'docs/performance/pipeline-release-repair/capacity-attempt-1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const started=new Date(),builds={B:source(local.variants.B),D:source(local.variants.D)},plan={startedAt:started.toISOString(),builds,order:['B','D','D','B'],waves:[2,2,3,3],concurrency:[1,2,4],cohorts:[1000,5000],warmup:'One wave per concurrency/build/cohort, before its first block',poolLimit:8,powerStart:spawnSync('pmset',['-g','batt'],{encoding:'utf8'}).stdout.split('\n')[0],rows:[],monitor:[]};
 fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2));const awake=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});
 try{for(const size of plan.cohorts){const fixture=JSON.parse(fs.readFileSync(path.join(local.root,'pipeline-release-'+size+'.json')));
  for(const [block,variant]of plan.order.entries()){
   assert.equal(source(local.variants[variant]).digest,builds[variant].digest);await local.start(variant);
   const config=local.config(),actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
   const agent=new http.Agent({keepAlive:true,maxSockets:4}),monitor=new PrismaClient({datasourceUrl:config.status.DB_URL});let done=false;
   const polling=(async()=>{while(!done){const [counts]=await monitor.$queryRaw`SELECT count(*)::int AS connections, count(*) FILTER (WHERE state='active')::int AS active, count(*) FILTER (WHERE state='idle in transaction')::int AS idle_in_transaction, count(*) FILTER (WHERE wait_event_type='Lock')::int AS lock_waiting FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND backend_type='client backend' AND pid<>pg_backend_pid()`;plan.monitor.push({size,variant,block,...counts});await new Promise(r=>setTimeout(r,25));}})();
   try{for(const concurrency of plan.concurrency){
    const warmups=block<2?1:0;
    for(let wave=-warmups;wave<plan.waves[block];wave++){
     const rows=await Promise.all(Array.from({length:concurrency},(_,reader)=>new Promise(resolve=>{
      const begin=performance.now(),kind=variant==='B'?'pipeline':'pipelinePage',url=new URL('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify([fixture.clubIds[0],{}])}),config.appUrl);
      const request=http.get(url,{agent,headers:{cookie:actor.cookieHeader(),'accept-encoding':'gzip'}},response=>{
       const ttfb=performance.now()-begin;let bytes=0;response.on('data',chunk=>bytes+=chunk.length);response.on('end',()=>resolve({size,variant,block: block+1,concurrency,wave,reader,warmup:wave<0,status:response.statusCode,elapsedMs:performance.now()-begin,ttfbMs:ttfb,encodedBodyBytes:bytes,serverTiming:response.headers['server-timing']||null,traceId:response.headers['x-outclass-trace-id']||null,failed:false}));
      });request.setTimeout(30000,()=>request.destroy(Error('request_timeout')));request.on('error',()=>resolve({size,variant,block:block+1,concurrency,wave,reader,warmup:wave<0,status:null,elapsedMs:performance.now()-begin,encodedBodyBytes:null,failed:true}));
     })));
     plan.rows.push(...rows);fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2));
    }
   }}finally{done=true;await polling;await monitor.$disconnect();agent.destroy();}
   console.log('capacity '+size+' '+variant+' block '+(block+1)+' complete');
  }
 }}finally{awake.kill('SIGTERM');plan.completedAt=new Date().toISOString();const power=spawnSync('pmset',['-g','log'],{encoding:'utf8',maxBuffer:64*1024*1024});plan.sleepAuditAvailable=power.status===0;plan.sleepEvents=power.status===0?power.stdout.split('\n').filter(l=>/\s(?:Sleep|Wake|DarkWake)\s/.test(l)&&new Date(l.slice(0,25).trim())>=started&&new Date(l.slice(0,25).trim())<=new Date(plan.completedAt)).map(l=>l.slice(0,25).trim()):null;plan.powerEnd=spawnSync('pmset',['-g','batt'],{encoding:'utf8'}).stdout.split('\n')[0];plan.complete=plan.rows.filter(r=>!r.warmup).length===140;plan.accepted=plan.complete&&plan.sleepAuditAvailable&&!plan.sleepEvents.length&&plan.powerStart===plan.powerEnd;plan.failures=plan.rows.filter(r=>r.failed||r.status!==200).length;fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2)+'\n');}
}
if(require.main===module)main().catch(e=>{console.error(e.name+': bounded capacity diagnostic failed');process.exitCode=1});
