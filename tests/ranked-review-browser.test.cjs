const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
// Synthetic fixture only: fictional names, no photos, no network beyond the local server.
test('ranked review: labelled bands, decisions note, Not scored and hidden groups, explicit refresh preserving selection',async()=>{
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{RankedReviewList}from'@/components/ranked-review-list';
 const round='00000000-0000-4000-8000-000000000001';
 const app=(n,first,score,status='INTERVIEWING')=>({id:'00000000-0000-4000-8000-00000000010'+n,roundId:round,status,studentId:'student-'+n,recruitmentCycleId:null,student:{email:first.toLowerCase()+'@example.test',studentProfile:{firstName:first,lastName:'Synthetic',headshotUrl:null}},roundScore:score});
 const s=(average,submitted,required=2)=>({average,submitted,required,provisional:submitted<required});
 window.__apps=[app(1,'Alpha',s(9,2)),app(2,'Bravo',s(8,2)),app(3,'Charlie',s(8,2)),app(4,'Delta',s(7,2)),app(5,'Echo',s(null,0)),app(6,'Foxtrot',null)];
 window.__opened=[];window.__reads=0;window.__saved=[];
 const settings={roundId:round,cycles:[],canManage:true,scopes:{'no-cycle':{bands:{green:{start:1,end:2},yellow:{start:3,end:3},red:{start:4}},revision:1}}};
 const api={loadRound:async()=>{window.__reads++;return{rounds:[],genderCounts:null,applications:structuredClone(window.__apps)}},loadSettings:async()=>structuredClone(settings),saveBands:async input=>{window.__saved.push(input);return{revision:input.expectedRevision+1,bands:input.bands}}};
 function Host(){const[ids,setIds]=React.useState([]);return <main className="p-4"><RankedReviewList clubId="00000000-0000-4000-8000-000000000009" rounds={[{id:round,name:'Interview',anonymousReview:false}]} initialRoundId={round} api={api} onOpen={id=>window.__opened.push(id)} votingSelection={{ids,toggle:id=>setIds(o=>o.includes(id)?o.filter(v=>v!==id):[...o,id])}}/></main>}
 createRoot(document.getElementById('root')).render(<Host/>);`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-ranked-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true});
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/applicant-identity.css','utf8')+fs.readFileSync('components/ranked-review-list.css','utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  for(const [label,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await page.goto(base);await page.getByRole('heading',{name:/Ranked applicants/}).waitFor();
   const note=await page.getByRole('note').first().innerText();assert.match(note,/discussion groups, not Pass, Hold or Do not pass decisions/);assert.match(note,/Nothing here advances, rejects or notifies anyone/);
   const rows=page.locator('.oc-ranked-list > li');
   const order=async()=>(await rows.evaluateAll(els=>els.map(e=>e.querySelector('.oc-applicant-identity-name').textContent)));
   assert.deepEqual(await order(),['Alpha Synthetic','Bravo Synthetic','Charlie Synthetic','Delta Synthetic','Echo Synthetic','Foxtrot Synthetic']);
   // Bands: every colored band carries its text label; tied ranks share the band and explain the larger band.
   const band=name=>page.locator('.oc-ranked-row',{hasText:name}).getAttribute('data-band');
   assert.equal(await band('Alpha'),'green');assert.equal(await band('Bravo'),'green');assert.equal(await band('Charlie'),'green');assert.equal(await band('Delta'),'red');
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Bravo'}).locator('.oc-ranked-band').innerText(),'Green');
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Delta'}).locator('.oc-ranked-band').innerText(),'Red');
   const bg=name=>page.locator('.oc-ranked-row',{hasText:name}).locator('.oc-ranked-band').evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.notEqual(await bg('Bravo'),await bg('Delta'),'bands are colored as well as labelled');
   assert.match(await page.locator('.oc-ranked-tie').innerText(),/2 applicants tied at rank 2 are all in Green; the band is larger than 2\./);
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Charlie'}).locator('.sr-only').first().innerText(),'Rank 2, tied');
   assert.match(await page.locator('.oc-ranked-row',{hasText:'Alpha'}).innerText(),/9\.0[\s\S]*2 scored evaluations/);
   // Not scored is its own group, never banded; a hidden score is not ranked.
   const notScored=page.locator('[data-group="not-scored"]');assert.match(await notScored.innerText(),/Not scored · 1[\s\S]*Echo Synthetic/);
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Echo'}).getAttribute('data-band'),null);
   const hidden=page.locator('[data-group="hidden"]');assert.match(await hidden.innerText(),/Score not available · 1[\s\S]*Foxtrot Synthetic[\s\S]*Hidden until you review/);
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Foxtrot'}).getAttribute('data-band'),null);
   assert.equal(await page.getByRole('checkbox',{name:'Select Bravo Synthetic for voting'}).count(),1);
   // Select by keyboard; then new data arrives in the background.
   const bravo=page.locator('.oc-ranked-row',{hasText:'Bravo'}).locator('button.oc-ranked-open');await bravo.focus();await page.keyboard.press('Enter');
   assert.deepEqual(await page.evaluate(()=>window.__opened),['00000000-0000-4000-8000-000000000102']);assert.equal(await bravo.getAttribute('aria-current'),'true');
   await page.evaluate(()=>{window.__apps[3].roundScore={average:10,submitted:2,required:2,provisional:false};window.dispatchEvent(new CustomEvent('outclass:data-changed',{detail:{scope:'applicants'}}))});
   await page.getByText('Updated results available.').waitFor();
   assert.deepEqual((await order()).slice(0,4),['Alpha Synthetic','Bravo Synthetic','Charlie Synthetic','Delta Synthetic'],'no silent reordering');
   await page.getByRole('button',{name:'Refresh ranking'}).click();
   await page.getByText('Updated results available.').waitFor({state:'detached'});
   assert.deepEqual((await order()).slice(0,4),['Delta Synthetic','Alpha Synthetic','Bravo Synthetic','Charlie Synthetic']);
   assert.equal(await page.locator('.oc-ranked-row',{hasText:'Bravo'}).locator('button.oc-ranked-open').getAttribute('aria-current'),'true','selection survives refresh');
   assert.equal(await band('Delta'),'green');
   // An unchanged background read does not raise the banner.
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('outclass:data-changed',{detail:{scope:'applicants'}})));await page.waitForFunction(()=>window.__reads>=3);await page.waitForTimeout(100);
   assert.equal(await page.getByText('Updated results available.').count(),0);
   // Leaders edit contiguous bands; invalid input is blocked client-side.
   await page.getByText('Edit discussion bands').click();await page.getByLabel('Yellow ends at rank').fill('1');
   assert.equal(await page.getByRole('button',{name:'Save bands'}).isDisabled(),true);
   await page.getByLabel('Yellow ends at rank').fill('4');await page.getByRole('button',{name:'Save bands'}).click();
   await page.waitForFunction(()=>window.__saved.length===1);
   assert.deepEqual(await page.evaluate(()=>window.__saved[0].bands),{green:{start:1,end:2},yellow:{start:3,end:4},red:{start:5}});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no horizontal overflow');
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
});
