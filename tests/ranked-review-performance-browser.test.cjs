const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
// Synthetic, fictional rows only; no network beyond the local server. Budgets are deliberately
// generous (CI machines vary); the measured numbers are printed as test diagnostics.
const sizes=[1000,2000];
test('ranked review stays fast with 1000 and 2000 applicants',async t=>{
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{RankedReviewList}from'@/components/ranked-review-list';
 const round='00000000-0000-4000-8000-000000000001',statuses=['INTERVIEWING','IN_REVIEW','ACCEPTED','REJECTED','WAITLISTED'];
 const size=Number(new URLSearchParams(location.search).get('size'));
 const apps=Array.from({length:size},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),roundId:round,status:statuses[i%5],studentId:'student-'+i,recruitmentCycleId:null,
  student:{email:'applicant'+i+'@example.test',studentProfile:{firstName:'Synthetic'+i,lastName:'Applicant',headshotUrl:null}},
  roundScore:i%50===49?null:i%40===39?{average:null,submitted:0,required:4,provisional:true}:{average:1+((i*7)%181)/20,submitted:4,required:4,provisional:false}}));
 const settings={roundId:round,cycles:[],canManage:true,scopes:{'no-cycle':{bands:{green:{start:1,end:20},yellow:{start:21,end:40},red:{start:41}},revision:1}}};
 const api={loadRound:async()=>({rounds:[],genderCounts:null,applications:apps}),loadSettings:async()=>structuredClone(settings),saveBands:async input=>({revision:input.expectedRevision+1,bands:input.bands})};
 window.__opened=[];
 function Host(){const[ids,setIds]=React.useState([]);return <main className="p-4"><RankedReviewList clubId="00000000-0000-4000-8000-000000000009" rounds={[{id:round,name:'Interview',anonymousReview:false}]} initialRoundId={round} api={api} onOpen={id=>window.__opened.push(id)} votingSelection={{ids,toggle:id=>setIds(o=>o.includes(id)?o.filter(v=>v!==id):[...o,id])}}/></main>}
 window.__start=performance.now();createRoot(document.getElementById('root')).render(<Host/>);`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-ranked-perf-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true});
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/applicant-identity.css','utf8')+fs.readFileSync('components/ranked-review-list.css','utf8')+fs.readFileSync('components/voting-target-summary.css','utf8');
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://x');res.setHeader('Content-Type',url.pathname==='/app.js'?'text/javascript':url.pathname==='/style.css'?'text/css':'text/html');res.end(url.pathname==='/app.js'?js:url.pathname==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  const base='http://127.0.0.1:'+server.address().port;
  for(const size of sizes){
   const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await page.goto(base+'/?size='+size);
   // Ready = the ranked heading and the first rows are painted.
   await page.waitForFunction(()=>document.querySelectorAll('.oc-ranked-row').length>0&&document.getElementById('ranked-review-heading'),null,{polling:'raf',timeout:60000});
   const initialMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r(performance.now()-window.__start))));
   const rendered=await page.locator('.oc-ranked-row').count();
   assert.match(await page.locator('#ranked-review-heading').innerText(),new RegExp('· '+(size-Math.floor(size/50)-Math.floor(size/40)+Math.floor(size/200))+' scored'),'every scored applicant is ranked, including decided ones');
   // Interaction: toggling one voting checkbox re-renders the list.
   const toggleMs=await page.evaluate(()=>new Promise(r=>{const box=document.querySelector('.oc-ranked-row input[type=checkbox]:not(:disabled)'),t=performance.now();box.click();requestAnimationFrame(()=>setTimeout(()=>r(performance.now()-t),0))}));
   // Interaction: opening an applicant (selection) re-renders the list.
   const selectMs=await page.evaluate(()=>new Promise(r=>{const b=document.querySelectorAll('button.oc-ranked-open')[5],t=performance.now();b.click();requestAnimationFrame(()=>setTimeout(()=>r(performance.now()-t),0))}));
   const domNodes=await page.evaluate(()=>document.getElementsByTagName('*').length);
   t.diagnostic(JSON.stringify({size,initialMs:Math.round(initialMs),toggleMs:Math.round(toggleMs),selectMs:Math.round(selectMs),renderedRows:rendered,domNodes}));
   assert.ok(initialMs<8000,`initial render ${initialMs}ms at ${size}`);assert.ok(toggleMs<1500,`toggle ${toggleMs}ms at ${size}`);assert.ok(selectMs<1500,`select ${selectMs}ms at ${size}`);
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
});
