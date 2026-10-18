const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {bundle}=require('./browser-bundle.cjs'),{harness}=require('./demo-harness.cjs');
async function fixture(port=0){
 const h=harness(),seed=h.load('lib/demo/seed.ts').createDemoSeed('2026-10-18'),clubId=seed.clubs[0].id;seed.perspective={role:'leader',clubId};
 const mocks={
  'next/link':`const React=require('react');module.exports=({href,children,prefetch,...props})=>React.createElement('a',{...props,href,onClick:e=>{if(!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState(null,'',href)}}},children);`,
  '@/contexts/auth-context':`const store=require('@/lib/demo/store');const user=store.demoUser();exports.useAuth=()=>({user,loading:false,activeClubId:user.memberships[0].clubId,selectClub(){}});`,
  '@/contexts/demo-context':`exports.useDemoMode=()=>({ready:true,isDemoEnabled:true});`,
  '@/lib/application-state':`exports.useApplicationState=()=>({leaderFocus:null,clearLeaderFocus(){}});`,
  '@/components/demo-workspace':`exports.DemoInterviewGuide=()=>null;`,
  '@/components/interview-applicant-panel':`exports.InterviewApplicantPanel=()=>null;`,
  '@/components/interview-kit-session':`const React=require('react'),api=require('@/lib/workspace-api');exports.InterviewKitSession=props=>{const[session,setSession]=React.useState(null);React.useEffect(()=>{api.openInterviewSession({clubId:props.clubId,applicationId:props.applicationId,roundId:props.roundId}).then(setSession)},[props.applicationId,props.roundId]);return React.createElement('section',{'aria-label':'Exact room fixture'},props.toolbar(),React.createElement('h1',null,'Interview '+props.applicationId),React.createElement('p',{'data-testid':'round'},props.roundId),React.createElement('p',{'data-testid':'phase'},!session?'Loading':session.completedAt?'Read only':session.draft.postInterview?'Post-interview':'Active interview'));};`,
  '@/components/interview-kit-editor':`exports.ClubInterviewKitSettings=()=>null;`,
  '@/components/interviews/room-manager':`exports.RoomManager=()=>null;`,
  '@/components/interview-resume-moderation':`exports.InterviewResumeModeration=()=>null;`,
  '@/components/interview-submitted-reviews':`exports.InterviewSubmittedReviews=()=>null;`,
  '@/components/interview-access-setup':`exports.InterviewAccessSetup=()=>null;`,
  '@/lib/workspace-api':`const f=require('@/lib/demo/interview-foundation'),e=require('@/lib/demo/interview-entry');for(const [key,fn]of Object.entries({...f,...e}))if(typeof fn==='function')exports[key]=(...args)=>Promise.resolve().then(()=>{if(window.fixtureFail)throw Error('Synthetic request failure');return fn(...args)});`,
 };
 const entry=`import React,{useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';import{demoStore}from'@/lib/demo/store';import{createDemoSeed}from'@/lib/demo/seed';const seed=createDemoSeed('2026-10-18');seed.perspective={role:'leader',clubId:'${clubId}'};demoStore.start(seed);`+
 `const auth=require('@/contexts/auth-context');const{InterviewManagementTabs}=require('@/components/interview-management-tabs');const{InterviewWorkspaceView}=require('@/components/views/interview-workspace-view');const{interviewListHref}=require('@/lib/interview-entry');`+
 `for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);dispatchEvent(new Event('popstate'))}}const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};function App(){const href=useSyncExternalStore(subscribe,()=>location.href),q=new URL(href).searchParams;return <main className="mx-auto max-w-6xl space-y-5 p-5 sm:p-8"><p className="text-xs text-muted-foreground">Isolated synthetic preview · no live connections</p>{q.get('interview')==='1'?<InterviewWorkspaceView scoped onExit={()=>history.replaceState(null,'',interviewListHref('${clubId}',location.search))}/>:<><header><p className="text-sm text-muted-foreground">McIntire Investment Institute</p><h1 className="font-serif text-3xl">Interviews</h1></header><InterviewManagementTabs key={q.get('interviewTab')||'rooms'} clubId="${clubId}" initialTab={q.get('interviewTab')||undefined}/></>}</main>}createRoot(document.getElementById('root')).render(<App/>);`;
 const js=bundle(entry,mocks),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-entry-'));
 cp.execFileSync(process.execPath,[path.join(__dirname,'interview-browser-css.cjs'),path.join(tmp,'style.css')],{windowsHide:true});
 const css=':root{--font-dm-sans:Arial,sans-serif;--font-libre-caslon-text:Georgia,serif}body{font-family:Arial,sans-serif}'+fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/clubs/interview-kit-editor.css','utf8');
 const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/fixture.js'?js:req.url==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>')});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));return{server,base:`http://127.0.0.1:${server.address().port}`,clubId};
}
module.exports={fixture};if(require.main===module)fixture(4319).then(f=>console.log('Isolated interview entry preview: '+f.base+'/club/'+f.clubId+'/workspace?section=recruitment&tool=interviews'));
