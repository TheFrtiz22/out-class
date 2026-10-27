const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright'),{bundle}=require('./helpers/browser-bundle.cjs');
test('interview tabs lazily mount Scheduling, retain a dirty editor across rapid switches and follow URL tab changes',async()=>{
 const code=bundle(`const replace=history.replaceState;history.replaceState=function(...args){replace.apply(this,args);dispatchEvent(new PopStateEvent('popstate'))};import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{InterviewManagementTabs}from'@/components/interview-management-tabs';function App(){const[tab,setTab]=useState('rooms');useEffect(()=>{const changed=()=>setTab(new URLSearchParams(location.search).get('interviewTab')||'rooms');window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed)},[]);return <InterviewManagementTabs clubId="club" initialTab={tab}/>};createRoot(document.getElementById('root')).render(<App/>);`,{
  'next/link':"module.exports=()=>null",
  '@/contexts/auth-context':"exports.useAuth=()=>({user:{id:'owner',memberships:[{clubId:'club',isOwner:true,status:'ACTIVE',permissions:[],interviewOffices:[]}]}})",
  '@/contexts/demo-context':"exports.useDemoMode=()=>({ready:true,isDemoEnabled:true})",
  '@/lib/workspace-api':"exports.getAssignedInterviewRooms=async()=>[]",
  '@/components/interview-kit-editor':"exports.ClubInterviewKitSettings=()=>null",
  '@/components/interview-access-setup':"exports.InterviewAccessSetup=()=>null",
  '@/components/interviews/interview-rooms-list':"exports.InterviewRoomsList=()=>require('react').createElement('p',null,'Assigned rooms')",
  '@/components/interviews/room-manager':`const React=require('react');exports.RoomManager=()=>{const[value,setValue]=React.useState('');React.useEffect(()=>{window.schedulerMounts=(window.schedulerMounts||0)+1;return()=>window.schedulerUnmounts=(window.schedulerUnmounts||0)+1},[]);return React.createElement('section',{'data-unsaved':value?'true':'false'},React.createElement('input',{'aria-label':'Scheduler draft',value,onChange:e=>setValue(e.target.value)}))}`,
 });
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?code:'<div id="root"></div><script src="/fixture.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.getByText('Assigned rooms').waitFor();assert.equal(await page.getByLabel('Scheduler draft').count(),0);
  const schedule=page.getByRole('tab',{name:'Scheduling',exact:true}),rooms=page.getByRole('tab',{name:'Interview rooms',exact:true});
  await schedule.click();await page.getByLabel('Scheduler draft').fill('Unsaved panel work');
  for(let i=0;i<6;i++){await rooms.click();await schedule.click();assert.equal(await page.getByLabel('Scheduler draft').inputValue(),'Unsaved panel work')}
  await page.evaluate(()=>{history.replaceState(null,'','?interviewTab=rooms');dispatchEvent(new PopStateEvent('popstate'))});await rooms.waitFor();await page.waitForFunction(()=>document.querySelector('[role="tab"][data-state="active"]').textContent==='Interview rooms');
  await page.evaluate(()=>{history.replaceState(null,'','?interviewTab=schedule');dispatchEvent(new PopStateEvent('popstate'))});await page.getByLabel('Scheduler draft').waitFor();assert.equal(await page.getByLabel('Scheduler draft').inputValue(),'Unsaved panel work');
  assert.deepEqual(await page.evaluate(()=>[window.schedulerMounts,window.schedulerUnmounts||0]),[1,0]);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});

test('retained real scheduler revalidates before reveal, keeps editor state, and conceals old data on denial',async()=>{
 const {fixture}=require('./helpers/scheduling-ui-fixture.cjs'),f=await fixture({pipeline:true}),browser=await chromium.launch({headless:true});
 const secondRound=require('node:crypto').randomUUID();f.mutate(s=>{const club=s.clubs.find(c=>c.id===f.scope.clubId),round=club.rounds.find(r=>r.id===f.scope.roundId);club.rounds.push({...round,id:secondRound,name:'Second retained round',order:round.order+1})});
 try{const page=await browser.newPage();page.setDefaultTimeout(10000);const calls=[];page.on('request',r=>{if(r.url().endsWith('/action'))calls.push(JSON.parse(r.postData()).name)});
  await page.goto(f.url+'?interviewTab=rooms&roundId='+f.scope.roundId);await page.getByRole('heading',{name:'Your interview rooms',exact:true}).waitFor();assert.equal(calls.includes('getRoomWorkspace'),false);
  const schedule=page.getByRole('tab',{name:'Scheduling',exact:true}),rooms=page.getByRole('tab',{name:'Interview rooms',exact:true});
  await schedule.click();await page.locator('.ir-manager').waitFor();await page.getByLabel('Filter interview date',{exact:true}).fill('2099-09-07');await rooms.click();
  let release,held;const barrier=new Promise(r=>release=r),arrived=new Promise(r=>held=r);
  await page.route('**/action',async route=>{if(JSON.parse(route.request().postData()).name==='getRoomWorkspace'){held();await barrier}await route.continue()});
  await schedule.click();await arrived;assert.equal(await page.locator('.ir-manager').isVisible(),false);release();await page.locator('.ir-manager').waitFor();assert.equal(await page.getByLabel('Filter interview date',{exact:true}).inputValue(),'2099-09-07');
  await page.unroute('**/action');await rooms.click();await page.evaluate(id=>{const url=new URL(location.href);url.searchParams.set('roundId',id);history.replaceState(null,'',url)},secondRound);await schedule.click();await page.waitForFunction(id=>document.querySelector('[aria-label="Recruitment round"]')?.value===id,secondRound);
  await rooms.click();await page.route('**/action',route=>JSON.parse(route.request().postData()).name==='getRoomWorkspace'?route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Access revoked'})}):route.continue());
  await schedule.click();await page.getByRole('alert').filter({hasText:'Check your current access'}).waitFor();assert.equal(await page.locator('.ir-manager').isVisible(),false);assert.equal(f.liveCalls(),0);
 }finally{await browser.close();await f.close()}
});
