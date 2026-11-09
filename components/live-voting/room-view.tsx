"use client";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import { useFocusFrame } from "@/components/shell/focus-frame-context";
import { votingRoomFocus } from "@/lib/focus-routes";
import { VotingBackLink } from "./room-back-link";
import { LoadingState } from "@/components/ui/loading-state"
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { useLiveVotingRoom } from "@/hooks/use-live-voting-room";
import { castLiveVotingBallot,commandLiveVotingRoom,getLiveVotingJoinInfo,joinLiveVotingRoom } from "@/lib/voting-room-api";
import { liveRoomPath,roomBallotSchema,outcomeLabels } from "@/lib/voting-room";
import { z } from "zod";
import { QrCodeCard } from "@/components/qr/qr-code-card";
import {Check,Pause,XIcon,ChevronDown} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogTitle } from "@/components/ui/dialog";
import { ApplicantTransition } from "./applicant-transition";
import { RoomPresentation } from "./room-presentation";
import {LeaderControls,OutcomeCounts} from "./room-meeting";
import {SessionDetails} from './session-details';
import {BallotPrivacyNote} from "@/components/live-voting/ballot-privacy-note";
import {DiscussionLeader,DiscussionMember} from "@/components/live-voting/discussion-panel";
import "./room.css";
import { PageHeader } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/native-select"
type View="leader"|"present"|"member";
type Ballot=z.infer<typeof roomBallotSchema>;
export function LiveVotingEntry({clubId,sessionId,view,demoScoped}:{clubId:string;sessionId:string;view:View;demoScoped:boolean}){
 const auth=useAuth(),demo=useDemoMode(),[member,setMember]=useState("");
 useFocusFrame(votingRoomFocus(view));
 if(auth.loading||!demo.ready)return <div className="vr-page"><LoadingState label="Checking sign-in…" layout="inline" /></div>;
 if(demoScoped!==demo.isDemoEnabled)return <div className="vr-page"><PageHeader title="Voting link unavailable in this workspace" /><p>Use the matching Live or Demo link. This page will not switch environments.</p><Link href="/">Return to OutClass</Link></div>;
 if(!auth.user)return <div className="vr-page"><PageHeader title="Join live voting" /><p>Sign in to see if you can vote.</p><Link className="vr-link" href={`/login?next=${encodeURIComponent(liveRoomPath(clubId,sessionId,view,demoScoped))}`}>Sign in and return to this session</Link></div>;
 const demoMember=demoScoped?member||undefined:undefined,identity=`${auth.user.id}:${demoScoped}:${demoMember??"current"}`;
 return <>{demoScoped&&view==="member"&&<label className="block p-4">Isolated Demo voter <NativeSelect aria-label="Demo voter" value={member} onChange={e=>setMember(e.target.value)}><option value="">Current Demo leader</option>{demo.state?.memberships.filter(m=>m.clubId===clubId).map(m=><option key={m.id} value={m.id}>{demo.state?.students.find(u=>u.id===m.userId)?.profile.firstName??"Demo member"}</option>)}</NativeSelect></label>}
 {view==="member"?<MemberJoin key={identity} {...{clubId,sessionId,view,demoScoped,identity,member:demoMember}}/>:<VotingRoom key={identity} {...{clubId,sessionId,view,demoScoped,identity,member:demoMember}}/>}</>;
}
type RoomProps={clubId:string;sessionId:string;view:View;demoScoped:boolean;identity:string;member?:string};
function MemberJoin(props:RoomProps){
 const [info,setInfo]=useState<Awaited<ReturnType<typeof getLiveVotingJoinInfo>>|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),lock=useRef(false);
 useEffect(()=>{let current=true,pending=false;const read=async()=>{if(pending)return;pending=true;try{const v=await getLiveVotingJoinInfo({clubId:props.clubId,sessionId:props.sessionId},props.member);if(current){setInfo(v);setError("");}}catch{if(current){setInfo(null);setError("Couldn't check this session. Retry when connected.");}}finally{pending=false;}};void read();const timer=setInterval(()=>void read(),5000);return()=>{current=false;clearInterval(timer);};},[props.clubId,props.sessionId,props.member,retry]);
 async function join(){if(lock.current)return;lock.current=true;setBusy(true);setError("");try{await joinLiveVotingRoom({clubId:props.clubId,sessionId:props.sessionId},props.member);setRetry(v=>v+1);}catch{setError("Couldn't join. Your eligibility will be checked again on retry.");}finally{lock.current=false;setBusy(false);}}
 if(info?.status==="JOINED"||info?.status==="ENDED")return <VotingRoom {...props}/>;
 return <div className="vr-page vr-member"><PageHeader title="Join live voting" />{error&&<div role="alert" className="vr-error">{error}<Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry</Button></div>}
 {!info&&!error&&<LoadingState label="Checking session and membership…" layout="inline" rows={3} />}
 {info?.status==="READY"&&<><p>You can vote. Join and wait for the leader to start.</p><Button disabled={busy} onClick={()=>void join()}>{busy?"Joining…":"Join session"}</Button></>}
 {info?.status==="DENIED"&&<p role="alert">You can’t vote in this session. Ask a club leader if you think that’s wrong.</p>}
 {info?.status==="EXPIRED"&&<p role="status">This session link is expired or unavailable.</p>}

 <Link className="vr-link" href="/">Return to OutClass</Link></div>;
}
export function VotingRoom(props:RoomProps){
 const {clubId,sessionId,view,demoScoped,identity,member}=props,{room,error,refresh}=useLiveVotingRoom(clubId,sessionId,identity,member),[qr,setQr]=useState(false),[preview,setPreview]=useState(""),[voteError,setVoteError]=useState(""),[voteBusy,setVoteBusy]=useState(false),[attempt,setAttempt]=useState<Ballot|null>(null),[ack,setAck]=useState<{key:string;choice:string;revision:number}|null>(null);
 const [readyApplicant,setReadyApplicant]=useState<string|null>(null);
 const voteLock=useRef(false),pendingVote=useRef<Ballot|null>(null),qrButton=useRef<HTMLButtonElement>(null),sessionButton=useRef<HTMLButtonElement>(null);
 const pass=room?.history.find(p=>p.number===room?.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room?.currentApplicantId),key=`${room?.passNumber}:${room?.currentApplicantId}`;
 async function vote(choice?:Ballot["choice"]){
  if(voteLock.current||!room||(!entry&&!pendingVote.current))return;voteLock.current=true;setVoteBusy(true);setVoteError("");
  const ownRevision=ack?.key===key?Math.max(ack.revision,entry?.ownBallot?.revision??-1):entry?.ownBallot?.revision??null;
  const body=pendingVote.current??{clubId,sessionId,requestId:crypto.randomUUID(),applicationId:room.currentApplicantId!,passNumber:room.passNumber,choice:choice!,ballotRevision:ownRevision};pendingVote.current=body;setAttempt(body);
  try{const response=await castLiveVotingBallot(body,member);if(!response.ok){pendingVote.current=null;setVoteError(response.message);await refresh();return;}setAck({key:`${body.passNumber}:${body.applicationId}`,choice:body.choice,revision:response.result.ballotRevision});pendingVote.current=null;setAttempt(null);await refresh();}catch{setVoteError("Your vote could not be confirmed. Retry sends the same vote safely.");}finally{voteLock.current=false;setVoteBusy(false);}
 }
 if(!room)return <div className="vr-page"><PageHeader title="Live voting" />{error?<div role="alert" className="vr-error">{error}<Button variant="outline" onClick={()=>void refresh()}>Retry connection</Button></div>:<LoadingState label="Restoring voting session…" layout={view === "present" ? "presentation" : "voting"} rows={3} />}</div>;
 if(view==="leader"&&!room.permissions.leader)return <div className="vr-page"><PageHeader title="Leader controls unavailable" /><Link href={liveRoomPath(clubId,sessionId,"member",demoScoped)}>Open member view</Link></div>;
 const appId=room.status==="OPEN"?room.currentApplicantId:view==="leader"&&room.status==="DRAFT"?(preview||room.outcomes[0]?.applicationId):null,currentChoice=ack?.key===key&&ack.revision>=(entry?.ownBallot?.revision??-1)?ack.choice:entry?.ownBallot?.choice;
 const qrCard=<QrCodeCard title="Join this voting session" description="Sign in with your club account." path={liveRoomPath(clubId,sessionId,"member",demoScoped)} filename="outclass-voting-session"/>;
 return <div className={`vr-page ${view==="member"?"vr-member":view==="present"?"vr-present":""}`}>
 {view!=="present"&&<VotingBackLink clubId={clubId} cycleId={room.cycleId} roundId={room.roundId}/>}<header className="vr-header"><PageHeader title={view==="leader"?"Lead voting":view==="member"?"Your vote":"Live voting"} /><div className="vr-actions">{view==="leader"&&<Popover><PopoverTrigger asChild><Button ref={sessionButton} className="vr-session-trigger" variant="ghost" size="sm">Session options <ChevronDown aria-hidden="true" size={16}/></Button></PopoverTrigger><PopoverContent align="end" aria-label="Session options" className="vr-session-options"><Link target="_blank" rel="noopener" className="vr-link" href={liveRoomPath(clubId,sessionId,"present",demoScoped)}>Open audience presentation</Link><Link className="vr-link" href={liveRoomPath(clubId,sessionId,"member",demoScoped)}>My voting device</Link>{!demoScoped&&<Link className="vr-link" href={`/voting/rooms/${encodeURIComponent(sessionId)}/prepare?clubId=${encodeURIComponent(clubId)}`}>Prepare slides</Link>}<Button ref={qrButton} variant="outline" size="sm" onClick={()=>setQr(true)}>Join QR</Button>{room.meeting&&<SessionDetails clubId={clubId} sessionId={sessionId} revision={room.revision} meeting={room.meeting} leader={room.permissions.leader} demo={demoScoped} status={room.status} refresh={refresh}/>}</PopoverContent></Popover>}{view==="present"&&<Button ref={qrButton} variant="outline" size="sm" onClick={()=>setQr(true)}>Join QR</Button>}</div></header>
 <div className="vr-stats" aria-label="Session progress"><span>{room.status==="COMPLETED"?"Session ended":entry?.ballotState==="OPEN"?"Voting open":entry?.ballotState==="CLOSED"||entry?.ballotState==="CONFIRMED"?"Voting closed":"Waiting for voting"}</span><span>{room.participation.voted} of {room.participation.eligible} eligible voters voted</span><span>Reviewed {pass?.candidates.filter(c=>c.ballotState==="CONFIRMED").length??0} of {pass?.candidates.length??room.outcomes.length} this pass · Pass {room.passNumber||1}</span></div>
 {room.meeting&&view==="member"&&room.status==="DRAFT"&&<SessionDetails clubId={clubId} sessionId={sessionId} revision={room.revision} meeting={room.meeting} leader={false} demo={demoScoped} status={room.status} refresh={refresh}/>}
 {view==="leader"?<OutcomeCounts room={room}/>:view==="present"&&<section className="vr-stats" aria-label="Passed and target"><span>Passed {room.targetSummary.decisions.pass}</span><span>{room.targetSummary.target.value===null?"No target set":`${room.targetSummary.target.label} ${room.targetSummary.target.value} · Guidance`}</span>{room.targetSummary.progress.over>0&&<span>{room.targetSummary.progress.detail}</span>}</section>}
 {room.status==="DRAFT"&&<section aria-label="Waiting room"><h2>Ready when your leader is</h2><p>Voting has not started.</p>{view!=="member"&&qrCard}</section>}
 {view==="leader"&&room.status==="DRAFT"&&<label className="block my-4">Preview applicant<NativeSelect className="ml-2" aria-label="Preview applicant" value={appId??""} onChange={e=>setPreview(e.target.value)}>{room.outcomes.map((a,i)=><option key={a.applicationId} value={a.applicationId}>Applicant {i+1}</option>)}</NativeSelect></label>}
 <ApplicantTransition key={`${identity}:${room.accessVersion}`} applicantId={appId} passNumber={room.passNumber} onReady={setReadyApplicant} summary={room.status!=="OPEN"&&room.status!=="DRAFT"}><RoomPresentation clubId={clubId} sessionId={sessionId} applicationId={appId??""} identity={`${identity}:${room.accessVersion}`} refreshKey={0} member={member} onStale={refresh}/></ApplicantTransition>

 {room.status==="COMPLETED"&&<p role="status">Session ended. Unresolved applicants and saved votes are preserved. No applicant notifications were sent.</p>}
 {view==="member"&&room.discussion&&!demoScoped&&room.permissions.voter&&<DiscussionMember clubId={clubId} sessionId={sessionId} discussion={room.discussion} anonymous={room.discussion.anonymous} refresh={refresh}/>}
 {view==="member"&&<section className="vr-ballot"><p role="status" className="py-1">{voteBusy?`Saving ${attempt?.choice?outcomeLabels[attempt.choice]:"vote"}…`:currentChoice?`Saved: ${outcomeLabels[currentChoice as keyof typeof outcomeLabels].toLowerCase()}`:room.status==="OPEN"&&entry?.ballotState==="OPEN"?"Choose your vote":room.status==="COMPLETED"?"Voting ended":room.status==="DRAFT"?"Waiting for the leader":"Voting closed · Waiting for the leader"}</p>{voteError&&<div role="alert" className="vr-error">{voteError}{pendingVote.current?<Button variant="outline" disabled={voteBusy} onClick={()=>void vote()}>Retry vote</Button>:<Button variant="outline" onClick={()=>void refresh()}>Try again</Button>}</div>}{room.status==="OPEN"&&entry?.ballotState==="OPEN"&&<div className="vr-votes" aria-label="Your ballot">{(["ACCEPT","HOLD","REJECT"] as const).map(c=><Button key={c} variant={currentChoice===c?"default":"outline"} aria-pressed={currentChoice===c} disabled={readyApplicant!==`${room.passNumber}:${appId}`||voteBusy||!!pendingVote.current||!room.permissions.voter||entry?.ballotState!=="OPEN"||room.status!=="OPEN"} onClick={()=>void vote(c)}>{c==="ACCEPT"?<Check aria-hidden="true" size={18}/>:c==="HOLD"?<Pause aria-hidden="true" size={18}/>:<XIcon aria-hidden="true" size={18}/>} {outcomeLabels[c]}</Button>)}</div>}{room.status==="OPEN"&&entry?.ballotState==="OPEN"&&<BallotPrivacyNote/>}</section>}
 {view!=="leader"&&entry&&"totals"in entry&&entry.totals&&<section aria-label="Closed ballot totals" className="py-4"><h2>Closed voting</h2><p>Pass {entry.totals.ACCEPT} · Hold {entry.totals.HOLD} · Do not pass {entry.totals.REJECT}</p>{room.ruleResult&&<p>{room.ruleResult.summary}{room.ruleResult.outcome?" The leader confirms the rule’s outcome.":""}</p>}</section>}
 {view!=="leader"&&room.status==="COMPLETED"&&<section aria-label="Voting summary"><h2>Voting summary</h2>{(["ACCEPT","HOLD","REJECT","UNREVIEWED"] as const).map(kind=><section key={kind}><h3>{kind==="UNREVIEWED"?"Unreviewed":outcomeLabels[kind]}</h3><ul>{room.outcomes.filter(o=>o.outcome===kind).map(o=><li key={o.applicationId}>Applicant {room.outcomes.findIndex(v=>v.applicationId===o.applicationId)+1}</li>)}</ul></section>)}</section>}
 {view==="leader"&&room.discussion&&!demoScoped&&<DiscussionLeader clubId={clubId} sessionId={sessionId} discussion={room.discussion} refresh={refresh}/>}
 {view==="leader"&&room.meeting?.status!=='CANCELLED'&&<LeaderControls room={room} refresh={refresh} member={member} transitioning={!!appId&&readyApplicant!==`${room.passNumber}:${appId}`}/>}
 <p className="sr-only">{entry?`Applicant ${entry.position+1} of ${pass?.candidates.length}. ${entry.ballotState==="OPEN"?"Voting open":"Voting closed or waiting"}.`:"Waiting for the leader."}</p>
 <Dialog open={qr} onOpenChange={setQr}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();(qrButton.current??sessionButton.current)?.focus();}} aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Join live voting</DialogTitle>{qrCard}</DialogContent></Dialog>
 </div>;
}
