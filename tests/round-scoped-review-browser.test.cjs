// Integrated Chromium check across identity, feedback, score, ranking and target counts for one cycle with
// application review, Interview 1 and Interview 2. Slide payloads are the real serialized server evidence
// (votingSelectedEvidence on migrated PGlite SQL); the ranked list uses the canonical roundScore projection.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default,{bundle}=require('./helpers/browser-bundle.cjs');
const {fixture,seedInterviews}=require('./helpers/round-scoped-fixture.cjs');

async function payloads(){
 const f=await fixture();
 try{
  const display=(roundId,anonymous=false)=>({applicationId:f.ids.app,roundId,anonymous,configured:['name'],visible:anonymous?[]:['name'],withheld:[],links:[],photo:null,sections:anonymous?[]:[{field:'name',items:['QA Applicant One']}]});
  const slide=(roundId,evidence,anonymous=false)=>({...display(roundId,anonymous),...evidence,requestedFields:[...display(roundId,anonymous).visible,...(evidence.interviewScore?['interviewScore']:[]),...(evidence.finalInterviewThoughts?['finalInterviewThoughts']:[])]});
  const review=slide(f.review,await f.voting(f.ids.owner,f.review));
  await seedInterviews(f);
  const r2=slide(f.r2,await f.voting(f.ids.owner,f.r2)),peer=slide(f.r2,await f.voting(f.ids.peer,f.r2));
  await f.db.query(`UPDATE "PipelineRound" SET "anonymousReview"=true WHERE id=$1`,[f.r2]);
  const anonymous=slide(f.r2,await f.voting(f.ids.owner,f.r2),true);
  return {ids:{app:f.ids.app,review:f.review,r1:f.r1,r2:f.r2},review,r2,peer,anonymous};
 }finally{await f.db.close()}
}

