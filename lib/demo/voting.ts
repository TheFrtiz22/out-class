import { academicYear } from "@/lib/recruitment-profile";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import type * as Live from "@/actions/voting"
import { demoStore, demoMember } from "./store"
import { summarizeVoting, projectLegacyVoting, votingCommandSchema } from "@/lib/voting-engine"

type Workspace=Awaited<ReturnType<typeof Live.getVotingWorkspace>>
type Projected=NonNullable<Workspace["session"]>
/** Stored Demo session (unprojected): ballots of every member, no ballotCount. */
export type DemoVotingSession=Omit<Projected,"passes">&{passes:(Omit<Projected["passes"][number],"candidates">&{candidates:Omit<Projected["passes"][number]["candidates"][number],"ballotCount">[]})[]}
function context(clubId:string,participant=false){const d=demoStore.get();if((!participant&&d.perspective.role!=="leader")||d.perspective.clubId!==clubId||clubId!==d.clubs[0].id)throw Error("Choose this club's leader perspective.");return d}
function sessions(){return demoStore.get().votingSessions??=[]}
function audit(action:string,sessionId:string){demoStore.get().votingAudit??=[];demoStore.get().votingAudit.push({action,sessionId,at:new Date()})}
export async function getVotingWorkspace(clubId:string,sessionId?:string,participantView=false,viewerId?:string):Promise<Workspace>{
 const d=context(clubId,participantView),m=demoMember()!,viewer=viewerId??m.id,club=d.clubs.find(c=>c.id===clubId)!
 const s=sessionId?sessions().find(s=>s.id===sessionId&&s.clubId===clubId):sessions().filter(s=>s.clubId===clubId).at(-1)
 return {candidateSelection:null,candidateLabels:s?s.candidates.map(c=>{const a=d.applications.find(a=>a.id===c.applicationId),p=a?d.students.find(u=>u.id===a.studentId)?.profile:null,anon=club.rounds.find(r=>r.id===s.roundId)?.anonymousReview;return{id:c.applicationId,label:p&&!anon?`${p.firstName} ${p.lastName}`:anonymousApplicantLabel(c.applicationId)}}):[],joinedParticipants:s?s.participants.map(p=>({id:p.memberId,label:d.students.find(u=>u.id===d.memberships.find(m=>m.id===p.memberId)?.userId)?.profile.firstName??"Demo member",joinedAt:p.joinedAt??null})):[],sessions:sessions().filter(s=>s.clubId===clubId).map(({id,state,currentPass,createdAt})=>({id,state,currentPass,createdAt})),...(s?projectLegacyVoting(s,viewer,summarizeVoting(s)):{session:null,summary:null}),memberId:m.id,canManage:true,canStart:true,canFinish:true,canReopen:true,canPublish:true,canVote:!!s?.participants.some(p=>p.memberId===m.id),eligible:d.memberships.filter(m=>m.clubId===clubId).map(m=>({id:m.id,label:d.students.find(u=>u.id===m.userId)?.email??m.id})),rounds:club.rounds.map(r=>({id:r.id,name:r.name})),academicYears:s?s.candidates.map(c=>{const a=d.applications.find(a=>a.id===c.applicationId)!,p=d.students.find(u=>u.id===a.studentId)?.profile;return{id:c.applicationId,academicYear:p?academicYear(p):"Year unavailable"}}):[]}
}
/** Demo parity with the server: board sessions only close (complete the open pass, then finish). */
function command(input:unknown){
 const d=votingCommandSchema.parse(input);if(!["COMPLETE_PASS","FINISH"].includes(d.action))throw Error("Board voting sessions are read-only. Use a voting room.")
 context(d.clubId);const s=sessions().find(s=>s.id===d.sessionId&&s.clubId===d.clubId)
 if(!s||s.publishedAt||s.revision!==d.revision)throw Error("Session changed or sealed.")
 const p=s.passes.at(-1),now=new Date()
 if(d.action==="COMPLETE_PASS"){if(!p||p.state!=="OPEN")throw Error("No open pass.");p.state="COMPLETED";p.completedAt=now;s.state="PAUSED"}
 else{if(s.state!=="PAUSED"||p?.state!=="COMPLETED")throw Error("Complete pass first.");s.state="COMPLETED";s.endedAt=now}
 s.revision++;s.updatedAt=now;audit(`voting.${d.action.toLowerCase()}`,s.id);return{success:true,revision:s.revision}
}
export async function commandVotingSession(input:unknown){return demoStore.mutate(()=>command(input))}
