const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {cycleId,roundId,apps}=require('./helpers/voting-room-harness.cjs');
test('leader landing, selected setup, dedicated room, return/resume and member entry share one authoritative session',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),leader=await browser.newPage({viewport:{width:1280,height:800}}),member=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 for(const page of [leader,member])page.on('pageerror',e=>errors.push(e.message));
 try{
  // Decide (components/live-voting/decide-page.tsx) replaced the Voting room / Decision letters tab links with its Vote and Send steps.
  await leader.goto(f.url+'/decide?actor=leader&decisionTab=voting');await leader.getByRole('link',{name:'Start voting session',exact:true}).waitFor();await leader.getByText('No voting sessions available.',{exact:true}).waitFor();
  await leader.evaluate(()=>{const form=document.createElement('form');form.id='pending-letter';form.dataset.saving='true';document.body.append(form)});
  const steps=leader.getByRole('tablist',{name:'Decide steps',exact:true});
  await steps.getByRole('tab',{name:/^Step 2: Send(,|$)/}).click();assert.equal(new URL(leader.url()).searchParams.get('decisionTab'),'voting');
  assert.equal(await steps.getByRole('tab',{name:/^Step 1: Vote(,|$)/}).getAttribute('aria-selected'),'true','a pending save keeps the Vote step selected');
  await leader.evaluate(()=>document.getElementById('pending-letter').remove());
  assert.equal(f.h.state().sessions.length,0);
  await leader.evaluate(({clubId,ids})=>sessionStorage.setItem('outclass:voting-selection:selection-fixture',JSON.stringify({userId:window.initial.user.id,clubId,demo:false,applicationIds:ids})),{clubId:f.clubId,ids:[apps[1]]});
  await leader.goto(f.url+'/voting/rooms/new?actor=leader&selection=selection-fixture');
  await leader.getByRole('button',{name:'Continue',exact:true}).waitFor();await leader.getByRole('radio',{name:'Schedule for later',exact:true}).check();await leader.getByRole('textbox',{name:'Date and start time'}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16));await leader.getByRole('button',{name:'Continue',exact:true}).click();await leader.getByRole('button',{name:'Select all voters',exact:true}).click();
  const applicants=leader.getByRole('group',{name:/Applicants/});
  assert.equal(await applicants.getByRole('checkbox').nth(0).isChecked(),false);assert.equal(await applicants.getByRole('checkbox').nth(1).isChecked(),true);assert.equal(await applicants.getByRole('checkbox').nth(2).isChecked(),false);
  assert.equal(f.h.state().sessions.length,0);
  await leader.getByRole('button',{name:'Continue',exact:true}).click();await leader.getByRole('button',{name:'Schedule session',exact:true}).click();await leader.getByRole('button',{name:'Start session',exact:true}).waitFor();
  const room=f.h.state().sessions[0];assert.deepEqual(room.candidates.map(c=>c.applicationId),[apps[1]]);assert.equal(f.h.state().sessions.length,1);
  const back=await leader.getByRole('link',{name:'Back to Voting room',exact:true}).getAttribute('href');const q=new URL(back,'http://test').searchParams;assert.equal(q.get('decisionTab'),'voting');assert.equal(q.get('cycleId'),cycleId);assert.equal(q.get('roundId'),roundId);
  assert.equal(room.state,'DRAFT');await leader.getByRole('link',{name:'Back to Voting room',exact:true}).click();await leader.getByRole('link',{name:/^View details/}).waitFor();await leader.goBack();await leader.getByRole('button',{name:'Start session',exact:true}).waitFor();await leader.goForward();await leader.getByRole('link',{name:/^View details/}).click();await leader.getByRole('button',{name:'Start session',exact:true}).waitFor();assert.equal(f.h.state().sessions[0].state,'DRAFT');
  await member.goto(f.url+'/landing?actor=member&decisionTab=voting');assert.equal(await member.getByRole('link',{name:'Start voting session',exact:true}).count(),0);await member.getByRole('link',{name:/^View details/}).click();await member.getByRole('button',{name:'Join session',exact:true}).click();await member.getByText('Voting has not started.',{exact:true}).waitFor();assert.equal(await member.getByRole('region',{name:'Leader controls'}).count(),0);
  await member.reload();await member.getByText('Voting has not started.',{exact:true}).waitFor();
  assert.equal(f.h.state().notifications.length,0);assert.ok(f.h.state().apps.every(a=>a.status==='IN_REVIEW'));
  const dir=path.resolve('test-results/voting-navigation');fs.mkdirSync(dir,{recursive:true});await leader.goto(f.url+'/landing?actor=leader&decisionTab=voting');await leader.getByRole('link',{name:/^View details/}).waitFor();await leader.screenshot({path:path.join(dir,'desktop.png'),fullPage:true});await member.goto(f.url+'/landing?actor=member&decisionTab=voting');await member.getByRole('link',{name:/^View details/}).waitFor();await member.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const find=f.h.tx.votingSession.findMany;f.h.tx.votingSession.findMany=async()=>{throw Error('Synthetic list failure')};await leader.reload();await leader.getByText('Voting sessions could not be loaded. Check your current access and retry.',{exact:true}).waitFor();assert.equal(await leader.getByText('No voting sessions available.',{exact:true}).count(),0);f.h.tx.votingSession.findMany=find;await leader.getByRole('button',{name:'Retry sessions',exact:true}).click();await leader.getByRole('link',{name:/^View details/}).waitFor();assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('incompatible and stale selections require an explicit scope and never create a session on navigation',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage();
 try{
  const otherRound={...f.h.round,id:'00000000-0000-4000-8000-000000000099',name:'Other synthetic round'};
  f.h.state().apps[1].roundId=otherRound.id;f.h.state().apps[1].round=otherRound;f.h.state().apps[2].status='ACCEPTED';
  f.h.tx.pipelineRound.findMany=async()=>[f.h.round,otherRound];
  await page.goto(f.url+'/landing?actor=leader&decisionTab=voting');
  await page.evaluate(({clubId,ids})=>sessionStorage.setItem('outclass:voting-selection:mixed-fixture',JSON.stringify({userId:window.initial.user.id,clubId,demo:false,applicationIds:ids})),{clubId:f.clubId,ids:apps});
  await page.goto(f.url+'/voting/rooms/new?actor=leader&selection=mixed-fixture');
  await page.getByText(/1 selected applicant is no longer eligible/).waitFor();
  const scope=page.getByRole('combobox',{name:'Selected applicant scope',exact:true});await scope.waitFor();assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).count(),0);assert.equal(f.h.state().sessions.length,0);
  await scope.selectOption(`${cycleId}:${roundId}`);await page.getByRole('button',{name:'Continue',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
  assert.equal(await page.getByRole('group',{name:/Applicants/}).getByRole('checkbox').filter({visible:true}).count(),1);
  assert.equal(await page.getByRole('group',{name:/Applicants/}).getByRole('checkbox').first().isChecked(),true);
  await page.reload();await scope.waitFor();assert.equal(f.h.state().sessions.length,0);
 }finally{await browser.close();await f.close()}
});
