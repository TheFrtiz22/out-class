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

test('projector slide layout: facts, every note in full, lists render, fits every projector size and phones reflow',{timeout:180000},async()=>{
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
  const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`,open=async(view,width,height)=>{const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}&view=${view}&actor=leader`);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();await page.locator(view==='present'?'.vr-aud-applicant':'.vr-lead-applicant').waitFor();await page.locator('.vr-slide-ready').waitFor();return page;};
  const page=await open('present',1366,768);
  const noClip=p=>p.evaluate(()=>[...document.querySelectorAll('.vr-aud [data-fit-box]')].filter(b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1).length);

  // Facts are the numbers; every note is shown in full, in reading order, in two columns.
  assert.deepEqual(await fields(page,'.vr-aud-facts>[data-slide-field]'),['interviewScore','sat','act','gpa']);
  assert.deepEqual(await fields(page,'.vr-aud-profile [data-slide-field]'),['major','academicYear']);
  assert.deepEqual(await fields(page,'.vr-aud-notes [data-slide-field]'),['finalInterviewThoughts','resumeHighlight','preparedHighlights']);
  assert.match(await page.locator('[data-slide-field="gpa"]').innerText(),/^GPA\s+3\.8$/);
  assert.match(await page.locator('[data-slide-field="interviewScore"]').innerText(),/8\.0 \/ 10\s+Average of 2 scored evaluations/);
  // Line breaks and bullets: real lists, the whole text, nothing behind "Read full".
  const thoughts=page.locator('[data-slide-field="finalInterviewThoughts"]');
  assert.ok(await thoughts.locator('ul>li').count()>=3,'bullets render as list items');
  assert.ok((await thoughts.innerText()).includes('Some answers ran long when she was unsure'),'the full feedback is on the slide');
  assert.ok((await thoughts.innerText()).includes(blake));
  assert.ok((await page.locator('[data-slide-field="resumeHighlight"]').innerText()).includes('End of preserved excerpt.'),'the whole excerpt');
  // Prepared highlights are shown in full with their attribution.
  const prepared=await page.locator('[data-slide-field="preparedHighlights"]').innerText();
  assert.match(prepared,/adjusted our pickup schedule/);assert.match(prepared,/Leader summary: Ran a semester-long volunteer drive/);assert.match(prepared,/Application \/ profile/);
  assert.equal(await page.getByRole('button',{name:/Read full|Applicant details/}).count(),0);

  // No scroll and nothing clipped on the projector at every size.
  for(const [p,size] of [[page,'1366×768'],[await open('present',1920,1080),'1920×1080'],[await open('present',1280,720),'1280×720']]){assert.ok(await fits(p),`projector fits ${size}`);assert.equal(await noClip(p),0,`nothing clipped at ${size}`);}
  assert.deepEqual((await new AxeBuilder({page}).include('.vr-aud-applicant').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
  // The leader's condensed column shows the same lists.
  const leader=await open('leader',1366,768);assert.equal(await leader.locator('[data-slide-field="finalInterviewThoughts"] .vr-text li').count()>=1,true);assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

  // Phones (not a projector target) never scroll sideways.
  const phone=await open('present',390,844);
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on phones');

  // The next applicant: a numbered note renders as an ordered list, and no score is never "0 / 10".
  await f.h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,reason:'Synthetic layout test',confirmed:true});
  await page.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor({timeout:20000});await page.locator('.vr-slide-ready').waitFor();
  assert.equal(await page.locator('[data-slide-field="finalInterviewThoughts"] ol>li').count(),2,'numbered lines render as an ordered list');
  assert.doesNotMatch(await page.locator('[data-slide-field="interviewScore"]').innerText(),/(^|\s)0(\.0)? \/ 10/);
  assert.ok(await fits(page));assert.equal(await noClip(page),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
