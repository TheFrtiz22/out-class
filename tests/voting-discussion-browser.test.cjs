const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');

test('members raise and withdraw by keyboard on a phone; the leader acknowledges; presentation stays uncluttered',{timeout:240000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 try{
  await f.h.create({participantIds:[leaderId,voterId]});await f.h.command('START');
  const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`;
  const phone=await browser.newContext({viewport:{width:390,height:844}}),member=await phone.newPage();member.on('pageerror',e=>errors.push(e.message));
  await member.goto(`${base}&view=member&actor=member`);
  const join=member.getByRole('button',{name:'Join session',exact:true});if(await join.count())await join.click();
  const raise=member.getByRole('button',{name:'Something to add'});await raise.waitFor();
  await raise.focus();await member.keyboard.press('Enter');
  await member.getByRole('status').filter({hasText:'Hand raised. The leader can see your request.'}).waitFor();
  assert.equal(f.h.state().hands.length,1);assert.equal(f.h.state().sessions[0].passes[0].candidates[0].ballots.length,0,'no ballot cast');
  assert.ok(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow on a phone');
  const out=path.resolve('test-results/voting-discussion');fs.mkdirSync(out,{recursive:true});await member.screenshot({path:path.join(out,'member-phone.png'),fullPage:true});
  const axeMember=await new AxeBuilder({page:member}).include('[aria-label="Discussion"]').analyze();assert.deepEqual(axeMember.violations.map(v=>v.id),[]);
  // Leader sees the request and acknowledges it by keyboard.
  const desk=await browser.newContext({viewport:{width:1280,height:900}}),leader=await desk.newPage();leader.on('pageerror',e=>errors.push(e.message));
  await leader.goto(`${base}&view=leader&actor=leader`);
  const panel=leader.getByRole('region',{name:'Something to add'});await panel.waitFor();await panel.getByText(/QA voter/).first().waitFor();
  const ack=panel.getByRole('button',{name:/^Acknowledge /});await ack.focus();await leader.keyboard.press('Enter');await panel.getByText(/Acknowledged/).waitFor();
  const axeLeader=await new AxeBuilder({page:leader}).include('[aria-label="Something to add"]').analyze();assert.deepEqual(axeLeader.violations.map(v=>v.id),[]);
  await member.reload();await member.getByRole('status').filter({hasText:'The leader has seen your request.'}).waitFor({timeout:20000});
  // Withdraw restores the raise control.
  await member.getByRole('button',{name:'Withdraw'}).click();await member.getByRole('button',{name:'Something to add'}).waitFor();
  // The audience presentation shows no discussion controls.
  const present=await desk.newPage();await present.goto(`${base}&view=present&actor=leader`);await present.getByText(/Applicant 1 of/).first().waitFor();
  assert.equal(await present.getByText(/Something to add|raised|Hand raised/).count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});
