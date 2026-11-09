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
