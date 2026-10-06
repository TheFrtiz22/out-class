const {test}=require('node:test'),assert=require('node:assert/strict');
const {actionSourceMatches,readStagingImportConfig,readConfig}=require('./helpers/onboarding-e2e.cjs');
test('built action lookup matches Windows and Unix source paths without matching a different action file',()=>{
 const file='actions/organization-members.ts';
 for(const source of [file,'../C:\\Users\\arden\\OutClass\\out-class\\actions\\organization-members.ts','/workspace/out-class/'+file])assert.equal(actionSourceMatches(source,file),true);
 for(const source of ['actions/organization-members.tsx','actions/other.ts','organization-members.ts',undefined])assert.equal(actionSourceMatches(source,file),false);
});
test('hosted import explicitly pins staging while the onboarding guard remains local-only',()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-import-guard-')),file=path.join(folder,'config.json');
 const base={projectId:'outclass-interview-staging',projectRef:'omfcozcbpmevwolshibh',appUrl:'http://127.0.0.1:3111',status:{API_URL:'https://omfcozcbpmevwolshibh.supabase.co',DB_URL:'postgresql://fixture@db.omfcozcbpmevwolshibh.supabase.co:5432/postgres'},buildDir:path.resolve('.next-publish')};
 try{
  fs.writeFileSync(file,JSON.stringify(base));assert.equal(readStagingImportConfig(file).projectRef,base.projectRef);assert.throws(()=>readConfig(file));
  for(const bad of [{...base,appUrl:'https://www.out-class.net'},{...base,appUrl:'http://127.0.0.1:3000'},{...base,projectRef:'htlgjluegmdwfjkzzwic'},{...base,status:{...base.status,API_URL:'https://htlgjluegmdwfjkzzwic.supabase.co'}},{...base,status:{...base.status,DB_URL:'postgresql://fixture@db.htlgjluegmdwfjkzzwic.supabase.co/postgres'}},{...base,buildDir:path.resolve('.next')}]){
   fs.writeFileSync(file,JSON.stringify(bad));assert.throws(()=>readStagingImportConfig(file));
  }
 }finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
});
