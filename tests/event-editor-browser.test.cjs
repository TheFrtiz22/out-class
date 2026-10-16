const { test }=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs');
const { chromium }=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
async function fixture(){
 const script=bundle(`import React from 'react';import{createRoot}from'react-dom/client';import{ClubEvents}from'@/components/events/club-events';window.writes=[];window.uploads=0;createRoot(document.getElementById('root')).render(<ClubEvents clubId="00000000-0000-4000-8000-000000000001" clubName="Test Club" canSeeAttendees={false}/>);`,{
  '@/hooks/use-editor-draft':`exports.useEditorDraft=()=>({ready:true,recovery:null,dirty:false,state:'saved',flush:async()=>{},clear:async()=>{},onBlur:()=>{}});`,
  '@/components/ui/autosave-status':`exports.AutosaveStatus=()=>null;`,
  'next/image':`exports.__esModule=true;exports.default=({unoptimized,...p})=>require('react').createElement('img',p);`,
  '@/lib/workspace-api':`exports.listClubCampusEvents=async()=>[];exports.saveCampusEvent=async input=>{window.writes.push(input);return {...input,id:'00000000-0000-4000-8000-000000000002',clubName:'Test Club',revision:window.writes.length,status:'DRAFT',date:input.date.toISOString(),endDate:input.endDate.toISOString(),rsvpCount:0,flyerUrl:null}};exports.commandCampusEvent=async()=>{};exports.uploadEventFlyer=async()=>{window.uploads++;await new Promise(r=>setTimeout(r,100));throw Error('Upload failed. Retry your flyer.');};`
 });
 const css=(await require('postcss')([require('@tailwindcss/postcss')()]).process('@import "../app/globals.css";',{from:require('node:path').resolve('tests/visual-fixture.css')})).css+fs.readFileSync('components/events/events.css','utf8');
 const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(script)}else {res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{font:16px Arial;margin:24px}label{display:grid;gap:8px}input,select,textarea,button{padding:10px;max-width:100%;box-sizing:border-box}fieldset{border:0}form{max-width:1000px}</style><div id="root"></div><script src="/bundle.js"></script>`)}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return{url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
test('browser: duration, custom end, all-day toggle, upload recovery and flyer-free saving on desktop/mobile',async()=>{
 const f=await fixture();let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage();page.setDefaultTimeout(10000);page.on("pageerror",error=>console.error("Editor fixture:",error.message));
 await page.goto(f.url);await page.getByRole('button',{name:'+ Create Corkboard Event',exact:true}).click();
 await page.getByLabel('Event name',{exact:true}).fill('Community night');await page.getByLabel('Start Date',{exact:true}).fill('2099-10-16');
 await page.getByLabel('Start Time',{exact:true}).selectOption('23:45');assert.equal(await page.getByLabel('Duration',{exact:true}).inputValue(),'60');
 await page.getByText(/Oct 17.*12:45 AM/).first().waitFor();
 await page.getByLabel('Duration',{exact:true}).selectOption('15');await page.getByText(/Oct 17.*12:00 AM/).first().waitFor();
 await page.getByLabel('Start Time',{exact:true}).selectOption('22:30');await page.getByRole('status').filter({hasText:/10:45 PM/}).first().waitFor();
 await page.getByLabel('Duration',{exact:true}).selectOption('custom');await page.getByLabel('End Date',{exact:true}).fill('2099-10-18');await page.getByLabel('End Time',{exact:true}).selectOption('11:15');
 await page.getByLabel('Duration',{exact:true}).selectOption('60');await page.getByLabel('Duration',{exact:true}).selectOption('custom');assert.equal(await page.getByLabel('End Date',{exact:true}).inputValue(),'2099-10-18');
 await page.getByLabel('All-day event',{exact:true}).check();assert.equal(await page.getByLabel('Start Time',{exact:true}).count(),0);assert.equal(await page.getByLabel('Duration',{exact:true}).count(),0);
 assert.equal(await page.getByLabel('End Date',{exact:true}).inputValue(),'2099-10-16');await page.getByLabel('End Date',{exact:true}).fill('2099-10-19');
 await page.getByLabel('All-day event',{exact:true}).uncheck();assert.equal(await page.getByLabel('Start Time',{exact:true}).inputValue(),'22:30');assert.equal(await page.getByLabel('End Time',{exact:true}).inputValue(),'11:15');
 await page.getByLabel('Location',{exact:true}).fill('Hall');await page.getByLabel('Description',{exact:true}).fill('Meet the community.');
 await page.locator('input[type=file]').setInputFiles({name:'flyer.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])});await page.getByText('Upload failed. Retry your flyer.').waitFor();assert.equal(await page.getByLabel('Event name',{exact:true}).inputValue(),'Community night');
 assert.equal(await page.getByText(/Eastern Time|EST|EDT|timezone/).count(),0);
 if(process.env.OUTCLASS_EVENT_EDITOR_SCREENSHOTS){fs.mkdirSync(process.env.OUTCLASS_EVENT_EDITOR_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.OUTCLASS_EVENT_EDITOR_SCREENSHOTS+'/desktop.png',fullPage:true})}await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByLabel('All-day event',{exact:true}).check();if(process.env.OUTCLASS_EVENT_EDITOR_SCREENSHOTS)await page.screenshot({path:process.env.OUTCLASS_EVENT_EDITOR_SCREENSHOTS+'/mobile.png',fullPage:true});await page.getByRole('button',{name:'Apply event changes',exact:true}).click();
 await page.getByRole('button',{name:'+ Create Corkboard Event',exact:true}).waitFor();const writes=await page.evaluate(()=>window.writes);assert.equal(writes.at(-1).allDay,true);assert.equal(writes.at(-1).useTemplate,true);assert.equal(new Date(writes.at(-1).endDate).toISOString(),'2099-10-20T04:00:00.000Z');
 }finally{await browser?.close();await f.close()}
});
