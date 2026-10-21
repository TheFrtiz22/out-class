// Loopback fixture: real React workflows, private drafts, and canonical voting actions.
// Members/meetings/announcements use a disposable in-memory action adapter. No hosted services.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),postcss=require('postcss'),{randomUUID}=require('node:crypto')
const {bundle}=require('./browser-bundle.cjs'),voting=require('./voting-harness.cjs')
async function fixture(){
 const vote=voting.harness(),clubId=voting.clubId,now=new Date(),writes=[],reads=[],failures=new Map(),drafts=new Map()
 const member=(id,name,accessRole='MEMBER')=>({id,userId:id,clubId,status:'ACTIVE',accessRole,isOwner:accessRole==='OWNER',permissions:accessRole==='OWNER'?[]:['applications.review','decisions.vote'],updatedAt:now,joinedAt:now,groups:['Research'],cohort:'Fall 2026',role:'GENERAL_MEMBER',title:null,interviewerEligible:null,user:{email:name.toLowerCase()+'@virginia.edu',disabledAt:null,studentProfile:{firstName:name,lastName:'Sample',academicYear:'Third Year',gradYear:2028,major:'Economics'}}})
 const actor=member(voting.memberId,'Jesse','OWNER'),directory={actor,members:[actor,member(voting.otherId,'Avery')],invitations:[{id:randomUUID(),requestedRole:'MEMBER',permissions:[],status:'PENDING',invitedName:'Jordan Pending',invitedYear:'2029',email:'jordan@virginia.edu',expiresAt:new Date(Date.now()+86400000),deliveries:[],schoolIdentity:{normalizedIdentifier:'jp4test'}}],identifierTypes:[{id:randomUUID(),label:'UVA computing ID'}]}
 const user={id:actor.userId,memberships:[{...actor,club:{id:clubId,name:'OutClass Test Club'}}]},meetings=[],announcements=[]
 const {meetingInputSchema}=voting.load('lib/meetings.ts')
 const catalog={groups:[],cohorts:[],cycles:[],rounds:[],events:[],canEdit:true}
 const eligibility={revision:0,roles:['MEMBER'],members:directory.members.map(m=>({id:m.id,name:m.user.studentProfile.firstName,role:m.accessRole,rounds:[],override:null})),rounds:[{id:voting.roundId,name:'Interviews'}]}
 async function call(name,args){
  if(failures.has(name)){const message=failures.get(name);failures.delete(name);throw Error(message)}
  if(name.startsWith('get')||name.startsWith('list')||name.startsWith('preview'))reads.push(name);else writes.push({name,args:structuredClone(args)})
  if(name in vote.api)return vote.api[name](...args)
  switch(name){
   case 'getOrganizationMemberManagement':case 'getClubAccess':return directory
   case 'addClubMember':directory.members.push(member(randomUUID(),args[1].split('@')[0]));return {success:true}
   case 'inviteOrganizationMember':directory.invitations.push({id:randomUUID(),...args[0],status:'PENDING',permissions:[],email:args[0].identifier+'@virginia.edu',expiresAt:new Date(Date.now()+86400000),deliveries:[]});return {id:directory.invitations.at(-1).id}
   case 'getInterviewerEligibility':return eligibility
   case 'setInterviewerEligibility':if(args[0].roles)eligibility.roles=args[0].roles;eligibility.revision++;return {success:true}
   case 'getInvitationSchedules':case 'getCommunicationSchedules':case 'getDecisionSchedules':return []
   case 'listMeetings':return meetings
   case 'getMeeting':return meetings.find(m=>m.id===args[0])
   case 'meetingAttendance':return []
   case 'saveMeeting':{const parsed=meetingInputSchema.parse(args[0]);let meeting=meetings.find(m=>m.id===parsed.id);if(meeting){if(meeting.revision!==parsed.revision)throw Error('Meeting changed. Reload before saving.');Object.assign(meeting,parsed,{revision:meeting.revision+1})}else meetings.push({...parsed,id:randomUUID(),club:{name:'OutClass Test Club'},isPublic:true});return {success:true}}
   case 'getClubAnnouncements':return announcements
   case 'getRecipientGroups':return catalog
   case 'previewRecipientAudience':return {count:directory.members.length,evaluatedAt:new Date(),recipients:directory.members.map(m=>({id:m.userId,email:m.user.email,studentProfile:m.user.studentProfile}))}
   case 'publishClubAnnouncement':announcements.unshift({...args[0],id:randomUUID(),publishedAt:new Date(),_count:{notifications:directory.members.length}});return {recipientCount:directory.members.length}
   case 'getEditorDraft':return drafts.get(JSON.stringify(args[0]))??null
   case 'saveEditorDraft':{const input=args[0],key=JSON.stringify(input.scope),revision=(drafts.get(key)?.revision??0)+1;drafts.set(key,{...input,revision});return {revision}}
   default:throw Error('Unexpected fixture action: '+name)
  }
 }
 const groups={
  '@/lib/workspace-read':['getOrganizationMemberManagement'],
  '@/actions/club-access':['addClubMember','getClubAccess','inviteClubManager','updateClubAccess','revokeClubInvitation'],
  '@/actions/organization-members':['inviteOrganizationMember','changeOrganizationMemberRole','removeOrganizationMember','transferOrganizationOwnership','manageOrganizationInvitation','bulkOrganizationMembers','bulkOrganizationInvitations'],
  '@/actions/invitation-emails':['sendRosterInvitations','requestInvitationDelivery'],
  '@/actions/roster-import':['previewRosterImport','confirmRosterImport'],
  '@/actions/availability':['getInterviewerEligibility','setInterviewerEligibility'],
  '@/actions/recipient-groups':['getRecipientGroups','previewRecipientAudience','saveRecipientGroup','deleteRecipientGroup'],
  '@/actions/communications':['getClubAnnouncements','publishClubAnnouncement'],
  '@/actions/communication-schedules':['getCommunicationSchedules','saveCommunicationSchedule','cancelCommunicationSchedule'],
  '@/actions/editor-drafts':['getEditorDraft','saveEditorDraft'],
  '@/lib/workspace-api':['listMeetings','saveMeeting','getMeeting','issueMeetingCheckIn','closeMeetingCheckIn','meetingAttendance','updateTaskMember','previewInvitationSchedule','saveInvitationSchedule','getInvitationSchedules','cancelInvitationSchedule','scheduleDecisionPublication','getDecisionSchedules','cancelDecisionSchedule','getVotingWorkspace','createVotingSession','submitVotingBallot','commandVotingSession','seedVotingDemo']
 }
 const rpc=`async function call(name,args){const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});const data=await r.json();if(!r.ok)throw Error(data.error);return data}`
 const mocks=Object.fromEntries(Object.entries(groups).map(([module,names])=>[module,rpc+names.map(name=>`exports.${name}=(...args)=>call('${name}',args);`).join('')]))
 Object.assign(mocks,{
  '@/contexts/auth-context':`exports.useAuth=()=>({user:window.initial.user,refreshUser:async()=>{},loading:false})`,
  '@/contexts/demo-context':`exports.useDemoMode=()=>({isDemoEnabled:false,ready:true})`,
  'next/link':`const React=require('react');module.exports=({children,href,...props})=>React.createElement('a',{href,...props},children)`,
  'next/navigation':`exports.useSearchParams=()=>new URLSearchParams(location.search)`,
  // Shared applicant display has its own rendering/privacy tests; this isolates session orchestration.
  '@/components/applicant-intelligence':`const React=require('react');exports.ApplicantDisplayPanel=({onFitChange})=>{React.useEffect(()=>{onFitChange?.(true)},[onFitChange]);return React.createElement('p',null,'Synthetic candidate preview')}`,
 })
 const initial={user,clubId,applicants:vote.state().apps,rounds:[{id:voting.roundId,name:'Review'}]}
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{OrganizationMemberManagement}from'@/components/organization-member-management';import{MeetingList}from'@/components/meeting-workspace';import{ClubAnnouncements}from'@/components/club-announcements';import{BoardDecisionMode}from'@/components/live-voting/board-decision-mode';const screen=new URLSearchParams(location.search).get('screen');createRoot(document.getElementById('root')).render(<main id="workspace-content" tabIndex={-1} className="mx-auto max-w-5xl p-5"><h1 className="mb-6 text-2xl">{screen}</h1>{screen==='members'?<OrganizationMemberManagement clubId={window.initial.clubId}/>:screen==='announcements'?<ClubAnnouncements clubId={window.initial.clubId}/>:screen==='voting'?<BoardDecisionMode {...window.initial} clubName="Test Club" canDecide onDecision={()=>{}}/>:<MeetingList clubId={window.initial.clubId} embedded/>}</main>);`,mocks)
 const css=(await postcss([require('@tailwindcss/postcss')()]).process('@import "../app/globals.css";\n@import "../components/shell/responsive-workspace.css";\n@import "../components/availability/availability.css";\n@import "../components/live-voting/voting-mode.css";',{from:path.resolve('tests/visual-fixture.css')})).css
 const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return}if(url.pathname==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);return}if(url.pathname==='/action'){let body='';for await(const chunk of req)body+=chunk;try{const {name,args}=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await call(name,args)))}catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}))}return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="en"><head><title>OutClass club workflow verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>window.initial=${JSON.stringify(initial).replaceAll('<','\\u003c')}</script><script src="/fixture.js"></script></body></html>`)})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 return {url:`http://127.0.0.1:${server.address().port}`,writes,reads,meetings,announcements,directory,vote,failNext:(name,message)=>failures.set(name,message),close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}}
}
module.exports={fixture}
