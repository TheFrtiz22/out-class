const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Actor,readConfig}=require('./helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('isolated built Next action loads PDF.js and its worker, returns proposals and structured failures', {skip:!configFile,timeout:30000},async()=>{
 const config=readConfig(configFile),fixture=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'ui-fixture.json')));
 const actor=new Actor(config);await actor.signIn(fixture.president.email,fixture.president.password);
 const input=(bytes,name='resume.pdf',type='application/pdf')=>{const form=new FormData();form.set('file',new Blob([bytes],{type}),name);return form;};
 const prepare=form=>actor.action('actions/resume-import.ts','prepareResumeImport',[form]);
 const result=await prepare(input(fs.readFileSync('tests/fixtures/resume-import/representative.pdf')));
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.proposal.fields.find(v=>v.field==='gpa').value,'3.75');assert.equal(result.proposal.experiences.length,2);
 assert.ok(result.reference.startsWith(actor.user.id+'/'));
 for(const form of [input(Buffer.from('not PDF')),input(Buffer.from('text'),'resume.txt','text/plain'),input(Buffer.from('%PDF-malformed')),input(fs.readFileSync('tests/fixtures/resume-import/empty.pdf'))]){
  const failure=await prepare(form);assert.equal(failure.ok,false);assert.equal(typeof failure.code,'string');assert.ok(failure.message);assert.doesNotMatch(failure.message,/Server Components|node_modules|SQL|digest/);
 }
});
