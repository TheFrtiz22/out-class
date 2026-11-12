// Loopback UI fixture: synthetic identities and in-memory Prisma doubles only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {clubId,cycleId,roundId,sessionId,leaderId,voterId,apps,uuid}=require('./helpers/voting-room-harness.cjs');
const later=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+2*86400000)).replace(' ','T');
const meeting=()=>({version:1,name:'Synthetic scheduled vote',timing:'LATER',localTime:later(),timeZone:'America/New_York',occurrence:'EARLIER',plannedAt:null,duration:30,location:'QA Hall',instructions:'',status:'SCHEDULED',announcedUserIds:[]});
async function scheduled(f){await f.h.api.createLiveVotingRoom({clubId,cycleId,roundId,sessionId,leaderMemberIds:[leaderId],participantIds:[voterId],applicationIds:apps,targetSize:null,presentationOptions:{fields:['name','gpa'],highlights:{},meeting:meeting()}});}
// The working copy a second tab leaves behind: initialized, bound to a session revision, and seven saves in.
function workingCopy(planRevision,name='Working copy from another tab'){return {userId:leaderId,key:`voting-setup:${clubId}:${sessionId}`,revision:7,mutationId:uuid(900),base:'',updatedAt:new Date(),content:{version:1,step:1,cycle:cycleId,round:roundId,name,timing:'LATER',localTime:later(),timeZone:'America/New_York',occurrence:'EARLIER',duration:'30',location:'QA Hall',instructions:'',applicants:apps,voters:[voterId],target:'',fields:['name','gpa'],highlights:{},notify:false,initialized:true,sessionId,planRevision,startRequestId:uuid(901),updateRequestId:uuid(902),leaderMemberIds:[]}};}
const editUrl=f=>`${f.url}/voting/rooms/new?actor=leader&session=${sessionId}&draft=${sessionId}`;

