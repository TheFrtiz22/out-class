// Immutable BAAB production-build comparison. Run only after all QA has stopped.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync,execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const local=require('./pipeline-release-local.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
function command(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});assert.equal(r.status,0,cmd+' failed');return r.stdout;}
function source(cwd){
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd}).toString().split('\0').filter(p=>/^(actions|app|components|contexts|hooks|lib|utils|public|styles|prisma)\//.test(p)||/^(middleware\.ts|next\.config\.mjs|package\.json|pnpm-lock\.yaml|tsconfig\.json)$/.test(p)).sort();
 const hashes=Object.fromEntries(files.map(p=>[p,hash(fs.readFileSync(path.join(cwd,p)))]));return{commit:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),buildId:fs.readFileSync(path.join(cwd,'.next-publish/BUILD_ID'),'utf8').trim(),hashes,digest:hash(JSON.stringify(hashes))};
}
async function main(){
 assert.ok(!fs.existsSync(path.join(local.root,'release-study.stop')),'Owned study stop requested');
 const profile=process.argv.find(a=>a.startsWith('--profile='))?.slice(10)||'local',attempt=process.argv.find(a=>a.startsWith('--attempt='))?.slice(10)||'1',screening=process.argv.includes('--screening');
 assert.ok(['local','constrained'].includes(profile));assert.match(attempt,/^\d+$/);
 const out=path.join(local.repo,'docs/performance/pipeline-release-repair',screening?'screening': 'runs',profile+'-attempt-'+attempt);assert.ok(!fs.existsSync(out),'Never overwrite an attempt');fs.mkdirSync(out,{recursive:true});
 const started=new Date(),builds={B:source(local.variants.B),D:source(local.variants.D)};
 const tools=['scripts/navigation-audit.cjs','scripts/pipeline-release-study.cjs','scripts/pipeline-release-workflow.cjs','scripts/pipeline-release-local.cjs'];
 const plan={startedAt:started.toISOString(),screening,profile,cohorts:screening?[1,100]:[1,100,1000,5000],order:['B','D','D','B'],navigationPerBlock:screening?1:'15 at one applicant, otherwise 5',navigationWarmupsPerBlock:screening?0:2,workflowMeasuredPerBlock:screening?1:5,workflowWarmupsPerBlock:screening?0:2,builds,toolHashes:Object.fromEntries(tools.map(p=>[p,hash(fs.readFileSync(path.join(local.repo,p)))])),acceptanceSha256:hash(fs.readFileSync(path.join(local.repo,'docs/performance/pipeline-release-repair/ACCEPTANCE.md'))),powerStart:command('pmset',['-g','batt']).split('\n')[0],lowPower:command('pmset',['-g','custom']).split('\n').filter(l=>l.includes('lowpowermode')),blocks:[]};
 plan.fixtures=plan.cohorts.map(size=>{const file=path.join(local.root,'pipeline-release-'+size+'.json'),data=JSON.parse(fs.readFileSync(file));return{size,sha256:hash(fs.readFileSync(file)),counts:data.counts,actorMemberships:5}});
 plan.preparation='Functional QA dismissed visible guides through their accessible controls before timing; no tutorial mutations are issued by this study.';
 fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2)+'\n');
 const assertion=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});
 function run(script,args,dir){fs.mkdirSync(dir,{recursive:true});const fd=fs.openSync(path.join(dir,'collector.log'),'w');const result=spawnSync(process.execPath,[script,...args],{cwd:local.repo,env:local.environment(),stdio:['ignore',fd,fd]});fs.closeSync(fd);return result.status;}
 try{for(const size of plan.cohorts){
  fs.copyFileSync(path.join(local.root,'pipeline-release-'+size+'.json'),path.join(local.root,'navigation-fixture.json'));
  for(const [i,variant]of plan.order.entries()){
   for(const [tool,expected] of Object.entries(plan.toolHashes))assert.equal(hash(fs.readFileSync(path.join(local.repo,tool))),expected,'Collector changed after protocol freeze');
   assert.equal(source(local.variants[variant]).digest,builds[variant].digest,'Application changed after protocol freeze');
   assert.equal(command('pmset',['-g','batt']).split('\n')[0],plan.powerStart,'Power source changed; exclude attempt');
   await local.start(variant);const block={size,variant,block:i+1,startedAt:new Date().toISOString(),collectors:[]};plan.blocks.push(block);
   const extra=profile==='constrained'?['--constrained-network']:[],n=screening?1:size===1?15:5;
   for(const warmup of screening?[false]:[true,false]){
    const dir=path.join(out,'size-'+size+'-block-'+(i+1)+'-'+variant+'-'+(warmup?'warmup':'measure'));
    const status=run('scripts/navigation-audit.cjs',['--phase2','--phase3','--cold-warm','--record-failures','--source-diagnostics','--samples='+(warmup?2:n),'--out='+dir,...extra],dir);
    block.collectors.push({kind:'navigation',warmup,status,directory:path.relative(out,dir)});console.log(profile+' '+size+' '+variant+' block '+(i+1)+' navigation '+(warmup?'warmup':'measure')+' exit '+status);
   }
   const dir=path.join(out,'size-'+size+'-block-'+(i+1)+'-'+variant+'-workflow'),file=path.join(dir,'workflow.json');
   const status=run('scripts/pipeline-release-workflow.cjs',['--samples='+(screening?1:5),'--warmups='+(screening?0:2),'--out='+file,...extra],dir);
   block.collectors.push({kind:'workflow',status,directory:path.relative(out,dir)});block.completedAt=new Date().toISOString();
   fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2)+'\n');console.log(profile+' '+size+' '+variant+' block '+(i+1)+' workflow exit '+status);
  }
 }}finally{
  assertion.kill('SIGTERM');fs.copyFileSync(path.join(local.root,'pipeline-release-100.json'),path.join(local.root,'navigation-fixture.json'));
  plan.completedAt=new Date().toISOString();
  const power=spawnSync('pmset',['-g','log'],{encoding:'utf8',maxBuffer:64*1024*1024});
  plan.sleepAuditAvailable=power.status===0;
  plan.sleepEvents=power.status===0?power.stdout.split('\n').filter(l=>/\s(?:Sleep|Wake|DarkWake)\s/.test(l)).filter(l=>{const d=new Date(l.slice(0,25).trim());return Number.isFinite(+d)&&d>=started&&d<=new Date(plan.completedAt)}).map(l=>({at:l.slice(0,25).trim(),event:/\s(Sleep|Wake|DarkWake)\s/.exec(l)[1]})):null;
  plan.powerEnd=command('pmset',['-g','batt']).split('\n')[0];
  plan.complete=plan.blocks.length===plan.cohorts.length*4&&plan.blocks.every(b=>b.completedAt);
  plan.acceptedTiming=!screening&&plan.complete&&plan.sleepAuditAvailable&&!plan.sleepEvents.length&&plan.powerStart===plan.powerEnd;
  plan.functionalFailures=plan.blocks.flatMap(b=>b.collectors).filter(c=>c.status!==0).length;
  plan.toolsVerified=Object.entries(plan.toolHashes).every(([p,h])=>hash(fs.readFileSync(path.join(local.repo,p)))===h);
  plan.sourceVerified=Object.entries(builds).every(([v,b])=>source(local.variants[v]).digest===b.digest);
  plan.acceptedTiming=plan.acceptedTiming&&plan.toolsVerified&&plan.sourceVerified;
  fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2)+'\n');
 }
}
module.exports={source};
if(require.main===module)main().catch(e=>{console.error(e.name+': '+e.message.split('\n')[0]);process.exitCode=1});
