const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs'),{sessionId,apps}=require('./helpers/voting-room-harness.cjs');
test('acknowledged decision stays locked across queued stale refresh until its authoritative snapshot arrives',{timeout:90000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage();let release,held=false;
 try{await f.h.create();await f.h.command('START');await f.h.command('OPEN_VOTING');await f.h.command('CLOSE_VOTING');await page.goto(`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=leader&actor=leader`);await page.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision');await page.locator('.vr-slide-ready').waitFor();
 let seen;const holding=new Promise(r=>seen=r),gate=new Promise(r=>release=r);await page.route('**/action',async route=>{const body=route.request().postDataJSON();if(body.name==='getLiveVotingRoom'&&!held){held=true;const response=await route.fetch();seen();await gate;await route.fulfill({response});}else await route.continue()});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await holding;
 await page.getByRole('button',{name:'Pass',exact:true}).click();await page.locator('.vr-decision-saved').waitFor();assert.equal(f.h.state().sessions[0].activeApplicationId,apps[1]);
 assert.equal(await page.getByRole('heading',{name:'QA Applicant One',exact:true}).count(),1,'held refresh still shows the outgoing applicant');assert.ok(await page.getByRole('button',{name:'Pass',exact:true}).isDisabled(),'never re-enable outgoing action after acknowledgement');assert.ok(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),'Undo waits for the current revision too');
 release();await page.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor();await page.locator('.vr-slide-ready').waitFor();assert.ok(await page.getByRole('button',{name:'Open voting',exact:true}).isEnabled());assert.ok(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled());assert.equal(f.h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,1);
 }finally{release?.();await browser.close();await f.close()}
});
