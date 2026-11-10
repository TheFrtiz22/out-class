const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
// 1x1 PNG served as the authorized photo; /missing.png returns 404 to simulate a failed load.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
test('applicant identity: photo, missing photo, failed load and anonymous keep one square size with no broken image',async()=>{
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{ApplicantIdentity}from'@/components/applicant-identity';
 const rows=[['photo','Synthetic Alpha','/photo.png',false],['missing','Synthetic Beta',null,false],['failed','Synthetic Gamma','/missing.png',false],['anonymous','Applicant A1B2',null,true]];
 createRoot(document.getElementById('root')).render(<main className="p-4">{rows.map(([id,name,photo,anonymous])=><div key={id} data-case={id}><ApplicantIdentity name={name} photo={photo} anonymous={anonymous}><span>Round A · Open review</span></ApplicantIdentity></div>)}
 <div data-case="slide"><ApplicantIdentity size="lg" announcePhoto name="Synthetic Alpha" photo="/photo.png" heading={<h2>Synthetic Alpha</h2>}/></div>
 <div data-case="slide-failed"><ApplicantIdentity size="lg" announcePhoto name="Synthetic Gamma" photo="/missing.png" heading={<h2>Synthetic Gamma</h2>}/></div></main>);`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-identity-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true});const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/applicant-identity.css','utf8');
 const requests=[];const server=http.createServer((req,res)=>{requests.push(req.url);if(req.url==='/photo.png'){res.setHeader('Content-Type','image/png');return res.end(png)}if(req.url==='/missing.png'){res.statusCode=404;return res.end('Not found')}res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  for(const [label,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await page.goto(base);await page.locator('[data-case="photo"] img').waitFor();await page.waitForFunction(()=>document.querySelectorAll('[data-photo="placeholder"]').length===4);
   const box=c=>page.locator(`[data-case="${c}"] .oc-applicant-identity-photo`).boundingBox();
   const sizes=await Promise.all(['photo','missing','failed','anonymous'].map(box));
   for(const s of sizes){assert.equal(Math.round(s.width),40);assert.equal(Math.round(s.height),40);}
   assert.equal(await page.locator('[data-case="photo"] .oc-applicant-identity-photo').getAttribute('data-photo'),'loaded');
   assert.equal(await page.locator('[data-case="missing"] .oc-applicant-identity-fallback').innerText(),'SB');
   assert.equal(await page.locator('[data-case="failed"] img').count(),0,'a failed photo leaves no broken image');assert.equal(await page.locator('[data-case="failed"] .oc-applicant-identity-fallback').innerText(),'SG');
   assert.equal(await page.locator('[data-case="anonymous"] .oc-applicant-identity-fallback').innerText(),'','anonymous shows no initials');assert.equal(await page.locator('[data-case="anonymous"] .oc-applicant-identity-fallback svg').count(),1);
   assert.equal(await page.locator('[data-case="photo"] [aria-hidden="true"].oc-applicant-identity-photo').count(),1,'row photos are decorative beside the name');
   assert.equal(await page.getByRole('img',{name:'Applicant headshot',exact:true}).count(),1);assert.equal(await page.getByRole('img',{name:'No applicant photo',exact:true}).count(),1,'a failed slide photo is announced as missing');
   const lg=await box('slide');assert.equal(Math.round(lg.width),Math.round(lg.height));assert.equal(Math.round(lg.width),64);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no horizontal overflow');
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.ok(!requests.some(u=>/anonymous|A1B2/.test(u)),'anonymous identities request no photo');
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
});
