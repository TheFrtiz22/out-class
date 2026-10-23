// Frozen local production outputs, one disposable fixture, predeclared blocks.
// Never reads application .env, accepts hosted URLs, or changes production.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,spawnSync,execFileSync}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {readConfig}=require('../tests/helpers/onboarding-e2e.cjs');
const repo=path.resolve(__dirname,'..'),root=path.join(os.tmpdir(),'outclass-onboarding-e2e'),dist=path.join(repo,'.next-publish');
const hash=body=>createHash('sha256').update(body).digest('hex');
async function main(){
 const out=path.resolve(repo,process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/performance/phase2/comparison');assert.ok(out.startsWith(path.join(repo,'docs/performance/phase2')+path.sep)&&!fs.existsSync(out),'Use a new Phase 2 evidence directory');
 const configFile=path.join(root,'config.json'),config=readConfig(configFile),s=config.status;
 assert.equal(config.buildDir,dist);assert.equal(config.appUrl,'http://127.0.0.1:3107');
 const builds={A:path.join(root,'phase2-build-candidate'),B:path.join(root,'phase2-build-baseline')};
 assert.ok(fs.existsSync(path.join(builds.B,'BUILD_ID')));assert.ok(!fs.existsSync(builds.A));
 const plan=JSON.parse(fs.readFileSync(path.join(repo,'docs/performance/phase2/PLAN.json')));
 const baselinePath=path.resolve(repo,process.argv.find(a=>a.startsWith('--baseline-source='))?.slice(18)||'docs/performance/phase2/BASELINE_SOURCE.json');const baseline=JSON.parse(fs.readFileSync(baselinePath));
 assert.equal(baseline.commit,plan.baseline);assert.equal(fs.readFileSync(path.join(builds.B,'BUILD_ID'),'utf8').trim(),baseline.buildId);
 assert.ok(!fs.existsSync(path.join(root,'.phase2-study-owner')));fs.writeFileSync(path.join(root,'.phase2-study-owner'),repo,{mode:0o600});
 fs.cpSync(dist,builds.A,{recursive:true});fs.mkdirSync(out,{recursive:true});
 const ids=Object.fromEntries(Object.entries(builds).map(([v,p])=>[v,fs.readFileSync(path.join(p,'BUILD_ID'),'utf8').trim()]));assert.notEqual(ids.A,ids.B);
 const differences=Object.entries(baseline.files).filter(([file,digest])=>!fs.existsSync(path.join(repo,file))||hash(fs.readFileSync(path.join(repo,file)))!==digest).map(([file])=>file);
 differences.push('components/selected-club-workspace.tsx');
 const record={baseline:baseline.commit,planSha256:hash(fs.readFileSync(path.join(repo,'docs/performance/phase2/PLAN.json'))),buildIds:ids,applicationDifferences:differences,blocks:plan.measurement.blocks,completed:[],failures:[],poolLimitPerClient:8,environment:'One loopback production-build browser; desktop Chromium; real local Supabase Auth/PostgreSQL; fixed keyboard activation.'};
 const save=()=>fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(record,null,2)+'\n');save();
 const db=new URL(s.DB_URL);db.searchParams.set('connection_limit','8');
 const env={...process.env,NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',DATABASE_URL:db.href,POSTGRES_PRISMA_URL:db.href,POSTGRES_URL:db.href,POSTGRES_URL_NON_POOLING:db.href,NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY,SUPABASE_SECRET_KEY:s.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY,OUTCLASS_PUBLISH_BUILD:'1',OUTCLASS_SITE_URL:config.appUrl,OUTCLASS_PLATFORM_ADMIN_IDS:config.admin.id,SMTP_HOST:'127.0.0.1',SMTP_PORT:'55325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',CRON_SECRET:randomUUID(),NODE_EXTRA_CA_CERTS:path.join(root,'mailpit-cert.pem'),COMMUNICATIONS_EMAIL_ENABLED:'true',RESEND_API_KEY:'',RESEND_FROM_EMAIL:''};
 let running,aborted=false,phase='starting',cpuLast=cpu();const telemetry=[];
 function cpu(){return os.cpus().reduce((a,c)=>({idle:a.idle+c.times.idle,total:a.total+Object.values(c.times).reduce((x,y)=>x+y,0)}),{idle:0,total:0})}
 const sample=setInterval(()=>{const next=cpu(),total=next.total-cpuLast.total;telemetry.push({at:new Date().toISOString(),phase,cpuBusyPercent:total?Math.round(10000*(1-(next.idle-cpuLast.idle)/total))/100:null,load:os.loadavg(),freeMemoryMiB:Math.round(os.freemem()/1048576)});cpuLast=next},1000);
 async function stop(){
  const listener=spawnSync('lsof',['-tiTCP:3107','-sTCP:LISTEN'],{encoding:'utf8'}).stdout.trim();if(!listener)return;
  const pid=fs.readFileSync(path.join(root,'server.pid'),'utf8').trim();assert.equal(listener,pid,'Only the registered local listener can stop');
  assert.ok(execFileSync('lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').includes('n'+repo));process.kill(Number(pid),'SIGTERM');
  for(let n=0;n<100;n++){if(!spawnSync('lsof',['-tiTCP:3107','-sTCP:LISTEN'],{encoding:'utf8'}).stdout.trim())return;await new Promise(r=>setTimeout(r,50))}throw Error('Registered listener failed to stop');
 }
 async function start(variant){await stop();assert.equal(fs.readFileSync(path.join(root,'.phase2-study-owner'),'utf8'),repo);fs.rmSync(dist,{recursive:true});fs.cpSync(builds[variant],dist,{recursive:true});
  assert.equal(fs.readFileSync(path.join(dist,'BUILD_ID'),'utf8').trim(),ids[variant]);const fd=fs.openSync(path.join(root,'phase2-server.log'),'a'),app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{cwd:repo,env,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);app.unref();fs.writeFileSync(path.join(root,'server.pid'),String(app.pid));
  for(let n=0;n<100;n++){try{if((await fetch(config.appUrl,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('Local production output did not start');
 }
 async function collect(destination,samples){assert.ok(!aborted);const fd=fs.openSync(path.join(root,'phase2-benchmark.log'),'a');running=spawn(process.execPath,['scripts/navigation-audit.cjs','--phase2','--cold-warm','--samples='+samples,'--out='+destination],{cwd:repo,env,stdio:['ignore',fd,fd]});const exit=await new Promise((resolve,reject)=>{running.once('error',reject);running.once('close',resolve)});running=null;fs.closeSync(fd);
  const file=path.join(destination,'browser-samples.json');assert.ok(fs.existsSync(file),'Every planned block must produce evidence');const data=JSON.parse(fs.readFileSync(file));
  const result={directory:path.relative(out,destination),planned:samples*8,observed:data.samples.length,failures:data.failures,exit};record.completed.push(result);save();assert.equal(exit,0,'A benchmark block failed; retain it and stop');assert.equal(data.failures.length,0);assert.equal(data.samples.length,samples*8);assert.ok(data.samples.every(r=>r.pageErrorCount===0&&r.requests.every(q=>q.status>=200&&q.status<400&&!q.failed)),'Browser or HTTP failures invalidate the block');assert.ok(data.samples.every(r=>r.requests.filter(q=>q.route.startsWith('/api/workspace')).every(q=>Number.isFinite(q.encodedBodyBytes))),'Missing body counters invalidate the block');
 }
 const abort=()=>{aborted=true;running?.kill('SIGTERM')};process.once('SIGINT',abort);process.once('SIGTERM',abort);
 try{for(const[pair,order]of record.blocks.entries())for(const[position,variant]of [...order].entries()){
   phase=`${pair}-${position}-${variant}-starting`;await start(variant);
   const prefix=path.join(out,`pair-${pair+1}-${position+1}-${variant}`);phase=`${pair}-${position}-${variant}-warmup`;await collect(prefix+'-warmup',1);phase=`${pair}-${position}-${variant}-measure`;await collect(prefix+'-measure',5);
   console.log(`Pair ${pair+1}/${record.blocks.length}, ${variant}, complete; every planned row retained.`);
  }record.collectionComplete=true;save();
 }catch(error){record.failures.push({phase,name:error.name,message:String(error.message).split('\n')[0]});save();throw error;
 }finally{clearInterval(sample);running?.kill('SIGTERM');await stop();fs.writeFileSync(path.join(out,'SYSTEM.json'),JSON.stringify(telemetry,null,2)+'\n');fs.rmSync(dist,{recursive:true});fs.cpSync(builds.A,dist,{recursive:true});record.applicationStopped=true;record.privateFixtureRetainedForExplicitCleanup=true;save();process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
if(require.main===module)main().catch(e=>{console.error(e.name+': '+e.message.split('\n')[0]);process.exitCode=1});
