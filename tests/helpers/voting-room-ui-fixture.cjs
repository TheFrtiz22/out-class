// Loopback-only UI/action integration. Synthetic identities stub Auth; not hosted Auth acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),postcss=require('postcss');
const {bundle}=require('./browser-bundle.cjs'),{harness,load,leaderId,voterId,clubId,cycleId,roundId,uuid}=require('./voting-room-harness.cjs');
async function fixture(){
 const h=harness();h.round.name='Synthetic interview round';h.cycle.name='Synthetic recruitment cycle';
 h.members[2].permissions=['applications.review','applicants.identify'];
 h.members[0].interviewOffices=['PRESIDENT'];
 h.tx.interviewResumeAnnotation={findMany:async()=>[{id:uuid(500),document:{id:uuid(501),roundId},anchor:{page:2,quote:'A leader-selected saved passage from a preserved fictional document. '.repeat(8)+'End of preserved excerpt.'}}]};
 h.tx.interviewPanelAssignment.findUnique=async()=>null;h.tx.evaluation={findUnique:async()=>null,findMany:async()=>[]};
 h.state().apps.forEach((a,i)=>{a.round=h.round;a.student={studentProfile:{firstName:'QA applicant',lastName:String(i+1)}}});h.members.forEach((m,i)=>m.user.studentProfile={firstName:'QA voter',lastName:String(i+1)});
 h.mocks['@/actions/applicant-intelligence'].getApplicantDisplay=async d=>({anonymous:false,visible:['name','major','academicYear','gpa','sat','act'],photo:null,sections:[{field:'name',items:[h.state().apps.find(a=>a.id===d.applicationId)?.student.studentProfile.lastName==='1'?'QA Applicant One':'QA Applicant Two']},{field:'major',items:['Economics']},{field:'academicYear',items:['Third year']},{field:'gpa',items:['3.8']},{field:'sat',items:['Not provided']},{field:'act',items:['Not provided']}]});
 const setup=load('actions/voting-room-setup.ts',h.mocks),final=load('actions/voting-room-finalization.ts',h.mocks),api={...h.api,...setup,...final};let sequence=Promise.resolve(),dropVote=false,dropFinal=false;
 const methods=['getLiveVotingSetup','getVotingHighlightOptions','createLiveVotingRoom','listLiveVotingRooms','getLiveVotingJoinInfo','joinLiveVotingRoom','getLiveVotingRoom','getLiveVotingPresentation','castLiveVotingBallot','commandLiveVotingRoom','getLiveVotingSummary','previewLiveVotingFinalization','finalizeLiveVotingRoom','sendLiveVotingNotifications'];
 const entry=`import React from'react';import{createRoot}from'react-dom/client';import{VotingRoomSetup}from'@/components/live-voting/room-setup';import{LiveVotingEntry}from'@/components/live-voting/room-view';const p=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(location.pathname.endsWith('/new')?<VotingRoomSetup clubId={window.initial.clubId} demoScoped={false}/>:<LiveVotingEntry clubId={window.initial.clubId} sessionId={location.pathname.split('/').at(-1)} view={p.get('view')||'member'} demoScoped={false}/>);`;
 const mocks={
  'next/image':`const React=require('react');module.exports=({unoptimized,...props})=>React.createElement('img',props)`,
  'next/link':`const React=require('react');module.exports=({href,children,...props})=>React.createElement('a',{...props,href},children)`,
  'next/navigation':`exports.useRouter=()=>({push:url=>location.href=url+('&actor='+new URLSearchParams(location.search).get('actor'))})`,
  '@/contexts/auth-context':`exports.useAuth=()=>({user:window.initial.user,loading:false})`,
  '@/contexts/demo-context':`exports.useDemoMode=()=>({ready:true,isDemoEnabled:false})`,
  '@/lib/voting-room-api':`async function call(name,input){const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,input,actor:new URLSearchParams(location.search).get('actor')})});const v=await r.json();if(!r.ok)throw Error(v.error);return v}${methods.map(n=>`exports.${n}=input=>call('${n}',input);`).join('')}`,
 };
 const js=bundle(entry,mocks),css=(await postcss([require('@tailwindcss/postcss')()]).process('@import "../app/globals.css";\n@import "../components/live-voting/room.css";',{from:path.resolve('tests/visual-fixture.css')})).css+'\n:root{--oc-font-sans:Arial,sans-serif;--oc-font-serif:Georgia,serif}';
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');if(u.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(js)}if(u.pathname==='/fixture.css'){res.setHeader('Content-Type','text/css');return res.end(css)}
  if(u.pathname==='/action'){let body='';for await(const c of req)body+=c;const d=JSON.parse(body);const op=sequence.then(async()=>{if(!methods.includes(d.name))throw Error('Unknown action');h.as(d.actor==='member'?voterId:d.actor==='outsider'?uuid(7):leaderId);const value=await api[d.name](d.input);if(dropVote&&d.name==='castLiveVotingBallot'){dropVote=false;throw Error('Injected lost response after commit')}if(dropFinal&&d.name==='finalizeLiveVotingRoom'){dropFinal=false;throw Error('Injected lost finalization response after commit')}return value});sequence=op.catch(()=>{});try{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await op))}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html lang="en"><head><title>OutClass voting acceptance fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>window.initial=${JSON.stringify({clubId,user:u.searchParams.get('actor')==='guest'?null:{id:u.searchParams.get('actor')==='member'?voterId:leaderId}})}</script><script src="/fixture.js"></script></body></html>`);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${server.address().port}`,h,dropVote:()=>dropVote=true,dropFinal:()=>dropFinal=true,clubId,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))}};
}
module.exports={fixture};
