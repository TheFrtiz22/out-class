// Loopback UI fixture: synthetic identities and in-memory Prisma doubles only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {clubId}=require('./helpers/voting-room-harness.cjs');
const current=async page=>(await page.getByRole('navigation',{name:'Setup steps'}).locator('[aria-current="step"]').innerText()).replace(/^\S+\s*/,'').trim();
/** Waits for the stepper to mark `name` as the current step. */
const onStep=(page,name)=>page.getByRole('navigation',{name:'Setup steps'}).locator('[aria-current="step"]',{hasText:name}).waitFor({timeout:5000});
const stepButton=(page,name)=>page.getByRole('navigation',{name:'Setup steps'}).getByRole('button',{name:new RegExp(name)});

test('a future step runs the same checks as Continue; going back is always allowed',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
  assert.equal(await current(page),'Session details');
  // Step 1 invalid: scheduled with no date. Jumping to step 3 is refused with Continue's message, beside the control.
  await page.getByRole('radio',{name:'Schedule for later',exact:true}).check();
  await stepButton(page,'Presentation and review').click();
  const alert=page.getByRole('alert').filter({hasText:'Choose a date and start time.'});await alert.waitFor();
  assert.equal(await current(page),'Session details');
  const described=await page.getByRole('textbox',{name:'Date and start time'}).getAttribute('aria-describedby');assert.equal(described,await alert.getAttribute('id'));
  const viaStep=await alert.innerText();await page.getByRole('textbox',{name:'Date and start time'}).fill('');
  await page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await page.getByRole('alert').filter({hasText:'Choose a date and start time.'}).innerText(),viaStep);
  assert.equal(await current(page),'Session details');
  // Valid step 1, invalid step 2 (no voters): a jump to step 3 stops on step 2 with that step's message.
  await page.getByRole('radio',{name:'Start now',exact:true}).check();
  await stepButton(page,'Applicants and voters').click();await onStep(page,'Applicants and voters');
  await page.getByRole('button',{name:'Clear voters',exact:true}).click();
  await stepButton(page,'Presentation and review').click();await page.getByRole('alert').filter({hasText:'Select at least one voter.'}).waitFor();
  assert.equal(await current(page),'Applicants and voters');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Select at least one voter.'}).waitFor();
  await stepButton(page,'Session details').click();await onStep(page,'Session details');
  await stepButton(page,'Presentation and review').click();await page.getByRole('alert').filter({hasText:'Select at least one voter.'}).waitFor();assert.equal(await current(page),'Applicants and voters');
  await page.getByRole('button',{name:'Select all voters',exact:true}).click();await stepButton(page,'Presentation and review').click();await onStep(page,'Presentation and review');
  assert.equal(f.h.state().sessions.length,0,'a step click never creates a session');assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('a presentation switch updates the room preview and the review Shown row at once',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const calls=[];await page.route('**/action',async route=>{calls.push(route.request().postDataJSON()?.name);await route.continue();});
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const preview=page.getByRole('complementary',{name:'Voting room preview'}),slide=preview.getByRole('region',{name:'Current applicant presentation'}),shown=page.getByRole('region',{name:'Session review'}).locator('div').filter({hasText:/^Shown/});
  await slide.waitFor();await page.waitForLoadState('networkidle');
  const major=page.getByRole('switch',{name:'Major',exact:true});assert.equal(await major.getAttribute('aria-checked'),'false');
  assert.equal(await slide.locator('[data-slide-field="major"]').count(),0);assert.doesNotMatch(await shown.innerText(),/Major/);
  await major.click();assert.equal(await major.getAttribute('aria-checked'),'true');
  await slide.locator('[data-slide-field="major"]').waitFor({timeout:1000});
  assert.match(await shown.innerText(),/Major/);
  assert.match(await preview.innerText(),/1 of \d+/,'the preview shows the applicant position');
  await major.press('Space');await slide.locator('[data-slide-field="major"]').waitFor({state:'detached',timeout:1000});assert.doesNotMatch(await shown.innerText(),/Major/);
  assert.equal(calls.filter(n=>n==='createLiveVotingRoom'||n==='updateVotingSessionSetup').length,0,'switching saves nothing');
  const dir=path.resolve('test-results/voting-setup-polish');fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'step3-1280.png'),fullPage:true});assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('inside the focus frame: no Back to Voting room links, save status beside Exit, and Exit keeps the draft',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader&frame=1');const name=page.getByRole('textbox',{name:'Session name',exact:true});await name.waitFor();
  for(const step of ['Session details','Applicants and voters','Presentation and review']){
   assert.equal(await page.getByRole('link',{name:/Back to Voting room/}).count(),0,step);
   assert.equal(await page.getByRole('link',{name:/Exit/}).count(),1,step);
   if(step!=='Presentation and review'){if(step==='Applicants and voters')await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  }
  const bar=page.getByRole('banner');await bar.getByRole('status').filter({hasText:/All changes saved|Unsaved changes|Saving draft…|Draft saved/}).waitFor();
  assert.equal(await page.getByRole('heading',{level:1}).count(),1);
  await stepButton(page,'Session details').click();await name.fill('Kept by Exit');
  const exit=page.getByRole('link',{name:/Exit/});const href=new URL(await exit.getAttribute('href'),'http://test');
  assert.equal(href.searchParams.get('decisionTab'),'voting');assert.equal(href.searchParams.get('tool'),'decisions');
  await exit.click();await page.waitForURL(/decisionTab=voting/);
  const saved=f.h.state().drafts.find(d=>d.key.startsWith(`voting-setup:${clubId}:`));assert.equal(saved?.content?.name,'Kept by Exit');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('screenshots: all three steps at 1280 and 390 wide, no horizontal overflow',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),dir=path.resolve('test-results/voting-setup-polish');fs.mkdirSync(dir,{recursive:true});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:width>500?900:844}});
   await page.goto(f.url+`/voting/rooms/new?actor=leader&frame=1&draft=00000000-0000-4000-8000-${String(width).padStart(12,'0')}`);await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
   await page.getByRole('radio',{name:'Schedule for later',exact:true}).check();
   for(const [i,step] of ['session-details','applicants-voters','presentation-review'].entries()){
    if(i===1)await page.getByRole('button',{name:'Select all voters',exact:true}).click();
    if(i===2){await page.getByRole('complementary',{name:'Voting room preview'}).getByRole('region',{name:'Current applicant presentation'}).waitFor();}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${step} at ${width}`);
    await page.screenshot({path:path.join(dir,`${i+1}-${step}-${width}.png`),fullPage:true});
    if(i===0){await page.getByRole('textbox',{name:'Date and start time'}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16));}
    if(i<2)await page.getByRole('button',{name:'Continue',exact:true}).click();
   }
   await page.close();
  }
 }finally{await browser.close();await f.close()}
});

// Recorded on origin/main a0d7225f (old markup) with the same inputs: the polish must save exactly this.
// The round is an interview round, so the interview score and final thoughts are shown by default.
const expectedPayload={"draft": {"version": 1, "cycle": "00000000-0000-4000-8000-000000000003", "round": "00000000-0000-4000-8000-000000000002", "name": "Payload check", "timing": "LATER", "localTime": "<v>", "timeZone": "America/New_York", "occurrence": "LATER", "duration": "45", "location": "https://example.test/room", "instructions": "Bring notes", "notify": true, "applicants": ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012"], "voters": ["00000000-0000-4000-8000-000000000005", "00000000-0000-4000-8000-000000000006"], "target": "2", "fields": ["name", "photo", "gpa", "interviewScore", "finalInterviewThoughts", "major", "sat"], "highlights": {}, "initialized": true, "sessionId": "<v>", "planRevision": null, "startRequestId": "<v>", "updateRequestId": "<v>", "leaderMemberIds": [], "rules": {"mode": "THRESHOLD", "numerator": "2", "denominator": "3", "base": "ELIGIBLE_VOTERS", "pNumerator": "1", "pDenominator": "2", "below": "HOLD", "reviewed": true}}, "session": {"presentationOptions": {"fields": ["name", "photo", "gpa", "interviewScore", "finalInterviewThoughts", "major", "sat"], "highlights": {}, "meeting": {"version": 1, "name": "Payload check", "timing": "LATER", "localTime": "<v>", "timeZone": "America/New_York", "occurrence": "LATER", "plannedAt": "<v>", "duration": 45, "location": "https://example.test/room", "instructions": "Bring notes", "status": "SCHEDULED", "announcedUserIds": ["00000000-0000-4000-8000-000000000005", "00000000-0000-4000-8000-000000000006"]}, "rules": {"mode": "THRESHOLD", "threshold": {"numerator": 2, "denominator": 3}, "denominator": "ELIGIBLE_VOTERS", "minimumParticipation": {"numerator": 1, "denominator": 2}, "belowThreshold": "HOLD", "reviewed": true}}, "displayConfig": {"version": 1, "fields": ["photo", "name", "major", "gpa", "sat"]}, "targetSize": 2, "candidates": ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012"], "participants": ["00000000-0000-4000-8000-000000000005", "00000000-0000-4000-8000-000000000006"], "leaderMemberIds": ["00000000-0000-4000-8000-000000000005"], "state": "DRAFT"}};
test('the same inputs save the same draft and session payload as before the polish',{timeout:150000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+30*86400000)).replace(' ','T').replace(/T\d\d:\d\d$/,'T18:00');
 // The date is relative so the schedule stays in the future; it is checked on its own below.
 const strip=v=>JSON.parse(JSON.stringify(v,(k,x)=>['id','sessionId','startRequestId','updateRequestId','requestId','createdAt','updatedAt','mutationId','plannedAt','localTime'].includes(k)?'<v>':x));
 try{
 await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Session name',exact:true}).fill('Payload check');
 await page.getByRole('radio',{name:'Schedule for later',exact:true}).check();
 await page.getByRole('textbox',{name:'Date and start time'}).fill(local);
 await page.getByRole('spinbutton',{name:'Expected duration in minutes'}).fill('45');
 await page.getByRole('combobox',{name:'Repeated time occurrence'}).selectOption('LATER');
 await page.getByRole('textbox',{name:'Location or meeting link'}).fill('https://example.test/room');
 await page.getByRole('textbox',{name:'Participant instructions'}).fill('Bring notes');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Select all voters',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Target number to pass',exact:true}).fill('2');
 const rule=page.getByRole('group',{name:'Voting rule'});await rule.getByRole('radio',{name:/Threshold decides/}).check();
 await rule.getByRole('button',{name:'2/3'}).click();await rule.getByRole('radio',{name:/All eligible voters/}).check();
 await rule.getByLabel('Participation numerator').fill('1');await rule.getByLabel('Participation denominator').fill('2');await rule.getByRole('radio',{name:/^Hold/}).check();
 await rule.getByRole('checkbox',{name:/reviewed this rule/}).check();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('region',{name:'Session review'}).waitFor();
 for(const name of ['Major','SAT'])await page.getByRole('switch',{name,exact:true}).click();
 await page.getByRole('checkbox',{name:'Notify selected voters'}).check();
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved',{exact:true}).waitFor();
 const draft=JSON.parse(JSON.stringify(f.h.state().drafts.at(-1).content));
 await page.getByRole('button',{name:'Schedule session',exact:true}).click();
 for(let i=0;i<100&&!f.h.state().sessions.length;i++)await page.waitForTimeout(100);
 const s=f.h.state().sessions[0];
  assert.equal(draft.localTime,local);assert.equal(s.presentationOptions.meeting.localTime,local);
  assert.deepEqual(strip({...draft,step:undefined}),expectedPayload.draft);
  assert.deepEqual(strip({presentationOptions:s.presentationOptions,displayConfig:s.displayConfig,targetSize:s.targetSize,candidates:s.candidates?.map(c=>c.applicationId),participants:s.participants?.map(p=>p.memberId),leaderMemberIds:s.leaderMemberIds,state:s.state}),expectedPayload.session);
 }finally{await browser.close();await f.close()}
});

// ---- Review follow-ups: saved drafts, preview without a round trip, errors beside their controls ----
const {cycleId,roundId,leaderId,voterId,apps,uuid}=require('./helpers/voting-room-harness.cjs');
const nyLocal=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms)).replace(' ','T');
const draftId=uuid(940);
function seedDraft(f,content){const value={version:1,step:1,cycle:cycleId,round:roundId,name:'Seeded draft',timing:'LATER',localTime:nyLocal(Date.now()+3*86400000).replace(/T\d\d:\d\d$/,'T18:30'),timeZone:'America/Chicago',occurrence:'LATER',duration:'30',location:'QA Hall',instructions:'Bring notes',applicants:apps,voters:[leaderId,voterId],target:'2',fields:['name','gpa','major'],highlights:{},notify:false,initialized:true,sessionId:uuid(941),planRevision:null,startRequestId:uuid(942),updateRequestId:uuid(943),leaderMemberIds:[],rules:{mode:'THRESHOLD',numerator:'3',denominator:'5',base:'BALLOTS_CAST',pNumerator:'1',pDenominator:'2',below:'REJECT',reviewed:true},...content};
 f.h.state().drafts.push({userId:leaderId,key:`voting-setup:${f.clubId}:${draftId}`,revision:3,mutationId:uuid(944),base:'',updatedAt:new Date(),content:value});return value;}
const draftUrl=f=>`${f.url}/voting/rooms/new?actor=leader&draft=${draftId}`;

test('an existing draft opens with every saved value and saves back unchanged',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const seed=seedDraft(f,{});await page.goto(draftUrl(f));const name=page.getByRole('textbox',{name:'Session name',exact:true});await name.waitFor();
  assert.equal(await name.inputValue(),'Seeded draft');assert.equal(await page.getByRole('radio',{name:'Schedule for later',exact:true}).isChecked(),true);
  assert.equal(await page.getByRole('textbox',{name:'Date and start time'}).inputValue(),seed.localTime);
  assert.equal(await page.getByRole('spinbutton',{name:'Expected duration in minutes'}).inputValue(),'30');
  assert.equal(await page.getByRole('combobox',{name:'Repeated time occurrence'}).inputValue(),'LATER');
  await page.getByText('Times are in America/Chicago.').waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Location or meeting link'}).inputValue(),'QA Hall');assert.equal(await page.getByRole('textbox',{name:'Participant instructions'}).inputValue(),'Bring notes');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const rule=page.getByRole('group',{name:'Voting rule'});
  assert.equal(await rule.getByRole('radio',{name:/Threshold decides/}).isChecked(),true);assert.equal(await rule.getByRole('radio',{name:/Ballots cast/}).isChecked(),true);assert.equal(await rule.getByRole('radio',{name:'Do not pass',exact:true}).isChecked(),true);
  assert.equal(await rule.getByLabel('Threshold numerator').inputValue(),'3');assert.equal(await page.getByRole('spinbutton',{name:'Target number to pass',exact:true}).inputValue(),'2');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  for(const [field,on] of [['Name',true],['GPA (out of 4.0)',true],['Major',true],['SAT',false]])assert.equal(await page.getByRole('switch',{name:field,exact:true}).getAttribute('aria-checked'),String(on),field);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved',{exact:true}).waitFor();
  const stored=f.h.state().drafts.find(d=>d.key===`voting-setup:${f.clubId}:${draftId}`).content;
  assert.deepEqual({...stored,step:1},seed,'the saved draft is unchanged apart from the step');assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('a switch shows in the preview while the exact preview read is still in flight',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 let hold=false,release;const held=new Promise(r=>release=r);
 await page.route('**/action',async route=>{if(hold&&route.request().postDataJSON()?.name==='previewVotingSetup')await held;await route.continue();});
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const slide=page.getByRole('complementary',{name:'Voting room preview'}).getByRole('region',{name:'Current applicant presentation'});await slide.waitFor();await page.waitForLoadState('networkidle');
  hold=true;await page.getByRole('switch',{name:'Major',exact:true}).click();
  await slide.locator('[data-slide-field="major"]').waitFor({timeout:1000});
  assert.equal(await slide.getAttribute('aria-busy'),null,'the narrowed slide is shown as current, not stale');
  release();
 }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();await f.close()}
});

test('Start session with an earlier step now invalid returns to that step with the message beside its control',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 try{
  // A draft left on step 3 whose scheduled time has since passed.
  seedDraft(f,{step:3,localTime:nyLocal(Date.now()-86400000)});await page.goto(draftUrl(f));
  await page.getByRole('button',{name:'Schedule session',exact:true}).click();
  await onStep(page,'Session details');const alert=page.getByRole('alert').filter({hasText:'Schedule at least one minute in the future.'});await alert.waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Date and start time'}).getAttribute('aria-describedby'),await alert.getAttribute('id'));
  assert.equal(f.h.state().sessions.length,0);
 }finally{await browser.close();await f.close()}
});

test('rule errors sit under their own choices; a bad timezone opens the timezone field; the plain-terms rule updates live',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 try{
  // A restored draft with a timezone the leader never saw: Continue reveals the field with its message.
  seedDraft(f,{timeZone:'Mars/Olympus_Mons'});await page.goto(draftUrl(f));await page.getByRole('button',{name:'Continue',exact:true}).click();
  const tz=page.getByRole('textbox',{name:'Timezone',exact:true});await tz.waitFor();const tzAlert=page.getByRole('alert').filter({hasText:/time ?zone/i});await tzAlert.waitFor();
  assert.equal(await tz.getAttribute('aria-describedby'),await tzAlert.getAttribute('id'));
  await tz.fill('America/Chicago');await page.getByRole('button',{name:'Continue',exact:true}).click();await onStep(page,'Applicants and voters');
  const rule=page.getByRole('group',{name:'Voting rule'});
  await rule.getByRole('radio',{name:/Leader confirms/}).check();await rule.getByRole('radio',{name:/Threshold decides/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const base=page.getByRole('radiogroup',{name:'Count Pass votes against'}),baseAlert=page.getByRole('alert').filter({hasText:'Choose what the threshold counts against.'});await baseAlert.waitFor();
  assert.equal(await base.getAttribute('aria-describedby'),await baseAlert.getAttribute('id'));
  await rule.getByRole('radio',{name:/Ballots cast/}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const below=page.getByRole('radiogroup',{name:'Below the threshold'}),belowAlert=page.getByRole('alert').filter({hasText:'Choose the outcome below the threshold.'});await belowAlert.waitFor();
  assert.equal(await below.getAttribute('aria-describedby'),await belowAlert.getAttribute('id'));
  const summary=rule.getByText(/^In plain terms:/);
  await rule.getByRole('button',{name:'2/3'}).click();await rule.getByLabel('Participation numerator').fill('1');await rule.getByLabel('Participation denominator').fill('2');
  await rule.getByRole('radio',{name:'Do not pass',exact:true}).check();assert.match(await summary.innerText(),/2\/3 of ballots cast are Pass.*Below the threshold they don’t pass/);
  await rule.getByRole('radio',{name:/All eligible voters/}).check();await rule.getByRole('radio',{name:/^Hold/}).check();
  assert.equal(await summary.innerText(),'In plain terms: an applicant passes if at least 2/3 of all eligible voters vote Pass and at least 1/2 of eligible voters took part. Otherwise they’re held for another vote.');
  await rule.getByRole('checkbox',{name:/reviewed this rule/}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();await onStep(page,'Presentation and review');
  const focused=await page.evaluate(()=>document.activeElement?.id||'');assert.match(focused,/-intro-3$/,'focus moves to the step intro');
  await page.getByRole('region',{name:'Session review'}).getByText('An applicant passes if at least 2/3 of all eligible voters vote Pass and at least 1/2 of eligible voters took part. Otherwise they’re held for another vote.',{exact:true}).waitFor();
 }finally{await browser.close();await f.close()}
});

test('Continue on step 2 with a step-1 time that has passed shows the message on step 1; a schedule-only error under Start now shows beside the timing',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 try{
  seedDraft(f,{step:2,localTime:nyLocal(Date.now()-86400000)});await page.goto(draftUrl(f));await onStep(page,'Applicants and voters');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await onStep(page,'Session details');
  const past=page.getByRole('alert').filter({hasText:'Schedule at least one minute in the future.'});await past.waitFor({state:'visible'});
  // A bad duration typed under Schedule for later still blocks Start now; the message sits by the timing choice, not on a hidden field.
  await page.getByRole('textbox',{name:'Date and start time'}).fill(nyLocal(Date.now()+3*86400000));
  await page.getByRole('spinbutton',{name:'Expected duration in minutes'}).fill('2000');await page.getByRole('radio',{name:'Start now',exact:true}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const timing=page.getByRole('alert').filter({hasText:'(under Schedule for later)'});await timing.waitFor({state:'visible'});
  assert.equal(await page.getByRole('group',{name:'When'}).getAttribute('aria-describedby'),await timing.getAttribute('id'));
  assert.equal(f.h.state().sessions.length,0);
 }finally{await browser.close();await f.close()}
});