test('reopening Edit session over an initialized working copy loads instead of hanging on Loading rounds',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await scheduled(f);const revision=f.h.state().sessions[0].revision;f.h.state().drafts.push(workingCopy(revision));
  await page.goto(editUrl(f));const name=page.getByRole('textbox',{name:'Session name',exact:true});await name.waitFor({timeout:15000});
  assert.equal(await name.inputValue(),'Working copy from another tab');assert.equal(await page.getByText('Loading rounds…').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('a working copy saved against an older session revision shows a clear conflict and loads the latest session on request',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage();
 try{
  await scheduled(f);const s=f.h.state().sessions[0];f.h.state().drafts.push(workingCopy(s.revision));s.revision+=1;s.presentationOptions={...s.presentationOptions,meeting:{...s.presentationOptions.meeting,name:'Saved by the other tab'}};
  await page.goto(editUrl(f));const alert=page.getByRole('alert').filter({hasText:'changed in another tab or by another leader'});await alert.waitFor({timeout:15000});
  assert.equal(await page.getByRole('button',{name:'Save session changes'}).count(),0);
  await page.getByRole('button',{name:'Load latest session',exact:true}).click();await alert.waitFor({state:'detached'});
  assert.equal(await page.getByRole('textbox',{name:'Session name',exact:true}).inputValue(),'Saved by the other tab');
 }finally{await browser.close();await f.close()}
});

test('two tabs editing one scheduled session: the second save never overwrites, shows one conflict alert, and Load latest recovers',{timeout:170000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),context=await browser.newContext(),errors=[];
 const saved=()=>f.h.state().sessions[0],savedName=()=>saved().presentationOptions.meeting.name;
 const toReview=async page=>{await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Save session changes',exact:true}).waitFor({timeout:15000});};
 try{
  await scheduled(f);const original=saved().revision;
  const b=await context.newPage();b.on('pageerror',e=>errors.push(e.message));await b.goto(editUrl(f));const bName=b.getByRole('textbox',{name:'Session name',exact:true});await bName.waitFor({timeout:15000});
  await bName.fill('Edited in tab B');await toReview(b);await b.getByText('All changes saved',{exact:true}).waitFor({timeout:10000});
  const a=await context.newPage();a.on('pageerror',e=>errors.push(e.message));await a.goto(editUrl(f));const aName=a.getByRole('textbox',{name:'Session name',exact:true});
  // Tab A reopens the shared working copy on review, then goes back to rename.
  await a.getByRole('button',{name:'Save session changes',exact:true}).waitFor({timeout:15000});await a.getByRole('button',{name:'Back',exact:true}).click();await a.getByRole('button',{name:'Back',exact:true}).click();
  await aName.fill('Saved by tab A');await toReview(a);await a.getByRole('button',{name:'Save session changes',exact:true}).click();
  for(let i=0;i<100&&saved().revision===original;i++)await a.waitForTimeout(100);
  assert.equal(saved().revision,original+1);assert.equal(savedName(),'Saved by tab A');
  await b.getByRole('button',{name:'Save session changes',exact:true}).click();
  const alert=b.getByRole('alert').filter({hasText:'This session was changed in another tab or by another leader.'});await alert.waitFor({timeout:15000});await b.waitForTimeout(1500);
  assert.equal(saved().revision,original+1,'the stale save must not commit');assert.equal(savedName(),'Saved by tab A');
  assert.equal(await b.getByRole('alert').count(),1,'exactly one alert');
  assert.equal(await b.getByText(/draft changed in another tab/i).count(),0);
  for(const name of ['Retry session','Retry draft','Retry'])assert.equal(await b.getByRole('button',{name,exact:true}).count(),0,name);
  // Unsaved edits are only discarded after a confirm: dismissing keeps the conflict and the form.
  b.once('dialog',d=>d.dismiss());await b.getByRole('button',{name:'Load latest session',exact:true}).click();await b.waitForTimeout(300);assert.equal(await alert.count(),1);
  b.once('dialog',d=>d.accept());await b.getByRole('button',{name:'Load latest session',exact:true}).click();await alert.waitFor({state:'detached'});
  await b.getByRole('button',{name:'Back',exact:true}).click();await b.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await bName.inputValue(),'Saved by tab A');
  // After loading the latest session the tab saves normally against the new revision.
  await bName.fill('Edited after loading latest');await toReview(b);await b.getByRole('button',{name:'Save session changes',exact:true}).click();
  for(let i=0;i<100&&saved().revision===original+1;i++)await b.waitForTimeout(100);
  assert.equal(saved().revision,original+2);assert.equal(savedName(),'Edited after loading latest');assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('opening setup persists nothing until the leader edits; created sessions drop out of Drafts; Discard draft asks and removes only the caller draft',{timeout:150000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const live=()=>f.h.state().drafts.filter(d=>d.content!=null);
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');const name=page.getByRole('textbox',{name:'Session name',exact:true});await name.waitFor({timeout:15000});await page.waitForTimeout(2000);
  assert.equal(f.h.state().drafts.length,0,'merely opening setup must not autosave');
  await name.fill('Leader-named draft');await page.getByText('All changes saved',{exact:true}).waitFor({timeout:10000});assert.equal(live().length,1);
  // A draft whose session already exists, and another user's draft, never appear as Continue setup.
  await scheduled(f);f.h.state().drafts.push({...workingCopy(0,'Already scheduled'),revision:2});f.h.state().drafts.push({...workingCopy(0,'Someone else'),userId:voterId});
  await page.goto(f.url+'/landing?actor=leader');const drafts=page.getByRole('region',{name:'Setup drafts'});await drafts.waitFor({timeout:15000});
  assert.equal(await drafts.getByRole('listitem').count(),1);await drafts.getByText('Leader-named draft',{exact:true}).waitFor();assert.equal(await drafts.getByText('Already scheduled').count(),0);
  await drafts.getByRole('button',{name:'Discard draft · Leader-named draft'}).click();const dialog=page.getByRole('alertdialog');await dialog.getByText('Discard this setup draft?').waitFor();
  await dialog.getByRole('button',{name:'Keep draft'}).click();await dialog.waitFor({state:'detached'});assert.equal(live().length,3);
  await drafts.getByRole('button',{name:'Discard draft · Leader-named draft'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Discard draft',exact:true}).click();await drafts.waitFor({state:'detached'});
  assert.deepEqual(live().map(d=>d.content.name).sort(),['Already scheduled','Someone else']);assert.equal(f.h.state().sessions.length,1);assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('step 3 Additional observations field can be checked and stays checked on a phone-width screen',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const box=page.getByRole('checkbox',{name:'Additional observations',exact:true});assert.equal(await box.isDisabled(),false);await box.check();await page.waitForTimeout(1500);
  assert.equal(await box.isChecked(),true);assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('a scheduled session reads View details on the landing, and an early member sees its start in Eastern Time',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await scheduled(f);const plannedAt=f.h.state().sessions[0].presentationOptions.meeting.plannedAt;assert.ok(plannedAt);
  await page.goto(f.url+'/landing?actor=leader');await page.getByRole('link',{name:/^View details/}).waitFor({timeout:15000});assert.equal(await page.getByRole('link',{name:/^Open session|^Resume|^Join/}).count(),0);
  await page.goto(f.url+'/landing?actor=member');await page.getByRole('link',{name:/^View details/}).click();
  await page.getByRole('button',{name:'Join session',exact:true}).click();
  const expected=new Date(plannedAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
  await page.getByText(`Scheduled start · ${expected} Eastern Time · 30 minutes expected`,{exact:true}).waitFor({timeout:15000});assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('removing an applicant with prepared highlights asks in-app before saving; Keep editing saves nothing, confirming discards only theirs',{timeout:170000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const saved=()=>f.h.state().sessions[0],prepared=()=>f.h.state().preparations.map(p=>p.applicationId).sort();
 try{
  await scheduled(f);const revision=saved().revision;
  f.h.state().preparations.push(...apps.map(a=>({sessionId,applicationId:a,highlights:[{id:a}],revision:1,updatedBy:leaderId})));
  await page.goto(editUrl(f));await page.getByRole('textbox',{name:'Session name',exact:true}).waitFor({timeout:15000});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const box=page.getByRole('group',{name:/Applicants to review/}).getByRole('checkbox').nth(1);await box.uncheck();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const save=page.getByRole('button',{name:'Save session changes',exact:true});await save.waitFor({timeout:15000});
  await save.click();
  const dialog=page.getByRole('alertdialog',{name:'Discard prepared highlights?'});await dialog.waitFor({timeout:10000});
  assert.match(await dialog.innerText(),/Removing 1 applicant will discard their prepared slide highlights\./);
  await dialog.getByRole('button',{name:'Keep editing'}).click();await dialog.waitFor({state:'detached'});
  assert.equal(saved().revision,revision);assert.equal(saved().candidates.length,3);assert.deepEqual(prepared(),[...apps].sort());
  await save.click();await dialog.waitFor({timeout:10000});await dialog.getByRole('button',{name:'Remove and save'}).click();
  const deadline=Date.now()+20000;while(saved().revision===revision&&Date.now()<deadline)await page.waitForTimeout(100);
  assert.equal(saved().revision,revision+1);assert.equal(saved().candidates.length,2);
  const kept=saved().candidates.map(c=>c.applicationId).sort();assert.deepEqual(prepared(),kept,'only the removed applicant lost highlights');
  const audit=f.h.state().audit.filter(a=>a.action==='voting.slides.discarded');assert.equal(audit.length,1);assert.equal(audit[0].details.count,1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('highlights another leader prepares after this page loaded are confirmed from the server list before a removal saves, under a new request',{timeout:170000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const saved=()=>f.h.state().sessions[0];
 try{
  await scheduled(f);const revision=saved().revision;
  await page.goto(editUrl(f));await page.getByRole('textbox',{name:'Session name',exact:true}).waitFor({timeout:15000});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('group',{name:/Applicants to review/}).getByRole('checkbox').nth(1).uncheck();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const save=page.getByRole('button',{name:'Save session changes',exact:true});await save.waitFor({timeout:15000});
  // Another leader saves highlights for every applicant after this page loaded.
  f.h.state().preparations.push(...apps.map(a=>({sessionId,applicationId:a,highlights:[{id:a}],revision:1,updatedBy:voterId})));
  await save.click();
  const dialog=page.getByRole('alertdialog',{name:'Discard prepared highlights?'});await dialog.waitFor({timeout:15000});
  assert.match(await dialog.innerText(),/Removing 1 applicant will discard their prepared slide highlights\./);
  assert.equal(saved().revision,revision,'nothing saved before the refreshed confirmation');assert.equal(f.h.state().preparations.length,3);
  await dialog.getByRole('button',{name:'Remove and save'}).click();
  const deadline=Date.now()+20000;while(saved().revision===revision&&Date.now()<deadline)await page.waitForTimeout(100);
  assert.equal(saved().revision,revision+1);assert.equal(saved().candidates.length,2);assert.equal(f.h.state().preparations.length,2);
  assert.equal(f.h.state().receipts.filter(r=>r.sessionId===sessionId&&r.fingerprint).length>=1,true);
  const [audit]=f.h.state().audit.filter(a=>a.action==='voting.slides.discarded');assert.equal(audit.details.count,1);assert.equal(audit.details.preparations[0].updatedBy,voterId);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
