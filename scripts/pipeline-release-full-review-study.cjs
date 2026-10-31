// Additional, stricter 100-applicant review-readiness gate. Does not replace
// primary outcomes or change their frozen predicates/acceptance tolerances.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const local=require('./pipeline-release-local.cjs'),{source}=require('./pipeline-release-study.cjs');
async function main(){
 const out=path.join(local.repo,'docs/performance/pipeline-release-repair/full-review-attempt-1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const started=new Date(),digest=p=>createHash('sha256').update(fs.readFileSync(path.join(local.repo,p))).digest('hex'),power=()=>spawnSync('pmset',['-g','batt'],{encoding:'utf8'}).stdout.split('\n')[0];
 const plan={startedAt:started.toISOString(),powerStart:power(),size:100,order:['B','D','D','B'],profiles:['local','constrained'],perBlockMeasured:5,perBlockWarmups:2,
  gate:'Original 100-applicant workflow tolerances; additionally wait for authorized review information and factual attendance before switching. Primary results remain independently required.',builds:{B:source(local.variants.B),D:source(local.variants.D)},tools:Object.fromEntries(['scripts/pipeline-release-full-review.cjs','scripts/pipeline-release-full-review-study.cjs','scripts/pipeline-release-local.cjs'].map(p=>[p,digest(p)])),blocks:[]};
 fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2));const awake=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});
 try{fs.copyFileSync(path.join(local.root,'pipeline-release-100.json'),path.join(local.root,'navigation-fixture.json'));
  for(const profile of plan.profiles)for(const [index,variant]of plan.order.entries()){
   assert.equal(power(),plan.powerStart);assert.equal(source(local.variants[variant]).digest,plan.builds[variant].digest);await local.start(variant);
   const directory=profile+'-block-'+(index+1)+'-'+variant,dir=path.join(out,directory);fs.mkdirSync(dir);const fd=fs.openSync(path.join(dir,'collector.log'),'w');
   const result=spawnSync(process.execPath,['scripts/pipeline-release-full-review.cjs','--samples=5','--warmups=2','--out='+path.join(dir,'workflow.json'),...(profile==='constrained'?['--constrained-network']:[])],{cwd:local.repo,env:local.environment(),stdio:['ignore',fd,fd]});fs.closeSync(fd);
   plan.blocks.push({profile,variant,block:index+1,directory,status:result.status});fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2));console.log('full review '+profile+' '+variant+' block '+(index+1)+' exit '+result.status);
  }
 }finally{awake.kill('SIGTERM');plan.completedAt=new Date().toISOString();const logs=spawnSync('pmset',['-g','log'],{encoding:'utf8',maxBuffer:64*1024*1024});plan.sleepAuditAvailable=logs.status===0;plan.sleepEvents=logs.status===0?logs.stdout.split('\n').filter(l=>/\s(?:Sleep|Wake|DarkWake)\s/.test(l)&&new Date(l.slice(0,25).trim())>=started&&new Date(l.slice(0,25).trim())<=new Date(plan.completedAt)).map(l=>l.slice(0,25).trim()):null;plan.powerEnd=power();plan.complete=plan.blocks.length===8;plan.toolsVerified=Object.entries(plan.tools).every(([p,h])=>digest(p)===h);plan.sourcesVerified=Object.entries(plan.builds).every(([v,b])=>source(local.variants[v]).digest===b.digest);plan.acceptedTiming=plan.complete&&plan.sleepAuditAvailable&&!plan.sleepEvents.length&&plan.powerStart===plan.powerEnd&&plan.toolsVerified&&plan.sourcesVerified;fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(plan,null,2)+'\n');}
}
if(require.main===module)main().catch(e=>{console.error(e.name+': full-review supplement failed; retained attempt');process.exitCode=1});
