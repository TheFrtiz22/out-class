const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs'),{sessionId}=require('./helpers/voting-room-harness.cjs');

test('phase-focused leader/member controls retain safe saves, secondary actions, keyboard and phone access',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true});
 const leaderContext=await browser.newContext({viewport:{width:1280,height:800}}),memberContext=await browser.newContext({viewport:{width:390,height:844}});
 const leader=await leaderContext.newPage(),member=await memberContext.newPage(),errors=[];
 for(const p of [leader,member])p.on('pageerror',e=>errors.push(e.message));
 const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`,out=process.env.VOTING_SCREENSHOT_DIR;
 let release;
 try{
  await f.h.create();await f.h.command('START');await leader.goto(`${base}&view=leader&actor=leader`);
  await leader.getByRole('button',{name:'Open voting',exact:true}).waitFor();
  assert.equal(await leader.getByRole('button',{name:'End voting',exact:true}).isVisible(),false);
  assert.equal(await leader.getByRole('textbox',{name:'Reason for passing without vote'}).isVisible(),false);
  assert.equal(await leader.getByRole('link',{name:'My voting device',exact:true}).isVisible(),false);
  await leader.getByText('Session options',{exact:true}).click();await leader.getByRole('link',{name:'My voting device',exact:true}).waitFor();
  await leader.keyboard.press('Escape');await leader.getByRole('link',{name:'My voting device',exact:true}).waitFor({state:'hidden'});assert.equal(await leader.getByRole('button',{name:'Session options',exact:true}).getAttribute('aria-expanded'),'false');
  await leader.getByRole('button',{name:'Session options',exact:true}).click();await leader.getByRole('button',{name:'Join QR',exact:true}).click();await leader.getByRole('dialog',{name:'Join live voting',exact:true}).waitFor();await leader.keyboard.press('Escape');await leader.getByRole('dialog',{name:'Join live voting',exact:true}).waitFor({state:'hidden'});await leader.waitForFunction(()=>['Join QR','Session options'].includes(document.activeElement?.textContent?.trim()));
  if(await leader.getByRole('button',{name:'Session options',exact:true}).getAttribute('aria-expanded')==='true')await leader.keyboard.press('Escape');
  await leader.getByText('More actions',{exact:true}).click();await leader.getByRole('textbox',{name:'Reason for passing without vote'}).waitFor();
  await leader.getByText('More actions',{exact:true}).click();
  await leader.getByRole('button',{name:'Open voting',exact:true}).focus();await leader.keyboard.press('Enter');
  await leader.getByRole('button',{name:'Close voting',exact:true}).waitFor();
  await member.goto(`${base}&view=member&actor=member`);await member.getByRole('button',{name:'Join session',exact:true}).click();
  const pass=member.getByRole('button',{name:'Pass',exact:true});await pass.waitFor();await member.waitForFunction(()=>!document.querySelector('[aria-label="Your ballot"] button')?.disabled);
  const gate=new Promise(r=>release=r);let held=false;
  await member.route('**/action',async route=>{if(!held&&route.request().postDataJSON().name==='castLiveVotingBallot'){held=true;await gate;}await route.continue()});
  await pass.click();await member.getByText('Saving Pass…',{exact:true}).waitFor();assert.equal(await member.getByRole('heading',{name:'QA Applicant One',exact:true}).count(),1);
  assert.ok(await pass.isDisabled());release();await member.getByText('Saved: pass',{exact:true}).waitFor();
  await member.getByRole('button',{name:'Hold',exact:true}).click();await member.getByText('Saved: hold',{exact:true}).waitFor();
  assert.equal(f.h.state().sessions[0].passes[0].candidates[0].ballots.length,1,'changed choice updates one ballot');
  if(out){fs.mkdirSync(out,{recursive:true});await leader.screenshot({path:path.join(out,'leader-desktop.png'),fullPage:true});await member.screenshot({path:path.join(out,'member-phone.png'),fullPage:true})}
  await leader.setViewportSize({width:390,height:844});await leader.getByText('More actions',{exact:true}).click();await leader.getByRole('button',{name:'End voting',exact:true}).waitFor();
  assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await leader.getByText('More actions',{exact:true}).click();
  if(out)await leader.screenshot({path:path.join(out,'leader-phone.png'),fullPage:true});
  await leader.reload();await leader.getByRole('button',{name:'Close voting',exact:true}).waitFor();leader.once('dialog',d=>d.accept());await leader.getByRole('button',{name:'Close voting',exact:true}).click();
  await member.getByRole('region',{name:'Closed ballot totals'}).waitFor();assert.equal(await member.getByRole('button',{name:'Hold',exact:true}).count(),0,'closed ballot controls are replaced, not merely disabled');
  await member.getByText('Saved: hold',{exact:true}).waitFor();assert.equal(await member.getByRole('region',{name:'Leader controls'}).count(),0);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic discussion');f.failCommand();await leader.getByRole('button',{name:'Hold',exact:true}).click();
  await leader.getByRole('button',{name:'Retry command',exact:true}).waitFor();assert.equal(await leader.getByRole('textbox',{name:'Decision reason'}).inputValue(),'Synthetic discussion');
  await leader.getByRole('button',{name:'Retry command',exact:true}).click();await leader.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor();
  await leader.getByRole('button',{name:'Undo',exact:true}).waitFor();await leader.locator('.vr-slide-ready').waitFor();
  assert.equal(f.h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,1);
  assert.equal(await leader.getByRole('textbox',{name:'Reason for passing without vote'}).isVisible(),false,'secondary controls reset after advancing');
  const audience=await browser.newPage({viewport:{width:1280,height:720}});await audience.goto(`${base}&view=present&actor=leader`);await audience.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor();
  assert.equal(await audience.getByText('Session options',{exact:true}).count(),0);assert.equal(await audience.getByRole('region',{name:'Decision totals'}).count(),0);assert.equal(await audience.getByRole('region',{name:'Passed and target'}).count(),1);
  assert.ok(await audience.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await member.setViewportSize({width:1280,height:800});if(out)await member.screenshot({path:path.join(out,'member-desktop.png'),fullPage:true});
  for(const page of [leader,member]){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);}
  await leader.emulateMedia({reducedMotion:'reduce'});await leader.getByText('Session options',{exact:true}).click();assert.equal(await leader.locator('.vr-session-trigger svg').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await leader.getByText('Session options',{exact:true}).click();await leader.evaluate(()=>document.documentElement.style.zoom='2');assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'zoomed layout stays readable without horizontal overflow');
  assert.deepEqual(errors,[]);
 }finally{release?.();await browser.close();await f.close()}
});
