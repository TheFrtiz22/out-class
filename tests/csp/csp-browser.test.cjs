// Real Chrome against the running app with the Content-Security-Policy ENFORCED.
// Run through `pnpm run test:csp:browser` (scripts/run-csp-browser.cjs starts the server).
// Fails on any securitypolicyviolation event, console CSP error or report sent to the report
// endpoint, and on any server-rendered <script> without the response's nonce.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const base=process.env.OUTCLASS_CSP_URL;
const DEMO_COOKIE='outclass-demo-session';
let browser;
before(async()=>{assert.ok(base,'OUTCLASS_CSP_URL is set by scripts/run-csp-browser.cjs');browser=await chromium.launch();});
after(async()=>{await browser?.close();});

async function open(path,{demo=false}={}){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  if(demo)await context.addCookies([{name:DEMO_COOKIE,value:'1',url:base}]);
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  const violations=[],consoleErrors=[],reports=[];
  await page.exposeBinding('__cspViolation',(_source,v)=>violations.push(v));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.__cspViolation({directive:e.effectiveDirective,blocked:e.blockedURI,disposition:e.disposition,sample:(e.sample||'').slice(0,60),source:e.sourceFile})));
  page.on('console',m=>{if(/Content Security Policy|Refused to (load|execute|connect|frame|create)/i.test(m.text()))consoleErrors.push(m.text().slice(0,300));});
  await context.route('**/api/csp-report',route=>{reports.push(route.request().postData()?.slice(0,300));return route.fulfill({status:204});});
  const response=await page.goto(base+path,{waitUntil:'load',timeout:240000});
  await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
  const header=response.headers()['content-security-policy']||'';
  const nonce=/'nonce-([^']+)'/.exec(header)?.[1];
  const html=await response.text();
  return {page,context,response,header,nonce,html,violations,consoleErrors,reports,close:()=>context.close()};
}

function assertClean(r,label){
  assert.ok(r.header.includes("script-src"),`${label}: enforced Content-Security-Policy with script-src is sent`);
  assert.ok(r.nonce,`${label}: policy carries a nonce`);
  assert.equal(r.response.headers()['content-security-policy-report-only'],undefined,`${label}: enforced, not Report-Only`);
  const scripts=r.html.match(/<script\b[^>]*>/g)||[];
  assert.ok(scripts.length>0,`${label}: page rendered scripts`);
  const missing=scripts.filter(tag=>!tag.includes(`nonce="${r.nonce}"`));
  assert.deepEqual(missing,[],`${label}: every server-rendered script carries the response nonce`);
  assert.deepEqual(r.violations,[],`${label}: no securitypolicyviolation events`);
  assert.deepEqual(r.consoleErrors,[],`${label}: no console CSP errors`);
  assert.deepEqual(r.reports,[],`${label}: nothing sent to the report endpoint`);
}

const publicPages=['/','/about','/uva','/security','/explore','/login','/signup','/forgot-password'];
for(const path of publicPages){
  test(`enforced CSP: ${path} renders, hydrates and reports nothing`,{timeout:300000},async()=>{
    const r=await open(path);
    try{
      assert.ok(r.response.status()<500,`${path} status ${r.response.status()}`);
      // Hydration ran: Next's runtime is live only if its nonced bootstrap executed.
      await r.page.waitForFunction(()=>Array.isArray(self.__next_f)&&!!document.querySelector('body *'));
      assertClean(r,path);
    }finally{await r.close();}
  });
}

for(const view of ['student-dashboard','leader-dashboard','interview-workspace']){
  test(`enforced CSP: demo workspace ${view}`,{timeout:300000},async()=>{
    const r=await open(`/preview?view=${view}`,{demo:true});
    try{
      assert.equal(r.response.status(),200);
      await r.page.waitForFunction(()=>Array.isArray(self.__next_f));
      await r.page.waitForTimeout(1500);
      assertClean(r,view);
    }finally{await r.close();}
  });
}

test('enforced CSP: browser features the app uses are allowed; un-nonced script and eval are blocked',{timeout:300000},async()=>{
  const r=await open('/about');
  try{
    const result=await r.page.evaluate(async()=>{
      const out={};
      const settle=(el,ev=['load','error'])=>new Promise(res=>{ev.forEach(e=>el.addEventListener(e,()=>res(e),{once:true}));setTimeout(()=>res('timeout'),4000);});
      // Same-origin and Supabase/Sentry connections (network may fail locally; only CSP matters here).
      for(const [k,u] of [['self','/api/health'],['sentry','https://o0.ingest.us.sentry.io/api/0/envelope/']])out[k]=await fetch(u,{method:k==='self'?'GET':'POST',body:k==='self'?undefined:'{}'}).then(()=>'ok',e=>String(e));
      // Storage-style https images, data: and blob: images (QR export, photo previews).
      const img=src=>{const i=new Image();const p=settle(i);i.src=src;return p;};
      out.httpsImg=await img('https://placeholder-project.supabase.co/storage/v1/object/public/x.png');
      out.dataImg=await img('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
      const c=document.createElement('canvas');c.width=c.height=8;c.getContext('2d').fillRect(0,0,8,8);
      out.canvasPng=c.toDataURL('image/png').startsWith('data:image/png');
      const blob=await new Promise(res=>c.toBlob(res,'image/png'));out.blobImg=await img(URL.createObjectURL(blob));
      // pdf.js: module worker from the self-hosted path, and WebAssembly compile.
      try{const w=new Worker('/pdfjs/pdf.worker.min.mjs',{type:'module'});w.terminate();out.worker='ok';}catch(e){out.worker=String(e);}
      try{await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]));out.wasm='ok';}catch(e){out.wasm=String(e);}
      // Service worker registration (production registers /sw.js the same way).
      try{const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await reg.unregister();out.sw='ok';}catch(e){out.sw=String(e);}
      // Self-hosted fonts are loaded.
      await document.fonts.ready;out.fonts=[...document.fonts].filter(f=>f.status==='loaded').length;
      return out;
    });
    assert.equal(result.canvasPng,true);
    assert.equal(result.dataImg,'load');
    assert.equal(result.blobImg,'load');
    assert.equal(result.worker,'ok');
    assert.equal(result.wasm,'ok');
    assert.equal(result.sw,'ok');
    assert.ok(result.fonts>0,'self-hosted fonts loaded');
    assertClean(r,'feature probes');

    // Negative control: the detector sees, and the browser blocks, script without the nonce.
    const blocked=await r.page.evaluate(()=>{
      window.__ran=false;const s=document.createElement('script');s.textContent='window.__ran=true';document.head.appendChild(s);
      let evalRan=false;try{evalRan=(0,eval)('true');}catch{}
      return {inline:window.__ran,eval:evalRan};
    });
    await r.page.waitForTimeout(300);
    assert.equal(blocked.inline,false,'un-nonced inline script must not run');
    assert.ok(r.violations.some(v=>v.directive.startsWith('script-src')&&v.disposition==='enforce'),'violation detected for the control script');
  }finally{await r.close();}
});
