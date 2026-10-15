// Loopback only, actual scheduling components and Demo actions. No hosted services.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),postcss=require('postcss')
const {bundle}=require('./browser-bundle.cjs'),{harness}=require('./demo-harness.cjs')
async function fixture({fresh=false,baseline}={}){
 const h=harness(),{demoStore,demoUser}=h.load('lib/demo/store.ts');demoStore.start(h.load('lib/demo/seed.ts').createDemoSeed('2099-09-07'))
 const s=demoStore.get(),club=s.clubs[0],room=s.interviewRooms.find(r=>r.clubId===club.id&&s.bookingFlow.settings[r.roundId]?.bookingPublishedAt)||s.interviewRooms.find(r=>r.clubId===club.id),roundId=room.roundId,scope={clubId:club.id,roundId},api=h.load('lib/workspace-api.ts'),user=demoUser(),writes=[]
 demoStore.mutate(s=>s.perspective={role:'leader',clubId:club.id})
 if(fresh)demoStore.mutate(s=>{s.interviewRooms=s.interviewRooms.filter(r=>r.clubId!==club.id||r.roundId!==roundId);s.roomBookings=s.roomBookings.filter(b=>b.roundId!==roundId);s.slots=s.slots.filter(b=>b.clubId!==club.id);delete s.bookingFlow.panels[roundId];delete s.bookingFlow.settings[roundId];delete s.bookingFlow.publishedSlots[roundId]})
 const application=demoStore.get().applications.find(a=>a.clubId===club.id&&a.roundId===roundId&&a.studentId===s.students[0].id&&a.status==='INTERVIEWING')
 if(!application)throw Error('Missing eligible synthetic applicant')
 const calls=['getRoomWorkspace','createInterviewRoom','setInterviewRoomOpen','setInterviewStaffingRequirement','getPanelProposalWorkspace','beginPanelScheduleRevision','generatePanelProposal','savePanelProposalDraft','discardPanelProposal','revalidatePanelDraft','reviewPanelPublication','publishPanelSchedule','assignPanelAvailabilityOverride','revokePanelAvailabilityOverride','getInterviewBookingPublication','setInterviewBookingPublication','getApplicantSchedule','reserveInterview','cancelRoomBooking']
 const entry=`import React from'react';import{createRoot}from'react-dom/client';import{RoomManager}from'@/components/interviews/room-manager';import{ApplicantBooking}from'@/components/interviews/applicant-booking';createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-6xl p-5">{new URLSearchParams(location.search).has('applicant')?<ApplicantBooking applicationId={window.initial.applicationId}/>:<RoomManager clubId={window.initial.club.id}/>}</main>);`
 const mocks={
  '@/contexts/demo-context':"exports.useDemoMode=()=>({ready:true,isDemoEnabled:true})",
  '@/contexts/auth-context':"exports.useAuth=()=>({user:window.initial.user,loading:false})",
  '@/components/availability/admin-overview':"exports.AdminAvailabilityOverview=()=>require('react').createElement('p',null,'Team availability (unchanged component mocked in this isolated scheduling fixture)')",
  '@/components/availability/availability-button':"exports.AvailabilityButton=()=>null",
  '@/lib/availability-workspace-read':"exports.getRoundStaffingCoverage=()=>{throw Error('Live coverage forbidden in Demo')}",
  '@/lib/workspace-api':`async function call(name,args){const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,role:new URLSearchParams(location.search).has('applicant')?'student':'leader'})});const v=await r.json();if(!r.ok)throw Error(v.error);return v}${calls.map(name=>`exports.${name}=(...args)=>call('${name}',args);`).join('')}`,
 }
 if(baseline){const ts=require('typescript'),cp=require('node:child_process');for(const name of ['room-manager','create-room-dialog','panel-preview-workspace','booking-publication']){const file='components/interviews/'+name+'.tsx',source=cp.execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',windowsHide:true}).replaceAll('"./','"@/components/interviews/').replaceAll('"lucide-react"','"@/components/icons"');mocks['@/components/interviews/'+name]=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText}}
 const js=bundle(entry,mocks)
 const css=(await postcss([require('@tailwindcss/postcss')()]).process('@import "../app/globals.css";\n@import "../components/interviews/scheduling.css";',{from:path.resolve('tests/visual-fixture.css')})).css+'\n:root{--font-dm-sans:Arial;--font-libre-caslon-text:Georgia}'
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname
  if(pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(js);return}
  if(pathname==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);return}
  if(pathname==='/action'){let body='';for await(const chunk of req)body+=chunk;const {name,args,role}=JSON.parse(body);try{if(!calls.includes(name))throw Error('Unknown fixture action');demoStore.mutate(s=>s.perspective={role:role==='student'?'student':'leader',clubId:club.id});if(!name.startsWith('get'))writes.push({name,args});const result=await api[name](...args);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result??null))}catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}))}return}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script>window.initial=${JSON.stringify({club,user,applicationId:application.id}).replaceAll('<','\\u003c')}</script><script src="/fixture.js"></script>`)
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 return {url:`http://127.0.0.1:${server.address().port}`,scope,applicationId:application.id,writes,api,state:()=>demoStore.get(),asLeader:()=>demoStore.mutate(s=>s.perspective={role:'leader',clubId:club.id}),mutate:fn=>demoStore.mutate(fn),liveCalls:h.calls,close:async()=>{demoStore.stop();server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
module.exports={fixture}
