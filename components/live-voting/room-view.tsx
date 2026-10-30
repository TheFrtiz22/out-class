"use client";
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
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogTitle } from "@/components/ui/dialog";
import { ApplicantTransition } from "./applicant-transition";
import { RoomPresentation } from "./room-presentation";
import {LeaderControls,OutcomeCounts} from "./room-meeting";
import "./room.css";
type View="leader"|"present"|"member";
type Ballot=z.infer<typeof roomBallotSchema>;
export function LiveVotingEntry({clubId,sessionId,view,demoScoped}:{clubId:string;sessionId:string;view:View;demoScoped:boolean}){
 const auth=useAuth(),demo=useDemoMode(),[member,setMember]=useState("");
 if(auth.loading||!demo.ready)return <main className="vr-page"><LoadingState label="Checking sign-in…" layout="inline" /></main>;
 if(demoScoped!==demo.isDemoEnabled)return <main className="vr-page"><h1>Voting link unavailable in this workspace</h1><p>Use the matching Live or Demo link. This page will not switch environments.</p><Link href="/">Return to OutClass</Link></main>;
 if(!auth.user)return <main className="vr-page"><h1>Join live voting</h1><p>Sign in to check eligibility.</p><Link className="vr-link" href={`/login?next=${encodeURIComponent(liveRoomPath(clubId,sessionId,view,demoScoped))}`}>Sign in and return to this session</Link></main>;
 const demoMember=demoScoped?member||undefined:undefined,identity=`${auth.user.id}:${demoScoped}:${demoMember??"current"}`;
 return <>{demoScoped&&view==="member"&&<label className="block p-4">Isolated Demo voter <select aria-label="Demo voter" value={member} onChange={e=>setMember(e.target.value)}><option value="">Current Demo leader</option>{demo.state?.memberships.filter(m=>m.clubId===clubId).map(m=><option key={m.id} value={m.id}>{demo.state?.students.find(u=>u.id===m.userId)?.profile.firstName??"Demo member"}</option>)}</select></label>}
 {view==="member"?<MemberJoin key={identity} {...{clubId,sessionId,view,demoScoped,identity,member:demoMember}}/>:<VotingRoom key={identity} {...{clubId,sessionId,view,demoScoped,identity,member:demoMember}}/>}</>;
}
type RoomProps={clubId:string;sessionId:string;view:View;demoScoped:boolean;identity:string;member?:string};
function MemberJoin(props:RoomProps){
 const [info,setInfo]=useState<Awaited<ReturnType<typeof getLiveVotingJoinInfo>>|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),lock=useRef(false);
 useEffect(()=>{let current=true,pending=false;const read=async()=>{if(pending)return;pending=true;try{const v=await getLiveVotingJoinInfo({clubId:props.clubId,sessionId:props.sessionId},props.member);if(current){setInfo(v);setError("");}}catch{if(current){setInfo(null);setError("Couldn't check this session. Retry when connected.");}}finally{pending=false;}};void read();const timer=setInterval(()=>void read(),5000);return()=>{current=false;clearInterval(timer);};},[props.clubId,props.sessionId,props.member,retry]);
 async function join(){if(lock.current)return;lock.current=true;setBusy(true);setError("");try{await joinLiveVotingRoom({clubId:props.clubId,sessionId:props.sessionId},props.member);setRetry(v=>v+1);}catch{setError("Couldn't join. Your eligibility will be checked again on retry.");}finally{lock.current=false;setBusy(false);}}
 if(info?.status==="JOINED")return <VotingRoom {...props}/>;
 return <main className="vr-page vr-member"><h1>Join live voting</h1>{error&&<div role="alert" className="vr-error">{error}<Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry</Button></div>}
 {!info&&!error&&<LoadingState label="Checking session and membership…" layout="inline" rows={3} />}
 {info?.status==="READY"&&<><p>You are eligible. Join to wait for the leader.</p><Button disabled={busy} onClick={()=>void join()}>{busy?"Joining…":"Join session"}</Button></>}
 {info?.status==="DENIED"&&<p role="alert">You do not have access to this voting session. Ask leadership to check your eligibility.</p>}
 {info?.status==="EXPIRED"&&<p role="status">This session link is expired or unavailable.</p>}
 {info?.status==="ENDED"&&<p role="status">This session has ended. Your saved votes are preserved.</p>}
 <Link className="vr-link" href="/">Return to OutClass</Link></main>;
}
export function VotingRoom(props:RoomProps){
 const {clubId,sessionId,view,demoScoped,identity,member}=props,{room,error,refresh}=useLiveVotingRoom(clubId,sessionId,identity,member),[qr,setQr]=useState(false),[preview,setPreview]=useState(""),[voteError,setVoteError]=useState(""),[voteBusy,setVoteBusy]=useState(false),[attempt,setAttempt]=useState<Ballot|null>(null),[ack,setAck]=useState<{key:string;choice:string;revision:number}|null>(null);
 const [readyApplicant,setReadyApplicant]=useState<string|null>(null);
 const voteLock=useRef(false),pendingVote=useRef<Ballot|null>(null),qrButton=useRef<HTMLButtonElement>(null);
 const pass=room?.history.find(p=>p.number===room?.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room?.currentApplicantId),key=`${room?.passNumber}:${room?.currentApplicantId}`;
 async function vote(choice?:Ballot["choice"]){
  if(voteLock.current||!room||(!entry&&!pendingVote.current))return;voteLock.current=true;setVoteBusy(true);setVoteError("");
  const ownRevision=ack?.key===key?Math.max(ack.revision,entry?.ownBallot?.revision??-1):entry?.ownBallot?.revision??null;
  const body=pendingVote.current??{clubId,sessionId,requestId:crypto.randomUUID(),applicationId:room.currentApplicantId!,passNumber:room.passNumber,choice:choice!,ballotRevision:ownRevision};pendingVote.current=body;setAttempt(body);
  try{const response=await castLiveVotingBallot(body,member);if(!response.ok){pendingVote.current=null;setVoteError(response.message);await refresh();return;}setAck({key:`${body.passNumber}:${body.applicationId}`,choice:body.choice,revision:response.result.ballotRevision});pendingVote.current=null;setAttempt(null);await refresh();}catch{setVoteError("Your vote could not be confirmed. Retry sends the same vote safely.");}finally{voteLock.current=false;setVoteBusy(false);}
 }
 if(!room)return <main className="vr-page"><h1>Live voting</h1>{error?<div role="alert" className="vr-error">{error}<Button variant="outline" onClick={()=>void refresh()}>Retry connection</Button></div>:<LoadingState label="Restoring voting session…" layout={view === "present" ? "presentation" : "voting"} rows={3} />}</main>;
 if(view==="leader"&&!room.permissions.leader)return <main className="vr-page"><h1>Leader controls unavailable</h1><Link href={liveRoomPath(clubId,sessionId,"member",demoScoped)}>Open member view</Link></main>;
 const appId=room.status==="OPEN"?room.currentApplicantId:view==="leader"&&room.status==="DRAFT"?(preview||room.outcomes[0]?.applicationId):null,currentChoice=ack?.key===key&&ack.revision>=(entry?.ownBallot?.revision??-1)?ack.choice:entry?.ownBallot?.choice;
 const qrCard=<QrCodeCard title="Join this voting session" description="Sign in with your eligible club account." path={liveRoomPath(clubId,sessionId,"member",demoScoped)} filename="outclass-voting-session"/>;
 return <main className={`vr-page ${view==="member"?"vr-member":view==="present"?"vr-present":""}`}>
 <header className="vr-header"><h1>{view==="leader"?"Lead voting":view==="member"?"Your vote":"Live voting"}</h1><div className="vr-actions">{view==="leader"&&<><Link target="_blank" rel="noopener" className="vr-link" href={liveRoomPath(clubId,sessionId,"present",demoScoped)}>Open audience presentation</Link><Link className="vr-link" href={liveRoomPath(clubId,sessionId,"member",demoScoped)}>My voting device</Link></>}{view!=="member"&&<Button ref={qrButton} variant="outline" size="sm" onClick={()=>setQr(true)}>Join QR</Button>}</div></header>
 <div className="vr-stats" aria-label="Session progress"><span>{room.status==="COMPLETED"?"Session ended":entry?.ballotState==="OPEN"?"Voting open":entry?.ballotState==="CLOSED"||entry?.ballotState==="CONFIRMED"?"Voting closed":"Waiting for voting"}</span><span>{room.participation.voted} of {room.participation.eligible} eligible voters voted</span><span>Reviewed {pass?.candidates.filter(c=>c.ballotState==="CONFIRMED").length??0} of {pass?.candidates.length??room.outcomes.length} this pass · Pass {room.passNumber||1}</span></div>
 <OutcomeCounts room={room}/>
 {room.status==="DRAFT"&&<section aria-label="Waiting room"><h2>Ready when your leader is</h2><p>Voting has not started.</p>{view!=="member"&&qrCard}</section>}
 {view==="leader"&&room.status==="DRAFT"&&<label className="block my-4">Preview applicant<select className="rounded border p-2 ml-2" aria-label="Preview applicant" value={appId??""} onChange={e=>setPreview(e.target.value)}>{room.outcomes.map((a,i)=><option key={a.applicationId} value={a.applicationId}>Applicant {i+1}</option>)}</select></label>}
 <ApplicantTransition key={`${identity}:${room.accessVersion}`} applicantId={appId} passNumber={room.passNumber} onReady={setReadyApplicant} summary={room.status!=="OPEN"&&room.status!=="DRAFT"}><RoomPresentation clubId={clubId} sessionId={sessionId} applicationId={appId??""} identity={`${identity}:${room.accessVersion}`} refreshKey={0} member={member}/></ApplicantTransition>
 {room.status==="PAUSED"&&<p role="status">Pass complete. Waiting for leadership.</p>}
 {room.status==="COMPLETED"&&<p role="status">Session ended. Unresolved applicants and saved votes are preserved. No applicant notifications were sent.</p>}
 {view==="member"&&<section className="vr-ballot"><p role="status" className="py-1">{voteBusy?`Saving ${attempt?.choice?outcomeLabels[attempt.choice]:"vote"}…`:currentChoice?`Saved: ${outcomeLabels[currentChoice as keyof typeof outcomeLabels].toLowerCase()}`:"No vote saved"}</p>{voteError&&<div role="alert" className="vr-error">{voteError}{pendingVote.current?<Button variant="outline" disabled={voteBusy} onClick={()=>void vote()}>Retry vote</Button>:<Button variant="outline" onClick={()=>void refresh()}>Refresh voting state</Button>}</div>}<div className="vr-votes" aria-label="Your ballot">{(["ACCEPT","HOLD","REJECT"] as const).map(c=><Button key={c} variant={currentChoice===c?"default":"outline"} aria-pressed={currentChoice===c} disabled={readyApplicant!==`${room.passNumber}:${appId}`||voteBusy||!!pendingVote.current||!room.permissions.voter||entry?.ballotState!=="OPEN"||room.status!=="OPEN"} onClick={()=>void vote(c)}>{outcomeLabels[c]}</Button>)}</div></section>}
 {view!=="leader"&&entry&&"totals"in entry&&entry.totals&&<section aria-label="Closed ballot totals" className="py-4"><h2>Closed voting</h2><p>Pass {entry.totals.ACCEPT} · Hold {entry.totals.HOLD} · Do not pass {entry.totals.REJECT}</p></section>}
 {view==="leader"&&<LeaderControls room={room} refresh={refresh} member={member} transitioning={!!appId&&readyApplicant!==`${room.passNumber}:${appId}`}/>}
 <p className="sr-only" role="status">{entry?`Applicant ${entry.position+1} of ${pass?.candidates.length}. ${entry.ballotState==="OPEN"?"Voting open":"Voting closed or waiting"}.`:"Waiting for the leader."}</p>
 <Dialog open={qr} onOpenChange={setQr}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();qrButton.current?.focus();}} aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Join live voting</DialogTitle>{qrCard}</DialogContent></Dialog>
 </main>;
}
