/** Real Next App Router + production NotificationCenter; no Auth, DB or production traffic. */
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const repo=path.resolve(__dirname,'..');
async function main(){
const root=await fs.mkdtemp(path.join(os.tmpdir(),'outclass-notification-router-'));let server,browser;let output='';
try{
await fs.symlink(path.join(repo,'node_modules'),path.join(root,'node_modules'),'junction');
await fs.mkdir(path.join(root,'app/club/fixture/workspace'),{recursive:true});
await fs.writeFile(path.join(root,'package.json'),JSON.stringify({private:true,scripts:{build:'next build'},dependencies:{next:'15.5.27',react:'19.2.0','react-dom':'19.2.0'}}));
const aliases={'@/lib/application-state$':path.join(root,'boundary.jsx'),'@/contexts/organization-invitations-context$':path.join(root,'boundary.jsx'),'@/components/organization-invitation-card$':path.join(root,'invitation.jsx'),'@/components/shell/notification-center$':path.join(root,'notification-center.tsx'),'@':repo};
await fs.writeFile(path.join(root,'notification-center.tsx'),await fs.readFile(process.env.OUTCLASS_NOTIFICATION_SOURCE||path.join(repo,'components/shell/notification-center.tsx')));
await fs.copyFile(path.join(repo,'components/shell/notification-center.css'),path.join(root,'notification-center.css'));
await fs.writeFile(path.join(root,'next.config.js'),`module.exports={experimental:{externalDir:true,cpus:2},typescript:{ignoreBuildErrors:true},eslint:{ignoreDuringBuilds:true},webpack(c){Object.assign(c.resolve.alias,${JSON.stringify(aliases)});return c}}`);
await fs.writeFile(path.join(root,'invitation.jsx'),'export const OrganizationInvitationCard=()=>null');
await fs.writeFile(path.join(root,'app/actions.js'),`'use server';export async function markRead(fail){await new Promise(r=>setTimeout(r,50));return !fail}`);
await fs.writeFile(path.join(root,'boundary.jsx'),`'use client';import React,{createContext,useContext,useState}from'react';import{markRead}from'./app/actions';const Context=createContext(null);export function Provider({children}){const[read,setRead]=useState(false);const state={notifications:[{id:'durable-assignment',durableId:'assignment',type:'Interview Invite',title:'Synthetic assignment',preview:'Fictional candidate',body:['Fictional candidate'],club:'QA club',read,createdAt:'2026-10-21T10:00:00Z',href:'/club/fixture/workspace?interview=1&clubId=fixture&applicationId=candidate&roundId=round&roomId=room&slotId=slot&bookingId=booking'}],trackedApps:[],markNotificationRead:async()=>{window.readCalls=(window.readCalls||0)+1;setRead(true);const ok=await markRead(window.failRead);if(!ok)setRead(false);window.readSettled=true;return ok},setNotificationsRead:async()=>{setRead(true);return true},markAllNotificationsRead:async()=>true,deleteNotifications:async()=>true};return <Context.Provider value={state}>{children}</Context.Provider>}export const useApplicationState=()=>useContext(Context);export const useOrganizationInvitations=()=>({invitations:[],failed:false,refresh(){},changed(){}});`);
await fs.writeFile(path.join(root,'app/layout.jsx'),`import {Provider} from '../boundary';export default function Layout({children}){return <html><body><Provider>{children}</Provider></body></html>}`);
await fs.writeFile(path.join(root,'app/club/fixture/workspace/page.jsx'),`'use client';import{NotificationCenter}from'@/components/shell/notification-center';import{useApplicationState}from'../../../../boundary';import{useSearchParams}from'next/navigation';import{Suspense}from'react';function Screen(){const s=useApplicationState(),p=useSearchParams();return <><NotificationCenter unread={s.notifications.filter(n=>!n.read).length} pendingInvitations={0} loadState={{loading:false,failed:false}} onRetry={()=>{}} onNavigate={()=>{}}/><h1>{p.has('interview')?'Assigned synthetic interview':'QA overview'}</h1></>}export default function Page(){return <Suspense><Screen/></Suspense>}`);
const command=async args=>{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),...args],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>{output+=b});child.stderr.on('data',b=>{output+=b});child.on('exit',c=>c?reject(Error('Fixture build failed: '+output.slice(-2000))):resolve());});};
await command(['build']);
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b});server.stderr.on('data',b=>{output+=b});
const base='http://127.0.0.1:'+port;await new Promise((resolve,reject)=>{const end=Date.now()+30000;async function probe(){try{await fetch(base+'/club/fixture/workspace');resolve()}catch{if(Date.now()>end)reject(Error('Fixture start timeout'));else setTimeout(probe,100)}}probe()});
browser=await chromium.launch({headless:true,channel:'chrome'});
for(const scenario of ['unread-mouse','already-read','read-failure','keyboard','touch','double-click','dirty-guard']){
const context=await browser.newContext({hasTouch:scenario==='touch'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('FIXTURE ERROR',e.message)});page.setDefaultTimeout(8000);
await page.goto(base+'/club/fixture/workspace');await page.getByRole('button',{name:/^Notifications/}).click();const link=page.getByRole('link',{name:/Synthetic assignment/});await link.waitFor();
if(scenario==='already-read'){await page.getByRole('button',{name:'Actions for Synthetic assignment'}).click();await page.getByRole('menuitem',{name:'Mark read',exact:true}).click();await page.waitForFunction(()=>document.querySelector("[data-notification-id]")?.dataset.unread==="false");await page.evaluate(()=>{window.readCalls=0})}
if(scenario==='read-failure')await page.evaluate(()=>{window.failRead=true});
if(scenario==='dirty-guard')await page.evaluate(()=>{const el=document.createElement('div');el.dataset.saving='true';document.body.append(el)});
if(scenario==='keyboard')await link.press('Enter');else if(scenario==='touch')await link.tap();else if(scenario==='double-click')await link.evaluate(el=>{el.click();el.click()});else await link.click();
if(scenario==='dirty-guard'){assert.equal(new URL(page.url()).search,'');assert.equal(await page.evaluate(()=>window.readCalls||0),0)}else{
await page.waitForURL('**bookingId=booking',{timeout:8000});await page.getByRole('heading',{name:'Assigned synthetic interview'}).waitFor();
await page.waitForFunction(()=>window.readSettled||!window.readCalls,{},{timeout:8000});assert.equal(await page.evaluate(()=>window.readCalls||0),scenario==='already-read'?0:1);
assert.equal(new URL(page.url()).search,'?interview=1&clubId=fixture&applicationId=candidate&roundId=round&roomId=room&slotId=slot&bookingId=booking');
if(scenario==='read-failure'){await page.getByRole('button',{name:/^Notifications/}).click();await page.getByRole('alert').filter({hasText:'update notifications'}).waitFor();assert.equal(await page.locator('[data-notification-id="durable-assignment"]').getAttribute('data-unread'),'true')}
}
assert.deepEqual(errors,[]);console.log('PASS real Next router '+scenario);await context.close();
}
}finally{await browser?.close();server?.kill();if(server)await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await fs.rm(root,{recursive:true,force:true,maxRetries:3});}
}
main().catch(e=>{console.error(e);process.exitCode=1});




