const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {apps,sessionId,uuid}=require('./helpers/voting-room-harness.cjs');
const hash=t=>createHash('sha256').update(t,'utf8').digest('hex');
const answer='I organized a campus food drive with six volunteers, tracked weekly donations in a shared sheet, and adjusted our pickup schedule when a partner pantry changed its hours, which kept every delivery on time for the semester.';
const source=(id,text,label)=>({type:'PROFILE',id,version:hash(text),revision:null,label,author:null,roundId:null,roundName:null,text});
const quote=(n,id,text,label,excerpt=text)=>({id:uuid(600+n),mode:'QUOTE',text:excerpt,source:source(id,text,label),writtenBy:null});

test('locked highlights render consistently across applicants, keep full sources in details, and fit projector and phone',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const preparations=[
  {sessionId,applicationId:apps[0],revision:2,highlights:[quote(1,'profile:answers:0',answer,'Application answers','adjusted our pickup schedule when a partner pantry changed its hours'),{...quote(2,'profile:answers:0',answer,'Application answers'),mode:'SUMMARY',text:'Ran a semester-long volunteer drive and handled a schedule change without missed deliveries.',writtenBy:'QA Leader'},quote(3,'profile:major:0','Economics','Major')]},
  {sessionId,applicationId:apps[1],revision:1,highlights:[quote(4,'profile:major:0','Economics','Major')]},
 ],locks=[];
 f.h.tx.votingSlidePreparation={findMany:async({where})=>structuredClone(preparations.filter(p=>where.applicationId.in.includes(p.applicationId))),findUnique:async({where})=>structuredClone(preparations.find(p=>p.applicationId===where.sessionId_applicationId.applicationId)??null)};
 f.h.tx.votingSlideLock={createMany:async({data})=>{locks.push(...structuredClone(data));return{count:data.length}},findUnique:async({where})=>{const k=where.sessionId_passNumber_applicationId;return structuredClone(locks.find(l=>l.passNumber===k.passNumber&&l.applicationId===k.applicationId)??null)}};
 // Same submitted-interview evidence as the existing slide test, so every selected field renders (worst-case height).
 const r2={...f.h.round,id:uuid(48),name:'Second interview',order:1},originalRound=f.h.tx.pipelineRound.findFirst,leaderId=require('./helpers/voting-room-harness.cjs').leaderId,roundId=f.h.round.id;
 f.h.tx.pipelineRound.findMany=async()=>[f.h.round,r2];f.h.tx.pipelineRound.findFirst=async args=>args.where.id===r2.id?structuredClone(r2):originalRound(args);
 f.h.tx.evaluation.findMany=async({where})=>where.applicationId===apps[0]?[{interviewerId:leaderId,roundId,score:8.25,submittedAt:new Date()},{interviewerId:leaderId,roundId:r2.id,score:9.5,submittedAt:new Date()}]:[];
 f.h.tx.interviewRecord.findMany=async({where})=>where.applicationId===apps[0]?[{id:uuid(888),applicationId:apps[0],roundId,interviewerId:leaderId,draft:{finalInterviewThoughts:answer,additionalNotes:'PRIVATE MISC'},evaluation:{applicationId:apps[0],roundId,interviewerId:leaderId,submittedAt:new Date()},interviewer:{clubId:f.clubId,user:{studentProfile:{firstName:'QA',lastName:'Reviewer'}}}}]:[];
 try{
  await f.h.create({presentationOptions:{fields:['finalInterviewThoughts','act','interviewScore','sat','gpa','academicYear','major','name','photo','resumeHighlight'],highlights:{}}});await f.h.command('START');
  assert.equal(locks.length,2,'pass one locks both prepared applicants at START');
  // Editing the working copy after START must not change what this pass presents.
  preparations[0].highlights[2]={...preparations[0].highlights[2],text:'Changed after start'};preparations[0].revision=3;
  const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=present&actor=leader`;
  await page.goto(base);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();
  const band=page.getByRole('region',{name:'Leader-selected highlights'});await band.waitFor();
  assert.equal(await band.getByRole('listitem').count(),3);
  assert.ok(await band.getByText('Leader summary:').count(),'summary is labelled as leader writing');
  assert.equal(await band.locator('q').count(),2,'quotations render as quotations');
  assert.ok(await band.getByText('Economics',{exact:true}).count(),'locked copy, not the later edit');assert.equal(await page.getByText('Changed after start').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'three highlights plus all selected fields fit a 1280×720 projector');
  const out=path.resolve('test-results/voting-slide-preparation');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'projector-highlights.png'),fullPage:true});
  const axe=await new AxeBuilder({page}).include('.vr-applicant').analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
  await page.getByRole('button',{name:'Applicant details and highlight sources'}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByText('Full original source').first().click();assert.ok(await dialog.getByText(answer,{exact:true}).count(),'details link to the full source');
  assert.ok(await dialog.getByText(/Leader summary by QA Leader/).count());await page.keyboard.press('Escape');
  // Same structure for the next applicant, with fewer highlights.
  await f.h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{confirmed:true,reason:'Fixture advance',applicationId:apps[0],passNumber:1});
  await page.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor({timeout:20000});
  assert.equal(await page.getByRole('region',{name:'Leader-selected highlights'}).getByRole('listitem').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  // Phone reflow: no horizontal overflow.
  const phone=await browser.newContext({viewport:{width:390,height:844}}),p2=await phone.newPage();await p2.goto(base);await p2.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor();
  assert.ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow on phones');await phone.close();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close?.();}
});