test('round-scoped review: ranking, score, feedback, earlier rounds, identity and target counts stay with their round',{timeout:240000},async()=>{
 const data=await payloads();
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{RankedReviewList}from'@/components/ranked-review-list';import{RoomPresentation}from'@/components/live-voting/room-presentation';import{roundTargetSummary}from'@/lib/voting-target-summary';
 const D=window.__data,club='00000000-0000-4000-8000-000000000009',cycle='00000000-0000-4000-8000-000000000077';
 const row=(id,roundId,first,average)=>({id,roundId,status:'INTERVIEWING',studentId:'student-'+id,recruitmentCycleId:cycle,student:{email:'',studentProfile:{firstName:first,lastName:'',headshotUrl:null}},roundScore:average===null?{average:null,submitted:0,required:2,provisional:true}:{average,submitted:2,required:2,provisional:false}});
 const rows={[D.ids.r2]:[row(D.ids.app,D.ids.r2,'QA Applicant One',8),row('00000000-0000-4000-8000-000000000102',D.ids.r2,'QA Applicant Two',7.5)],[D.ids.r1]:[row('00000000-0000-4000-8000-000000000201',D.ids.r1,'Interview One Only',6)]};
 window.__gates={};window.__reads=[];
 const gate=key=>window.__gates[key]?window.__gates[key].promise:Promise.resolve();
 window.__block=key=>{let release;const promise=new Promise(r=>release=r);window.__gates[key]={promise,release:()=>{delete window.__gates[key];release()}}};
 window.__release=key=>window.__gates[key]?.release();
 const api={loadRound:async roundId=>{window.__reads.push(roundId);await gate('round:'+roundId);return{rounds:[],genderCounts:null,applications:structuredClone(rows[roundId])}},
  loadSettings:async roundId=>({roundId,cycles:[{id:cycle,name:'Fall'}],canManage:false,scopes:{[cycle]:{bands:{green:{start:1,end:1},yellow:{start:2,end:2},red:{start:3}},revision:1}}}),saveBands:async()=>{throw Error('read only')},
  loadRoundSummary:async({roundId})=>({...roundTargetSummary({round:{name:roundId===D.ids.r2?'Interview 2':'Interview 1',final:roundId===D.ids.r2},sessions:[{id:'s-'+roundId,createdAt:'2026-11-01',revision:1,targetSize:roundId===D.ids.r2?1:2,outcomes:roundId===D.ids.r2?[{applicationId:'x',outcome:'ACCEPT'},{applicationId:'y',outcome:'HOLD'}]:[{applicationId:'z',outcome:'REJECT'}]}]}),sessions:1,partial:false})};
 function Host(){const[open,setOpen]=React.useState(null);window.__openSession=s=>setOpen(o=>({...(o||{applicationId:D.ids.app}),sessionId:s}));
  return <main className="p-4 space-y-6"><RankedReviewList clubId={club} rounds={[{id:D.ids.r1,name:'Interview 1',anonymousReview:false},{id:D.ids.r2,name:'Interview 2',anonymousReview:false}]} initialRoundId={D.ids.r2} api={api} onOpen={id=>setOpen({applicationId:id,sessionId:'session-r2'})}/>
   {open&&<section aria-label="Voting slide">{<RoomPresentation clubId={club} sessionId={open.sessionId} applicationId={open.applicationId} identity="viewer" refreshKey={0}/>}</section>}</main>}
 createRoot(document.getElementById('root')).render(<Host/>);`,{
  '@/lib/voting-room-api':`exports.getLiveVotingPresentation=async input=>{window.__presentReads=[...(window.__presentReads||[]),input.sessionId];const g=window.__gates['present:'+input.sessionId];if(g)await g.promise;return structuredClone(window.__data.slides[input.sessionId]);};`,
 });
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-round-scoped-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true});
 const css=['components/applicant-identity.css','components/ranked-review-list.css','components/voting-target-summary.css','components/live-voting/room.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
 const slides={'session-r2':data.r2,'session-review':data.review,'session-peer':data.peer,'session-anon':data.anonymous};
 const html=`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Round-scoped review fixture</title><link rel="stylesheet" href="/style.css"><div id="root"></div><script>window.__data=${JSON.stringify({ids:data.ids,slides}).replace(/</g,'\\u003c')}</script><script src="/app.js"></script>`;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?fs.readFileSync(path.join(tmp,'style.css'),'utf8')+css:html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  const page=await (await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await page.goto(base);await page.getByRole('heading',{name:/Ranked applicants/}).waitFor();
  // Ranking: Interview 2 scores only (8.0 before 7.5), labelled bands; target and Pass meaning for the final round.
  const names=()=>page.locator('.oc-ranked-list .oc-applicant-identity-name').allInnerTexts();
  assert.deepEqual(await names(),['QA Applicant One','QA Applicant Two']);
  assert.match(await page.locator('.oc-ranked-row',{hasText:'QA Applicant One'}).innerText(),/8\.0[\s\S]*2 scored evaluations/);
  const summary=page.getByRole('region',{name:'Round target and counts'});await summary.getByText('Decisions · Entire round',{exact:false}).waitFor();
  assert.match(await summary.innerText(),/Final class-size target\s*1/);assert.match(await summary.innerText(),/Pass means a final acceptance recommendation\./);
  assert.match(await summary.innerText(),/Pass\s*1[\s\S]*Hold\s*1/);
  // Slide for the selected applicant: identity, this round's score and feedback first, then the labelled earlier round.
  await page.locator('.oc-ranked-row',{hasText:'QA Applicant One'}).locator('.oc-ranked-open').click();
  const slide=page.getByRole('region',{name:'Voting slide'});await slide.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();
  const score=slide.locator('[data-slide-field="interviewScore"]');
  assert.match(await score.innerText(),/Average interview score\s*8\.0 \/ 10 · 2 scored evaluations\s*Interview 2/);
  const feedback=slide.locator('[data-slide-field="interviewFeedback"]');assert.match(await feedback.innerText(),/Interview feedback · Interview 2[\s\S]*Avery Panel[\s\S]*Blake Peer/);
  const earlier=slide.locator('[data-slide-field="earlierRounds"]');assert.equal(await earlier.innerText(),'Earlier rounds · Interview 1 7.0 / 10');
  assert.doesNotMatch(await feedback.innerText(),/R1 AVERY|Lee Late/,'earlier evidence never mixed into the current section');
  const order=await slide.locator('[data-slide-field]').evaluateAll(els=>els.map(e=>e.dataset.slideField));
  assert.ok(order.indexOf('earlierRounds')===order.indexOf('interviewScore')+1&&order.indexOf('interviewFeedback')>order.indexOf('interviewScore'),order.join());
  await score.getByRole('button',{name:'Read full average interview score'}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();const details=await dialog.innerText();
  assert.match(details,/Avery Panel · Interview 1 · Interview kit\s*8 \/ 10\s*R1 AVERY summary\./);assert.match(details,/Lee Late · Interview 1 · Evaluation\s*6 \/ 10/);
  assert.doesNotMatch(details,/DRAFT SECRET|PRIVATE/);
  const a11y=await new AxeBuilder({page}).include('[role="dialog"]').withTags(['wcag2a','wcag2aa']).analyze();assert.deepEqual(a11y.violations.map(v=>v.id),[]);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Read full average interview score','focus returns to the opener');
  // Out-of-order: Interview 2 blocked, switch to Interview 2 then Interview 1; the late Interview 2 reply never replaces Interview 1.
  await page.getByRole('combobox',{name:'Ranked round'}).click();await page.getByRole('option',{name:'Interview 1',exact:true}).click();await page.getByText('Interview One Only').waitFor();
  assert.equal(await page.locator('.oc-ranked-row',{hasText:'QA Applicant One'}).count(),0,'no applicant from Interview 2');
  await page.evaluate(id=>window.__block('round:'+id),data.ids.r2);
  await page.getByRole('combobox',{name:'Ranked round'}).click();await page.getByRole('option',{name:'Interview 2',exact:true}).click();
  await page.getByText('Loading ranking…').waitFor();assert.equal(await page.getByText('Interview One Only').count(),0,'previous round never shown under the new round');
  await page.getByRole('combobox',{name:'Ranked round'}).click();await page.getByRole('option',{name:'Interview 1',exact:true}).click();await page.getByText('Interview One Only').waitFor();
  await page.evaluate(id=>window.__release('round:'+id),data.ids.r2);await page.waitForTimeout(200);
  assert.deepEqual(await names(),['Interview One Only'],'stale response ignored');
  assert.equal(await page.locator('[aria-current="true"]').count(),0,'selection does not carry into another round');
  const s1=await summary.innerText();assert.match(s1,/Advancement target for Interview 1\s*2/);assert.match(s1,/Pass means advance to a later round\./);assert.doesNotMatch(s1,/Hold\s*1/);
  // Reopening a saved session in another round with the same applicant: never the other session's slide, and a late reply is ignored.
  await page.evaluate(()=>{window.__block('present:session-r2');window.__block('present:session-review');});
  await page.evaluate(()=>window.__openSession('session-review'));
  await slide.getByText('Loading applicant presentation…').waitFor();assert.doesNotMatch(await slide.innerText(),/8\.0|Interview 2|Avery/);
  await page.evaluate(()=>window.__release('present:session-r2'));await page.waitForTimeout(200);assert.doesNotMatch(await slide.innerText(),/8\.0|Avery/);
  await page.evaluate(()=>window.__release('present:session-review'));
  await slide.getByText('No interview scores for this round.').waitFor();
  const reviewText=await slide.innerText();assert.match(reviewText,/Average interview score\s*No interview scores for this round\.\s*Application review/);
  assert.doesNotMatch(reviewText,/0\.0|\b0 \/ 10|Earlier rounds|Interview feedback|Submitted final interview thoughts/);
  // Restricted reviewer: no earlier rounds and no individual scores; anonymous round: no identity and no interview evidence.
  await page.evaluate(()=>window.__openSession('session-peer'));await slide.locator('[data-slide-field="interviewFeedback"]').waitFor();
  const peer=await slide.innerText();assert.doesNotMatch(peer,/Earlier rounds|R1 AVERY|\b9 \/ 10|\b7 \/ 10/);assert.match(peer,/8\.0 \/ 10/);
  await page.evaluate(()=>window.__openSession('session-anon'));await slide.locator('.oc-applicant-identity').first().waitFor();
  await page.waitForFunction(()=>!document.querySelector('[aria-label="Voting slide"] [data-slide-field="interviewFeedback"]'));
  const anon=await slide.innerText();assert.doesNotMatch(anon,/QA Applicant One|Avery|Blake|Earlier rounds|Interview 1|8\.0/);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on a phone');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
});
