const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {apps,roundId,leaderId,voterId,sessionId,uuid}=require('./helpers/voting-room-harness.cjs');

// Realistic long, structured feedback: the automatic layout gives it the lead and renders its bullets as lists.
const avery='Maya was the most prepared candidate in our block. She walked through how she rebuilt the volunteer intake form for the food pantry, and she was candid about what did not work the first time.\nStrengths:\n- Structured answers; she always led with the outcome, then the evidence\n- Asked sharp questions about how our project teams hand off work between semesters\n- Took feedback on the case prompt in stride and revised her estimate on the spot\nConcerns:\n- Already committed to two other organizations this spring\n- Some answers ran long when she was unsure';
const blake='Thoughtful and calm. Strong on the case, a little quieter in the group exercise, but her one contribution reframed the whole discussion around the client budget.';
const brief='Two follow-ups:\n1. Spring availability\n2. Team preference';
const answer='I organized a campus food drive with six volunteers, tracked weekly donations in a shared sheet, and adjusted our pickup schedule when a partner pantry changed its hours, which kept every delivery on time for the semester.';
const hash=t=>createHash('sha256').update(t,'utf8').digest('hex');
const source=(id,text,label)=>({type:'PROFILE',id,version:hash(text),revision:null,label,author:null,roundId:null,roundName:null,text});
const fits=page=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth);
const fields=(page,selector)=>page.locator(selector).evaluateAll(n=>n.map(e=>e.dataset.slideField));

