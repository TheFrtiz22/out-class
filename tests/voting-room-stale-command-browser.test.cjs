const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs'),{sessionId,leaderId}=require('./helpers/voting-room-harness.cjs');
test('after STALE_STATE the leader controls stay disabled until a newer snapshot arrives (review finding 5)',{timeout:90000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage();let release,held=false;
 try{await f.h.create();await f.h.command('START');
  await page.goto(`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=leader&actor=leader`);
  const open=page.getByRole('button',{name:'Open voting',exact:true});await open.waitFor();await page.locator('.vr-slide-ready').waitFor();assert.ok(await open.isEnabled());
  // Another leader tab opens and closes voting: this view is now stale.
  f.h.as(leaderId);await f.h.command('OPEN_VOTING');await f.h.command('CLOSE_VOTING');
  // Hold the next room poll in flight so the post-conflict refresh() returns before any newer snapshot lands.
  let seen;const holding=new Promise(r=>seen=r),gate=new Promise(r=>release=r);
  await page.route('**/action',async route=>{const body=route.request().postDataJSON();if(body.name==='getLiveVotingRoom'&&!held){held=true;const response=await route.fetch();seen();await gate;await route.fulfill({response});}else await route.continue();});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await holding;
  await open.click();await page.getByText('The room changed since this view loaded',{exact:false}).waitFor();
  assert.ok(await open.isDisabled(),'stale controls are not re-enabled while the newer snapshot is still arriving');
  await page.getByText('Updating…',{exact:true}).waitFor();
  release();await page.getByRole('textbox',{name:'Decision reason'}).waitFor({timeout:15000});
  assert.equal(await open.count(),0,'the newer snapshot replaces the stale Open voting control');
  assert.ok(await page.getByRole('textbox',{name:'Decision reason'}).isEnabled(),'controls re-enable once the newer snapshot arrives');
 }finally{release?.();await browser.close();await f.close()}
});
