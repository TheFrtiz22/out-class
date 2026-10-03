import type * as Live from "@/actions/voting"
import { demoStore, demoMember } from "./store"
import { summarizeVoting, createVotingSchema, votingCommandSchema, votingScope, decisionSchema } from "@/lib/voting-engine"
import { z } from "zod"
type Workspace=Awaited<ReturnType<typeof Live.getVotingWorkspace>>
type Session=NonNullable<Workspace["session"]>
function context(clubId:string){const d=demoStore.get();if(d.perspective.role!=="leader"||d.perspective.clubId!==clubId)throw Error("Choose this club's leader perspective.");return d}
function sessions(){return demoStore.get().votingSessions??=[]}
function audit(action:string,sessionId:string){demoStore.get().votingAudit??=[];demoStore.get().votingAudit.push({action,sessionId,at:new Date()})}
export async function getVotingWorkspace(clubId:string,sessionId?:string):Promise<Workspace>{
 const d=context(clubId),m=demoMember()!,club=d.clubs.find(c=>c.id===clubId)!
 const s=sessionId?sessions().find(s=>s.id===sessionId&&s.clubId===clubId):sessions().filter(s=>s.clubId===clubId).at(-1)
 return {sessions:sessions().filter(s=>s.clubId===clubId).map(({id,state,currentPass,createdAt})=>({id,state,currentPass,createdAt})),session:s??null,summary:s?summarizeVoting(s):null,memberId:m.id,canManage:true,canStart:true,canFinish:true,canReopen:true,canPublish:true,canVote:!!s?.participants.some(p=>p.memberId===m.id),eligible:d.memberships.filter(m=>m.clubId===clubId).map(m=>({id:m.id,label:d.students.find(u=>u.id===m.userId)?.email??m.id})),rounds:club.rounds.map(r=>({id:r.id,name:r.name})),graduationYears:s?s.candidates.map(c=>{const a=d.applications.find(a=>a.id===c.applicationId)!,p=d.students.find(u=>u.id===a.studentId)?.profile;return{id:c.applicationId,student:{studentProfile:p?{gradYear:p.gradYear}:null}}}):[]}
}
function create(input:unknown){
 const d=createVotingSchema.parse(input),state=context(d.clubId),now=new Date()
 if(new Set(d.applicationIds).size!==d.applicationIds.length||new Set(d.participantIds).size!==d.participantIds.length)throw Error("Duplicate selection.")
 const apps=d.applicationIds.map(id=>state.applications.find(a=>a.id===id&&a.clubId===d.clubId&&a.roundId===d.roundId&&a.status!=="DRAFTING"))
 if(apps.some(a=>!a)||!state.clubs.find(c=>c.id===d.clubId)?.rounds.some(r=>r.id===d.roundId)||d.participantIds.some(id=>!state.memberships.some(m=>m.id===id&&m.clubId===d.clubId)))throw Error("Invalid demo selection.")
 const s:Session={id:crypto.randomUUID(),clubId:d.clubId,roundId:d.roundId,state:"DRAFT",targetSize:d.targetSize,autoAdvance:d.autoAdvance,threshold:d.threshold,currentPass:0,revision:0,createdBy:demoMember()!.userId,startedAt:null,endedAt:null,publishedAt:null,publishedBy:null,createdAt:now,updatedAt:now,participants:d.participantIds.map(memberId=>({sessionId:"",memberId})),candidates:apps.map((a,position)=>({sessionId:"",applicationId:a!.id,position,expectedStatus:a!.status,publishedStatus:null})),passes:[]}
 for(const p of s.participants)p.sessionId=s.id;for(const c of s.candidates)c.sessionId=s.id
 sessions().push(s);audit("voting.session.created",s.id);return s.id
}
function submit(input:unknown){
 const d=votingScope.extend({passNumber:z.number().int().positive(),applicationId:z.string().uuid(),decision:decisionSchema}).parse(input);context(d.clubId)
 const s=sessions().find(s=>s.id===d.sessionId&&s.clubId===d.clubId),m=demoMember()!,p=s?.passes.find(p=>p.number===d.passNumber),c=p?.candidates.find(c=>c.applicationId===d.applicationId)
 if(!s||s.state!=="OPEN"||p?.state!=="OPEN"||s.currentPass!==d.passNumber||!c||!s.participants.some(v=>v.memberId===m.id)||c.ballots.some(b=>b.memberId===m.id))throw Error("Ballot unavailable or already recorded.")
 c.ballots.push({id:crypto.randomUUID(),sessionId:s.id,passNumber:p.number,applicationId:c.applicationId,memberId:m.id,decision:d.decision,createdAt:new Date()});s.revision++;audit("voting.ballot.submitted",s.id);return{success:true}
}
function command(input:unknown){
 const d=votingCommandSchema.parse(input),state=context(d.clubId),s=sessions().find(s=>s.id===d.sessionId&&s.clubId===d.clubId)
 if(!s||s.publishedAt||s.revision!==d.revision)throw Error("Session changed or sealed.")
 const p=s.passes.at(-1),summary=summarizeVoting(s),now=new Date()
 switch(d.action){
 case "START_PASS":{if(!["DRAFT","PAUSED"].includes(s.state)||p?.state==="OPEN")throw Error("Complete current pass first.");const ids=d.applicationIds??summary.outcomes.filter(o=>["HOLD","UNRESOLVED"].includes(o.outcome)).map(o=>o.applicationId);if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!s.candidates.some(c=>c.applicationId===id)))throw Error("Select session candidates.");s.currentPass++;s.passes.push({sessionId:s.id,number:s.currentPass,state:"OPEN",startedAt:now,completedAt:null,candidates:ids.map((applicationId,position)=>({sessionId:s.id,passNumber:s.currentPass,applicationId,position,override:null,overrideBy:null,overrideAt:null,ballots:[]}))});s.state="OPEN";s.startedAt??=now;break}
 case "COMPLETE_PASS":if(!p||p.state!=="OPEN")throw Error("No open pass.");p.state="COMPLETED";p.completedAt=now;s.state="PAUSED";break
 case "PAUSE":if(s.state!=="OPEN")throw Error("Not open.");s.state="PAUSED";break
 case "RESUME":if(s.state!=="PAUSED"||p?.state!=="OPEN")throw Error("No open pass.");s.state="OPEN";break
 case "FINISH":if(s.state!=="PAUSED"||p?.state!=="COMPLETED")throw Error("Complete pass first.");s.state="COMPLETED";s.endedAt=now;break
 case "REOPEN":if(s.state!=="COMPLETED")throw Error("Not completed.");s.state="PAUSED";s.endedAt=null;break
 case "CONFIGURE":if(!d.targetSize||s.state==="COMPLETED")throw Error("Target unavailable.");s.targetSize=d.targetSize;break
 case "OVERRIDE":{if(s.state==="COMPLETED"||!d.reason||!d.decision)throw Error("Provide reason and decision.");const c=[...s.passes].reverse().flatMap(p=>p.candidates).find(c=>c.applicationId===d.applicationId);if(!c)throw Error("Candidate unavailable.");c.override=d.decision;c.overrideBy=demoMember()!.userId;c.overrideAt=now;break}
 case "PUBLISH":{if(s.state!=="COMPLETED"||!d.applicationIds?.length)throw Error("Finish and select decisions.");const changes=d.applicationIds.map(id=>{const o=summary.outcomes.find(o=>o.applicationId===id),c=s.candidates.find(c=>c.applicationId===id),a=state.applications.find(a=>a.id===id);if(!o||o.outcome==="UNRESOLVED"||!c||!a||a.status!==c.expectedStatus)throw Error("Application changed or unresolved.");return{o,c,a}});for(const {o,c,a}of changes){a.status=o.outcome==="PASS"?"ACCEPTED":o.outcome==="HOLD"?"WAITLISTED":"REJECTED";c.publishedStatus=a.status}s.publishedAt=now;s.publishedBy=demoMember()!.userId;break}
 }
 s.revision++;s.updatedAt=now;audit(`voting.${d.action.toLowerCase()}`,s.id);return{success:true}
}
export async function createVotingSession(input:unknown){return demoStore.mutate(()=>create(input))}
export async function submitVotingBallot(input:unknown){return demoStore.mutate(()=>submit(input))}
export async function commandVotingSession(input:unknown){return demoStore.mutate(()=>command(input))}
/** Explicit deterministic example, using real demo candidates and two preserved passes. */
export async function seedVotingDemo(clubId:string){
 const d=context(clubId),apps=d.applications.filter(a=>a.clubId===clubId&&a.status!=="DRAFTING"),first=apps[0];if(!first)return
 const pool=apps.filter(a=>a.roundId===first.roundId).slice(0,6);if(pool.length<3)return
 const id=await createVotingSession({clubId,roundId:first.roundId,applicationIds:pool.map(a=>a.id),participantIds:[demoMember()!.id],targetSize:2})
 const cmd=(action:string,extra={})=>commandVotingSession({clubId,sessionId:id,revision:sessions().find(s=>s.id===id)!.revision,action,...extra})
 await cmd("START_PASS");for(const [i,a]of pool.entries())await submitVotingBallot({clubId,sessionId:id,passNumber:1,applicationId:a.id,decision:i===0?"PASS":i===1?"HOLD":i===2?"NOT_PASS":"HOLD"})
 await cmd("COMPLETE_PASS");await cmd("START_PASS");await submitVotingBallot({clubId,sessionId:id,passNumber:2,applicationId:pool[1].id,decision:"HOLD"});return id
}
