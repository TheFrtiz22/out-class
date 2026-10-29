// Bounded local HTTP diagnostic, separate from browser navigation distributions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{spawn,spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs');
const local=require('./pipeline-release-local.cjs'),{source}=require('./pipeline-release-study.cjs'),host=require('./pipeline-release-ci-host.cjs'),{attest}=require('./pipeline-release-ci-attest.cjs');
async function main(){
 assert.ok(!fs.existsSync(path.join(local.root,'release-study.stop')),'Owned study stop requested');
 const clock=host.begin();
 const out=path.join(local.repo,'docs/performance/pipeline-release-repair/ci/capacity-attempt-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const started=new Date(),builds=require('./pipeline-release-ci-runtime.cjs').builds(local,source),plan={startedAt:started.toISOString(),builds,order:['B','D','D','B'],waves:[2,2,3,3],concurrency:[1,2,4],cohorts:[1000,5000],warmup:'One wave per concurrency in every fresh server block' ,poolLimit:8,environment:clock.metadata,attestations:[],rows:[],monitor:[]};
 const digest=p=>createHash('sha256').update(fs.readFileSync(path.join(local.repo,p))).digest('hex');
 plan.toolHashes=Object.fromEntries(['scripts/pipeline-release-ci-capacity.cjs','scripts/pipeline-release-ci-host.cjs','scripts/pipeline-release-ci-attest.cjs','scripts/pipeline-release-ci-runtime.cjs','scripts/pipeline-release-local.cjs','scripts/pipeline-release-study.cjs'].map(p=>[p,digest(p)]));
 fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2));
 try{for(const size of plan.cohorts){const fixture=JSON.parse(fs.readFileSync(path.join(local.root,'pipeline-release-'+size+'.json')));
  for(const [block,variant]of plan.order.entries()){
   assert.equal(source(local.variants[variant]).digest,builds[variant].digest);await local.start(variant);
   fs.copyFileSync(path.join(local.root,'pipeline-release-'+size+'.json'),path.join(local.root,'navigation-fixture.json'));const proof=await attest(variant,builds[variant],size);plan.attestations.push({size,variant,block:block+1,...proof});fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2));assert.equal(proof.valid,true,proof.failure);
   const config=local.config(),actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
   const agent=new http.Agent({keepAlive:true,maxSockets:4}),monitor=new PrismaClient({datasourceUrl:config.status.DB_URL});let done=false;
   const polling=(async()=>{while(!done){const [counts]=await monitor.$queryRaw`SELECT count(*)::int AS connections, count(*) FILTER (WHERE state='active')::int AS active, count(*) FILTER (WHERE state='idle in transaction')::int AS idle_in_transaction, count(*) FILTER (WHERE wait_event_type='Lock')::int AS lock_waiting FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND backend_type='client backend' AND pid<>pg_backend_pid()`;plan.monitor.push({size,variant,block,...counts});await new Promise(r=>setTimeout(r,25));}})();
   try{for(const concurrency of plan.concurrency){
    const warmups=1;
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
 }}finally{plan.completedAt=new Date().toISOString();plan.hostAudit=host.finish(clock);plan.complete=plan.rows.filter(r=>!r.warmup).length===140;plan.sourcesVerified=Object.entries(builds).every(([v,b])=>source(local.variants[v]).digest===b.digest);plan.toolsVerified=Object.entries(plan.toolHashes).every(([p,h])=>digest(p)===h);plan.timingEligible=plan.sourcesVerified&&plan.toolsVerified&&plan.complete&&plan.hostAudit.clockConsistent;plan.failures=plan.rows.filter(r=>r.failed||r.status!==200).length;fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(plan,null,2)+'\n');}
 if(!plan.timingEligible||plan.failures)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.name+': bounded CI capacity diagnostic failed');process.exitCode=1});
