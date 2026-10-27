const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
test('stale and failed booking invitations render safe separate states; retry reaches only the authorized application',async()=>{
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{BookingLinkPage}from'@/components/interviews/booking-link-page';createRoot(document.getElementById('root')).render(<BookingLinkPage/>);`,{
  'next/link':`module.exports='a'`,
  'next/navigation':`exports.useSearchParams=()=>new URLSearchParams('?clubId=synthetic&roundId=round')`,
  '@/contexts/auth-context':`exports.useAuth=()=>({user:{id:'synthetic-applicant'},loading:false})`,
  '@/contexts/demo-context':`exports.useDemoMode=()=>({ready:true,isDemoEnabled:false})`,
  '@/lib/workspace-api':`exports.getBookingApplication=async()=>{window.reads=(window.reads||0)+1;const mode=window.mode||new URL(location.href).searchParams.get('mode');if(mode==='reject')throw Error('RAW FRAMEWORK PRIVATE DETAILS');return mode==='ready'?{status:'ready',applicationId:'owned-synthetic-application'}:{status:mode||'unavailable'}}`,
  './applicant-booking':`exports.ApplicantBooking=({applicationId})=>require('react').createElement('p',null,'Authorized booking '+applicationId)`
 });
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><div id="root"></div><script>'+js+'</script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const base='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await page.goto(base);await page.getByRole('heading',{name:'Interview invitation unavailable',exact:true}).waitFor();assert.match(await page.getByRole('link',{name:'Your applications',exact:true}).getAttribute('href'),/view=tracker&section=applications/);assert.equal(await page.getByText(/Authorized booking/).count(),0);
  for(const mode of ['error','reject']){await page.goto(base+'/?mode='+mode);await page.getByRole('alert').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/RAW FRAMEWORK|PRIVATE/);await page.evaluate(()=>window.mode='ready');await page.getByRole('button',{name:'Retry invitation',exact:true}).press('Enter');await page.getByText('Authorized booking owned-synthetic-application',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.reads),2);}
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
});
