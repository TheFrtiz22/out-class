// Frozen-build comparison. Never overwrites evidence or replaces failed rows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const local=require('./navigation-pipeline-ready-local.cjs');
const {startMonitor}=require('./navigation-selected-ready-host-monitor.cjs');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function outputDirectory(profile,attempt=1,repo=local.repo){
 assert.ok(['local','constrained'].includes(profile));assert.ok(Number.isInteger(attempt)&&attempt>0&&attempt<100);
 const out=path.join(repo,'docs/performance/pipeline-ready-20261027',`small-${profile}-attempt-${attempt}`);
 assert.ok(!fs.existsSync(out),'Retain the entire earlier attempt');return out;
}
function validatePlan(plan){
 assert.deepEqual(plan.measurement.cohorts,[1]);assert.deepEqual(plan.measurement.order,['B','A','A','B']);
 assert.equal(plan.measurement.warmupsPerBlockGroup,1);assert.equal(plan.measurement.measuredPerBlockGroup,5);
 assert.deepEqual(plan.measurement.harnessFlags,['--phase2','--phase3','--cold-warm','--record-failures','--source-diagnostics']);
 return {groupsPerBlock:4,measuredPerBuildGroup:10,measuredPerProfile:80,warmupsPerProfile:16};
}
function sleepRecord(line){
 const m=line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})\s+(\S+)/);if(!m)return null;
 const timestamp=Date.parse(`${m[1]}T${m[2]}${m[3]}`);return Number.isFinite(timestamp)?{timestamp,kind:m[4]}:null;
}
function classifySleep(records,start,end){
 const from=Date.parse(start),to=Date.parse(end);assert.ok(Number.isFinite(from)&&to>=from);
 const events=records.filter(r=>r.timestamp>=from&&r.timestamp<=to&&['Sleep','DarkWake','Wake'].includes(r.kind)).map(r=>({at:new Date(r.timestamp).toISOString(),kind:r.kind}));
 return {valid:records.length>0&&events.length===0,recognizedRecords:records.length,events};
}
async function auditSleep(start,end){
 const records=[];let pending='',bytes=0;
 const child=spawn('pmset',['-g','log'],{stdio:['ignore','pipe','ignore']});child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){const r=sleepRecord(line);if(r)records.push(r)}});
 const timeout=setTimeout(()=>child.kill('SIGTERM'),20000);
 try{const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});if(pending){const r=sleepRecord(pending);if(r)records.push(r)}return {...classifySleep(records,start,end),commandSucceeded:status===0,valid:status===0&&classifySleep(records,start,end).valid,bytesRead:bytes,scope:'Actual Sleep/DarkWake/Wake event categories only; raw power log and process details not retained'};}finally{clearTimeout(timeout)}
}
async function main(){
 const profile=process.argv.find(a=>a.startsWith('--profile='))?.slice(10),attempt=Number(process.argv.find(a=>a.startsWith('--attempt='))?.slice(10)||1),out=outputDirectory(profile,attempt),root=path.dirname(out);
 const planFile=path.join(root,'SMALL_PLAN.json'),plan=read(planFile),counts=validatePlan(plan),fixtureManifest=read(path.join(root,'SMALL_FIXTURE_MANIFEST.json'));
 const manifests={B:read(path.join(root,'BASELINE_SOURCE.json')),A:read(path.join(root,'CANDIDATE_SOURCE.json'))};
 const tools=['scripts/navigation-audit.cjs','scripts/navigation-pipeline-ready-local.cjs','scripts/navigation-selected-ready-host-monitor.cjs','scripts/navigation-pipeline-small-study.cjs','tests/helpers/onboarding-e2e.cjs'];
 const frozen=Object.fromEntries(tools.map(f=>[f,hash(path.join(local.repo,f))])),planHash=hash(planFile),fixtureManifestHash=hash(path.join(root,'SMALL_FIXTURE_MANIFEST.json'));
 for(const [variant,name]of [['B','baseline'],['A','candidate']])assert.equal(fs.readFileSync(path.join(local.privateRoot(),name,'BUILD_ID'),'utf8').trim(),manifests[variant].buildId);
 fs.mkdirSync(out);
 const state={startedAt:new Date().toISOString(),complete:false,profile,attempt,base:plan.base,counts,toolHashes:frozen,planSha256:planHash,fixtureManifestSha256:fixtureManifestHash,builds:{B:manifests.B.buildId,A:manifests.A.buildId},blocks:[],failures:[]};
 const save=()=>fs.writeFileSync(path.join(out,'PROTOCOL.json'),JSON.stringify(state,null,2)+'\n');save();
 const host=startMonitor({repo:local.repo,output:path.join(out,'HOST_MONITOR.json')});
 const check=()=>{for(const[file,digest]of Object.entries(manifests.A.files))assert.equal(hash(path.join(local.repo,file)),digest,file);for(const[file,digest]of Object.entries(frozen))assert.equal(hash(path.join(local.repo,file)),digest,file);assert.equal(hash(planFile),planHash);assert.equal(hash(path.join(root,'SMALL_FIXTURE_MANIFEST.json')),fixtureManifestHash);host.assertClean();};
 async function command(args,log){const fd=fs.openSync(path.join(local.root,log),'a',0o600);try{const child=spawn(process.execPath,args,{cwd:local.repo,env:local.environment(),stdio:['ignore',fd,fd]});return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})}finally{fs.closeSync(fd)}}
 try{
  for(const size of plan.measurement.cohorts){
   check();await local.stop();const fixture=path.join(local.privateRoot(),`fixture-small-${size}.json`);assert.equal(hash(fixture),fixtureManifest.cohorts[String(size)].sha256);fs.copyFileSync(fixture,path.join(local.root,'navigation-fixture.json'));fs.chmodSync(path.join(local.root,'navigation-fixture.json'),0o600);
   for(const [position,variant]of plan.measurement.order.entries()){
    check();host.setPhase(`${size}-${position+1}-${variant}-start`);await local.start(variant==='A'?'candidate':'baseline');assert.equal(fs.readFileSync(path.join(local.dist,'BUILD_ID'),'utf8').trim(),state.builds[variant]);
    for(const [stage,n]of [['warmup',1],['measure',5]]){
     const directory=`size-${size}-block-${position+1}-${variant}-${stage}`;host.setPhase(directory);check();
     const status=await command(['scripts/navigation-audit.cjs',...plan.measurement.harnessFlags,...(profile==='constrained'?['--constrained-network']:[]),'--samples='+n,'--out='+path.join(out,directory)],'pipeline-ready-study.log');
     const data=read(path.join(out,directory,'browser-samples.json'));state.blocks.push({directory,size,variant,stage,planned:n*counts.groupsPerBlock,observed:data.samples.length,failures:data.failures.length,status});save();
     assert.equal(data.samples.length,n*counts.groupsPerBlock,'No missing or replacement rows');assert.equal(status,data.failures.length?1:0,'Unexpected collector failure');assert.equal(hash(path.join(local.root,'navigation-fixture.json')),fixtureManifest.cohorts[String(size)].sha256);check();
    }
    console.log(`${profile}: cohort ${size}, block ${position+1}/4 (${variant}) complete; all outcomes retained.`);
   }
  }
  state.complete=true;
 }catch(error){state.failures.push({type:error.name,reason:'Structural or host-control failure; entire attempt retained, never partially accepted'});throw error;}
 finally{
  await local.stop();state.completedAt=new Date().toISOString();state.hostControl=host.stop();state.sleepAudit=await auditSleep(state.startedAt,state.completedAt).catch(()=>({valid:false,reason:'sleep_audit_unavailable'}));state.applicationStopped=true;state.valid=state.complete&&state.hostControl.valid&&state.sleepAudit.valid;save();if(!state.valid)process.exitCode=1;
 }
}
module.exports={outputDirectory,validatePlan,sleepRecord,classifySleep,auditSleep};
if(require.main===module)main().catch(e=>{console.error(e.name+': pipeline comparison stopped; retained complete attempt');process.exitCode=1});