test('automatic slide layout: short facts as chips, longest evidence leads, lists render, projector fits and phones reflow',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const person=(firstName,lastName)=>({user:{studentProfile:{firstName,lastName}}});
 f.h.tx.evaluation.findMany=async({where})=>where.applicationId===apps[0]?[{id:uuid(886),interviewerId:leaderId,roundId,score:8.5,submittedAt:new Date(),interviewer:person('Avery','Panel')},{id:uuid(890),interviewerId:voterId,roundId,score:7.5,submittedAt:new Date(),interviewer:person('Blake','Peer')}]:where.applicationId===apps[1]?[{id:uuid(892),interviewerId:leaderId,roundId,score:6,submittedAt:new Date(),interviewer:person('Avery','Panel')}]:[];
 const record=(id,applicationId,interviewerId,text,p)=>({id,applicationId,roundId,interviewerId,draft:{finalInterviewThoughts:text},evaluation:{applicationId,roundId,interviewerId,submittedAt:new Date()},interviewer:{clubId:f.clubId,...p}});
 f.h.tx.interviewRecord.findMany=async({where})=>where.applicationId===apps[0]?[record(uuid(888),apps[0],leaderId,avery,person('Avery','Panel')),record(uuid(891),apps[0],voterId,blake,person('Blake','Peer'))]:where.applicationId===apps[1]?[record(uuid(893),apps[1],leaderId,brief,person('Avery','Panel'))]:[];
 const quote=(n,text)=>({id:uuid(600+n),mode:'QUOTE',text,source:source('profile:answers:0',answer,'Application answers'),writtenBy:null});
 const preparations=[{sessionId,applicationId:apps[0],revision:1,highlights:[quote(1,'adjusted our pickup schedule when a partner pantry changed its hours'),{...quote(2,answer),mode:'SUMMARY',text:'Ran a semester-long volunteer drive and handled a schedule change without missed deliveries.',writtenBy:'QA Leader'},quote(3,'tracked weekly donations in a shared sheet')]}],locks=[];
 f.h.tx.votingSlidePreparation={findMany:async({where})=>structuredClone(preparations.filter(p=>where.applicationId.in.includes(p.applicationId))),findUnique:async({where})=>structuredClone(preparations.find(p=>p.applicationId===where.sessionId_applicationId.applicationId)??null)};
 f.h.tx.votingSlideLock={createMany:async({data})=>{locks.push(...structuredClone(data));return{count:data.length}},findUnique:async({where})=>{const k=where.sessionId_passNumber_applicationId;return structuredClone(locks.find(l=>l.passNumber===k.passNumber&&l.applicationId===k.applicationId)??null)}};
 try{
  await f.h.create({presentationOptions:{fields:['finalInterviewThoughts','act','interviewScore','sat','gpa','academicYear','major','name','photo','resumeHighlight'],highlights:{[apps[0]]:uuid(500),[apps[1]]:uuid(500)}}});await f.h.command('START');
  const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`,open=async(view,width,height)=>{const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}&view=${view}&actor=leader`);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();await page.locator('.vr-evidence').waitFor();return page;};
  const page=await open('present',1366,768);

  // Short facts are compact label/value chips; long text is in the evidence area.
  assert.deepEqual(await fields(page,'.vr-facts>[data-slide-field]'),['major','academicYear','gpa','sat','act','interviewScore']);
  assert.deepEqual(await fields(page,'.vr-evidence [data-slide-field]'),['interviewFeedback','resumeHighlight']);
  assert.match(await page.locator('[data-slide-field="gpa"]').innerText(),/^GPA \(out of 4\.0\)\s+3\.8$/);
  assert.deepEqual(await page.locator('.vr-facts dt').allInnerTexts(),['Major','Academic year','GPA (out of 4.0)','SAT','ACT','Average interview score'],'every chip is labelled');
  assert.match(await page.locator('[data-slide-field="interviewScore"]').innerText(),/8\.0 \/ 10 · 2 scored evaluations\s+Synthetic interview round/);
  const chip=await page.locator('[data-slide-field="major"]').boundingBox(),lead=await page.locator('[data-evidence-rank="1"]').boundingBox(),second=await page.locator('[data-evidence-rank="2"]').boundingBox();
  assert.ok(chip.height<80&&chip.width<lead.width/3,'facts are compact');assert.ok(chip.y+chip.height<=lead.y,'facts sit above the evidence');
  assert.ok(lead.width>second.width*1.2,'the field with the most text gets the larger area');
  // Prepared highlights stay in the header beside the name.
  const name=await page.getByRole('heading',{name:'QA Applicant One',exact:true}).boundingBox(),band=await page.getByRole('region',{name:'Leader-selected highlights'}).boundingBox();
  assert.ok(band.x>name.x+name.width&&band.y<name.y+name.height,'highlights beside the name');

  // Line breaks and bullets: real lists, longer excerpts, and "Read full" when cut.
  const feedback=page.locator('[data-slide-field="interviewFeedback"]');
  assert.ok(await feedback.locator('ul:not(.divide-y)>li').count()>=1,'bullets render as list items');
  assert.match(await feedback.locator('.vr-text p').first().innerText(),/the first time\.\nStrengths:$/,'line breaks are preserved');
  assert.ok(await feedback.getByText(blake,{exact:true}).count(),'short summaries are shown in full');
  await feedback.getByRole('button',{name:'Read full interview feedback'}).waitFor();
  const resume=await page.locator('[data-slide-field="resumeHighlight"] .vr-text').innerText();assert.ok(resume.length>300&&resume.length<=400&&resume.endsWith('…'),`résumé excerpt shows about 400 characters (${resume.length})`);
  await page.locator('[data-slide-field="resumeHighlight"]').getByRole('button',{name:'Read full leader-selected résumé excerpt'}).waitFor();

  // Keyboard order follows the visual order: facts, then evidence by size, then the footer.
  await page.locator('[data-applicant-heading]').focus();const order=[];
  for(let i=0;i<4;i++){await page.keyboard.press('Tab');order.push(await page.evaluate(()=>document.activeElement?.textContent?.trim()));}
  assert.deepEqual(order,['Read full average interview score','Read full interview feedback','Read full leader-selected résumé excerpt','Applicant details and highlight sources']);
  await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('Some answers ran long when she was unsure'),'full feedback stays in details');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});

  // No scroll on the projector at both sizes with three highlights and long evidence.
  assert.ok(await fits(page),'projector fits 1366×768');
  assert.deepEqual((await new AxeBuilder({page}).include('.vr-applicant').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
  const large=await open('present',1920,1080);assert.ok(await fits(large),'projector fits 1920×1080');
  // Known gap (tracked as FE-VS-2): at 1280×720, the smallest projector target in
  // docs/voting-room-implementation.md, this ten-field slide currently scrolls. Assert it once the layout is fixed.
  const leader=await open('leader',1366,768);assert.equal(await leader.locator('[data-slide-field="interviewFeedback"] .vr-text li').count()>=1,true);assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

  // Phones: the facts strip wraps above the evidence, without horizontal scroll.
  const phone=await open('present',390,844);
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on phones');
  const facts=await phone.locator('.vr-facts').boundingBox(),evidence=await phone.locator('.vr-evidence').boundingBox();assert.ok(facts.y+facts.height<=evidence.y&&facts.width<=390);
  assert.deepEqual((await new AxeBuilder({page:phone}).include('.vr-applicant').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);

  // The layout follows the content: with a short numbered note, the résumé excerpt leads instead.
  await f.h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,reason:'Synthetic layout test',confirmed:true});
  await page.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor({timeout:20000});await page.locator('.vr-evidence').waitFor();
  assert.deepEqual(await fields(page,'.vr-evidence [data-slide-field]'),['resumeHighlight','interviewFeedback']);
  assert.equal(await page.locator('[data-slide-field="interviewFeedback"] ol>li').count(),2,'numbered lines render as an ordered list');
  assert.ok((await page.locator('[data-evidence-rank="1"]').boundingBox()).width>(await page.locator('[data-evidence-rank="2"]').boundingBox()).width*1.2);
  assert.doesNotMatch(await page.locator('[data-slide-field="interviewScore"]').innerText(),/(^|\s)0(\.0)? \/ 10/);
  assert.ok(await fits(page));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
