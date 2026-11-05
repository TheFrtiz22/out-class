const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');

test('setup requires choosing and reviewing an automatic rule with a plain-language preview; the leader confirms the rule outcome after closing',{timeout:240000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const rule=page.getByRole('group',{name:'Voting rule'});await rule.waitFor();
  assert.ok(await rule.getByRole('radio',{name:/Leader confirms/}).isChecked(),'leader-confirmed is the default');
  await rule.getByRole('radio',{name:/Threshold decides/}).check();
  // Consequential choices start empty; continuing is refused until chosen and reviewed.
  assert.equal(await rule.getByRole('radio',{name:/Ballots cast/}).isChecked(),false);assert.equal(await rule.getByRole('radio',{name:/^Hold/}).isChecked(),false);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:/Choose what the threshold counts against/}).waitFor();
  await rule.getByRole('button',{name:'2/3'}).click();await rule.getByRole('radio',{name:/All eligible voters/}).check();
  await rule.getByLabel('Participation numerator').fill('1');await rule.getByLabel('Participation denominator').fill('2');await rule.getByRole('radio',{name:/^Hold/}).check();
  const preview=rule.getByRole('region',{name:'Rule preview'});await preview.waitFor();
  assert.ok(await preview.getByText(/missing ballots still count in the total/).count());assert.ok(await preview.getByText(/nobody is rejected automatically/i).count());
  assert.ok(await preview.getByRole('listitem').count()>=2,'worked examples are shown');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:/Review the automatic rule/}).waitFor();assert.equal(f.h.state().sessions.length,0);
  const out=path.resolve('test-results/voting-rules');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'setup-rule-preview.png'),fullPage:true});
  const axe=await new AxeBuilder({page}).include('fieldset').analyze();assert.deepEqual(axe.violations.map(v=>`${v.id}: ${v.nodes.length}`),[]);
  await rule.getByRole('checkbox',{name:/reviewed this rule/}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText(/Threshold decides: an applicant passes with Pass votes from at least 2\/3 of all eligible voters/).filter({visible:true}).first().waitFor();
  await page.getByRole('button',{name:'Start session',exact:true}).click();await page.getByRole('button',{name:'Open voting',exact:true}).waitFor();
  const saved=f.h.state().sessions[0].presentationOptions.rules;assert.deepEqual(saved,{mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'ELIGIBLE_VOTERS',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true});
  // Leader opens voting; every eligible voter votes Pass through the real actions; the leader closes and confirms the rule's outcome.
  await page.getByRole('button',{name:'Open voting',exact:true}).click();await page.getByRole('button',{name:'Close voting',exact:true}).waitFor();
  const electorate=f.h.state().ballotRules[0].electorate;assert.ok(electorate.length>=1);
  const live=f.h.state().sessions[0];for(const m of f.h.members.filter(m=>electorate.includes(m.id))){f.h.as(m.userId);const r=await f.h.api.castLiveVotingBallot({clubId:f.clubId,sessionId:live.id,requestId:crypto.randomUUID(),passNumber:live.currentPass,applicationId:live.activeApplicationId,ballotRevision:null,choice:'ACCEPT'});assert.equal(r.ok,true,JSON.stringify(r));}f.h.as(f.h.members[0].userId);await page.reload();await page.getByRole('button',{name:'Close voting',exact:true}).waitFor();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Close voting',exact:true}).click();
  const confirm=page.getByRole('region',{name:'Confirm rule outcome'});await confirm.waitFor();assert.ok(await confirm.getByText(/Pass votes? of \d+ eligible voters?; \d+ needed \(2\/3\)/).count());
  assert.equal(await confirm.getByRole('button',{name:/Hold|Do not pass/}).count(),0,'no competing outcome buttons when the rule decided');
  await confirm.getByRole('button',{name:'Confirm Pass'}).click();await page.getByText(/Passed/).first().waitFor();
  assert.equal(f.h.state().sessions[0].passes[0].candidates[0].confirmedDecision,'PASS');assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});
