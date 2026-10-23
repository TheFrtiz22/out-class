const {test}=require('node:test');
const assert=require('node:assert/strict');
const {distribution,safeRoute,validateActiveOutput}=require('../scripts/navigation-audit.cjs');
test('audit nearest-rank percentiles do not fabricate missing measurements',()=>{
  assert.deepEqual(distribution([]),{samples:0,p50:null,p95:null,max:null});
  assert.deepEqual(distribution([null,undefined,NaN]),{samples:0,p50:null,p95:null,max:null});
  assert.deepEqual(distribution(Array.from({length:20},(_,i)=>20-i)),{samples:20,p50:10,p95:19,max:20});
});
test('saved request names omit query arguments, tokens and fixture identifiers',()=>{
  assert.equal(safeRoute('/api/workspace?kind=pipeline&args=secret&token=secret'),'/api/workspace?kind=pipeline');
  assert.equal(safeRoute('/club/00000000-0000-4000-8000-000000000001/workspace?private=secret'),'/club/[fixture-id]/workspace');
});
test('active workload output cannot replace the original audit or existing evidence',t=>{
  const fs=require('node:fs'),path=require('node:path');
  assert.throws(()=>validateActiveOutput(),/explicit new output/);
  assert.throws(()=>validateActiveOutput('docs/performance/evidence'),/new active-workload subdirectory/);
  const dir=fs.mkdtempSync(path.resolve('docs/performance/phase1/active-workload/.output-guard-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.doesNotThrow(()=>validateActiveOutput(dir));
  fs.writeFileSync(path.join(dir,'browser-samples.json'),'preserved evidence');
  assert.throws(()=>validateActiveOutput(dir),/must not be overwritten/);
  assert.equal(fs.readFileSync(path.join(dir,'browser-samples.json'),'utf8'),'preserved evidence');
});
test('hydration fixture accepts only its separate local project and ports',t=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const {fixtureProfile}=require('../scripts/navigation-fixture-config.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-hydration-guard-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'config.json'),profile=fixtureProfile(true);
  const config={projectId:'outclass-hydration-e2e',appUrl:'http://127.0.0.1:3117',status:{API_URL:'http://127.0.0.1:58321',DB_URL:'postgresql://fixture@127.0.0.1:58322/postgres',MAILPIT_URL:'http://127.0.0.1:58324'}};
  fs.writeFileSync(file,JSON.stringify(config));assert.equal(profile.readConfig(file).projectId,config.projectId);
  for(const changed of [{...config,projectId:'outclass-onboarding-e2e'},{...config,status:{...config.status,DB_URL:'postgresql://fixture@db.example.test:58322/postgres'}},{...config,status:{...config.status,API_URL:'http://127.0.0.1:55321'}}]){fs.writeFileSync(file,JSON.stringify(changed));assert.throws(()=>profile.readConfig(file));}
});
