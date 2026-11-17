// Live voting room redesign in a real browser: the audience slide fits one screen with long notes (no scroll, no
// clipping, nothing behind a details button), the closed breakdown stays hidden while voting is open, the round
// tracker, the light/dark switch, and the leader screen at tablet and phone widths.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {apps,roundId,leaderId,voterId,sessionId,uuid}=require('./helpers/voting-room-harness.cjs');

const quote='Built a scheduling tool for the Engineering Student Council used by 40 student groups; summer analyst at a regional transit authority. '.repeat(7)+'End of excerpt.';
const thought=n=>`Final thought ${n}: `+'She led with the outcome, then the evidence, and revised her estimate when challenged. '.repeat(5)+`End ${n}.`;
const person=(firstName,lastName)=>({user:{studentProfile:{firstName,lastName}}});
const fitsInBoxes=page=>page.evaluate(()=>{
 const boxes=[...document.querySelectorAll('.vr-aud [data-fit-box]')];
 return {page:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth,boxes:boxes.length,clipped:boxes.filter(b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1).map(b=>b.className),
  slide:(()=>{const r=document.querySelector('.vr-aud-slide').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.right<=innerWidth+1;})()};
});

test('audience slide: long notes fit one screen at 1920×1080 and 1280×720; open hides the breakdown; close shows it; theme switch',{timeout:240000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 f.h.tx.interviewResumeAnnotation={findMany:async()=>[{id:uuid(500),document:{id:uuid(501),roundId},anchor:{page:2,quote}}]};
 f.h.tx.evaluation.findMany=async({where})=>where.applicationId===apps[0]?[{id:uuid(886),interviewerId:leaderId,roundId,score:8.5,submittedAt:new Date(),interviewer:person('Avery','Panel')},{id:uuid(890),interviewerId:voterId,roundId,score:8,submittedAt:new Date(),interviewer:person('Blake','Peer')}]:[];
 const record=(id,interviewerId,text)=>({id,applicationId:apps[0],roundId,interviewerId,draft:{finalInterviewThoughts:text},evaluation:{applicationId:apps[0],roundId,interviewerId,submittedAt:new Date()},interviewer:{clubId:f.clubId,...person('Avery','Panel')}});
 f.h.tx.interviewRecord.findMany=async({where})=>where.applicationId===apps[0]?[record(uuid(888),leaderId,thought(1)+'\n'+thought(2)),record(uuid(891),voterId,thought(3)+'\n'+thought(4))]:[];
 f.h.state().apps[0].student.studentProfile.scholarStatus={selections:['ECHOLS'],other:''};
 try{
  await f.h.create({targetSize:2,presentationOptions:{fields:['photo','name','major','academicYear','scholarStatus','interviewScore','sat','act','gpa','resumeHighlight','finalInterviewThoughts'],highlights:{[apps[0]]:uuid(500)}}});
  await f.h.command('START');await f.h.command('OPEN_VOTING');
  const url=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=present&actor=leader`;
  const open=async(width,height,init)=>{const context=await browser.newContext({viewport:{width,height}});if(init)await context.addInitScript(init);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();await page.locator('.vr-slide-ready').waitFor();await page.waitForTimeout(300);return page;};
  for(const [w,h] of [[1920,1080],[1280,720]]){
   const page=await open(w,h);
   const fit=await fitsInBoxes(page);
   assert.ok(fit.page&&fit.slide,`no page scroll at ${w}×${h}`);assert.ok(fit.boxes>=3);assert.deepEqual(fit.clipped,[],`nothing clipped at ${w}×${h}`);
   assert.ok(Number(await page.locator('.vr-aud-applicant').getAttribute('data-fit-step'))>0,'long notes stepped the text down');
   // Every enabled field in full: the whole excerpt and every thought are on the slide; no details dialog or Read full.
   const text=await page.locator('.vr-aud-applicant').innerText();
   assert.ok(text.includes('End of excerpt.')&&text.includes('End 4.'),'full text on the slide');
   assert.match(text,/Echols Scholars Program/);
   assert.equal(await page.getByRole('button',{name:/Applicant details|Read full/}).count(),0);
   // Open: only the vote count; no breakdown, no result.
   assert.match(await page.locator('.vr-aud-footer').innerText(),/Voting open · vote on your phone\s+0 of 2 in the room voted/);
   assert.equal(await page.getByRole('list',{name:'Closed ballot totals'}).count()+await page.locator('.vr-aud-result').count(),0);
   assert.equal(await page.locator('.vr-aud-footer [aria-live=polite]').count(),1);
   // Round tracker: four counts, the target marker, and the position.
   assert.deepEqual(await page.locator('.vr-tracker-counts dt').allInnerTexts(),['passed','did not pass','held','to go']);
   assert.equal(await page.locator('.vr-tracker-marker').count(),1);
   assert.match(await page.locator('.vr-tracker-meta').innerText(),/Applicant 1 of 3 · Target 2 to pass/);
   // The join QR is the branded OutClass code with its link written out.
   assert.equal(await page.getByRole('img',{name:'QR code to join this voting session'}).count()+await page.locator('.vr-aud-qr svg').count()>0,true);
   await page.context().close();
  }

  // Theme: dark by default; Light switches to the cream tokens and is remembered on this device.
  const page=await open(1600,900);
  const bg=()=>page.locator('.vr-aud').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(await page.locator('.vr-aud').getAttribute('data-theme'),'present');assert.equal(await bg(),'rgb(15, 28, 43)');
  await page.locator('.vr-aud').hover();await page.getByRole('group',{name:'Slide theme'}).getByRole('button',{name:'Light'}).click();
  assert.equal(await page.locator('.vr-aud').getAttribute('data-theme'),'present-light');assert.equal(await bg(),'rgb(246, 245, 241)');
  await page.reload();await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();assert.equal(await page.locator('.vr-aud').getAttribute('data-theme'),'present-light');
  // The theme switch stays out of sight on the projector until hovered or focused.
  await page.mouse.move(0,0);await page.locator('.vr-aud-footer').hover({position:{x:1,y:1}});
  await page.context().close();

  // Blocked storage: the slide renders (dark) and the switch still works for this page.
  const blocked=await open(1600,900,()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});});
  assert.equal(await blocked.locator('.vr-aud').getAttribute('data-theme'),'present');
  await blocked.locator('.vr-aud').hover();await blocked.getByRole('group',{name:'Slide theme'}).getByRole('button',{name:'Light'}).click();
  assert.equal(await blocked.locator('.vr-aud').getAttribute('data-theme'),'present-light');
  await blocked.context().close();

  // Reduced motion: the meter and theme switch do not animate.
  const reduced=await browser.newContext({viewport:{width:1600,height:900},reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto(url);await rp.locator('.vr-slide-ready').waitFor();
  assert.ok(parseFloat(await rp.locator('.vr-aud-theme').evaluate(e=>getComputedStyle(e).transitionDuration))<0.01,'no theme fade');await reduced.close();

  // Close: the result, the three totals and the rule; the footer names the next applicant. Never names a voter.
  const closed=await open(1920,1080);
  await f.h.command('CLOSE_VOTING');
  await closed.getByRole('list',{name:'Closed ballot totals'}).or(closed.locator('dl[aria-label="Closed ballot totals"]')).first().waitFor({timeout:15000});
  const result=await closed.locator('.vr-aud-result').innerText();
  assert.match(result,/Result\s+Vote closed/);assert.match(result,/Pass\s+0\s+Hold\s+0\s+Do not pass\s+0/);assert.match(result,/0 of 2 in the room voted · /);
  assert.doesNotMatch(result,/QA voter/);
  assert.match(await closed.locator('.vr-aud-footer').innerText(),/Vote closed · next: QA applicant 2\s+Applicant 1 of 3/);
  const fit=await fitsInBoxes(closed);assert.ok(fit.page);assert.deepEqual(fit.clipped,[]);
  await closed.context().close();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});

test('leader screen: tablet and phone widths, 44px targets, Close vote primary, round progress and queue',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 try{
  await f.h.create({targetSize:1,presentationOptions:{fields:['name','major','gpa'],highlights:{}}});await f.h.command('START');await f.h.command('OPEN_VOTING');
  const url=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=leader&actor=leader`;
  for(const [w,h] of [[1440,1000],[820,1180],[390,844]]){
   const context=await browser.newContext({viewport:{width:w,height:h}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();await page.locator('.vr-slide-ready').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal scroll at ${w}`);
   assert.equal(await page.locator('h1').count(),1,'one page title');
   const close=page.getByRole('button',{name:'Close vote',exact:true});await close.waitFor();
   const small=await page.locator('.vr-lead-page [data-button]:visible').evaluateAll(n=>n.filter(e=>e.getBoundingClientRect().height<44).map(e=>e.textContent));
   assert.deepEqual(small,[],`44px targets at ${w}`);
   for(const name of ['Round progress','In the room','Applicants'])await page.getByRole('heading',{name,exact:true}).waitFor();
   assert.match(await page.locator('.vr-lead-queue').innerText(),/1 · QA applicant 1\s+Voting now\s+2 · QA applicant 2\s+Up next/);
   assert.match(await page.locator('.vr-lead-status').innerText(),/Voting open\s+0 of 2 in the room voted/);
   assert.equal(await page.getByRole('button',{name:'Next: QA applicant 2'}).isDisabled(),true,'Next waits for a decision');
   for(const name of ['Show on projector','Vote on my phone'])await page.getByRole('link',{name,exact:true}).waitFor();
   // Keyboard: Close vote has a visible focus ring.
   await close.focus();assert.notEqual(await close.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});
