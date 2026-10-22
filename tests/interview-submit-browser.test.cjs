const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');

test('real focusout plus pending autosave cannot swallow one explicit review submission in Chromium',async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'helpers/interview-browser-fixture.cjs')],{cwd:path.join(__dirname,'..'),env:{...process.env,OUTCLASS_INTERACTION_PORT:'4324',OUTCLASS_INTERACTION_BASELINE:process.env.OUTCLASS_INTERACTION_BASELINE||'HEAD'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 const ready=new Promise((resolve,reject)=>{server.stdout.on('data',()=>{if(output.includes('fixture ready:'))resolve()});server.on('exit',code=>reject(Error('Fixture exited '+code+': '+output)))});
 const browser=await chromium.launch({headless:true});
 try{
  await ready;const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(/^(http:\/\/127\.0\.0\.1:4324\/|blob:)/.test(r.request().url()))return r.continue();external.push(r.request().url());return r.abort()});
  await page.goto('http://127.0.0.1:4324/?mode='+(process.env.OUTCLASS_SUBMIT_TEST_MODE||'after')+'&latency=100');
  await page.getByRole('button',{name:'End current interview',exact:true}).click();
  const score=page.getByRole('slider');await score.press('End');
  await page.evaluate(()=>{const f=window.interviewFixture;f.before=f.saves.length;f.saveGate=new Promise(r=>f.release=r)});
  await page.waitForFunction(()=>window.interviewFixture.saves.length>window.interviewFixture.before);
  await score.press('ArrowLeft');const questions=page.getByRole('textbox',{name:'Questions the applicant asked',exact:true});await questions.fill('Latest question immediately before finishing');
  const notes=page.getByRole('textbox',{name:'Miscellaneous notes',exact:true});await notes.fill('Latest discussion and own assessment');
  await page.getByRole('button',{name:'End post-interview',exact:true}).click();await page.getByRole('button',{name:/Submitting/ }).waitFor();
  await page.evaluate(()=>{const f=window.interviewFixture;f.saveGate=null;f.release()});
  await page.waitForFunction(()=>{const f=window.interviewFixture;return f.saves.length>f.before+1});
  await page.getByRole('region',{name:'Submitted review',exact:true}).waitFor({timeout:4000});
  const saved=await page.evaluate(()=>{const f=window.interviewFixture;return {record:[...f.records.values()][0],saves:f.saves}});
  assert.equal(saved.record.draft.score,9.5);assert.equal(saved.record.draft.applicantQuestions,'Latest question immediately before finishing');assert.equal(saved.record.draft.additionalNotes,'Latest discussion and own assessment');assert.ok(saved.record.completedAt);
  assert.equal(saved.saves.filter(s=>s.complete).length,1);assert.equal(await page.getByRole('button',{name:/Next candidate/}).isEnabled(),true);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{await browser.close();server.kill()}
});
