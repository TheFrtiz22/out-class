"use client";
import {useRef,useState} from "react";
import {setDiscussionRequest,respondToDiscussionRequest} from "@/lib/voting-discussion-api";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {AdditionalObservations} from "@/components/additional-observations";

type Discussion={passNumber:number;applicationId:string;anonymous:boolean;interviewers:{label:string;roundName:string;inSession?:boolean}[];ownRequest:{raisedAt:string;acknowledged:boolean}|null;requests:{memberId:string;label:string;raisedAt:string;acknowledged:boolean}[]};
const time=(iso:string)=>new Date(iso).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});

function Interviewers({list}:{list:Discussion["interviewers"]}){
  if(!list.length)return null;
  return <p className="text-sm text-muted-foreground">Interviewed by {list.map(i=>`${i.label} (${i.roundName})`).join(", ")}</p>;
}

/** Member view: raise or withdraw "Something to add". Never a ballot or observation. */
export function DiscussionMember({clubId,sessionId,discussion,anonymous,refresh}:{clubId:string;sessionId:string;discussion:Discussion;anonymous:boolean;refresh:()=>unknown}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notes,setNotes]=useState(false),origin=useRef<HTMLButtonElement|null>(null);
  const own=discussion.ownRequest;
  const set=async(raised:boolean)=>{if(busy)return;setBusy(true);setError("");
    try{const r=await setDiscussionRequest({clubId,sessionId,passNumber:discussion.passNumber,applicationId:discussion.applicationId,raised});if(!r.ok)setError(r.message);await refresh();}
    catch{setError("Your request could not be saved. Check your connection and try again.");}finally{setBusy(false);}};
  return <section aria-label="Discussion" className="vr-discussion space-y-2">
    <Interviewers list={discussion.interviewers}/>
    <div className="flex flex-wrap items-center gap-2">
      {own?<><p role="status" className="text-sm">{own.acknowledged?"The leader has seen your request.":"Hand raised. The leader can see your request."}</p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void set(false)}>Withdraw</Button></>
        :<Button type="button" size="sm" variant="outline" aria-pressed={false} disabled={busy} onClick={()=>void set(true)}>Something to add</Button>}
      {!anonymous&&<Button ref={origin} type="button" size="sm" variant="ghost" onClick={()=>setNotes(true)}>Save an observation instead</Button>}
    </div>
    <p className="text-xs text-muted-foreground">Raising your hand doesn’t vote, change the outcome or save anything about the applicant.</p>
    {error&&<p role="alert" className="text-sm">{error}</p>}
    {!anonymous&&<Dialog open={notes} onOpenChange={setNotes}><DialogContent className="max-h-[85dvh] overflow-y-auto" onCloseAutoFocus={e=>{e.preventDefault();origin.current?.focus();}} aria-describedby={undefined}>
      <DialogTitle>Additional observations</DialogTitle>
      <p className="text-sm text-muted-foreground">Observations are saved separately, attributed to you, and shared with authorized reviewers. They are not part of this vote.</p>
      <AdditionalObservations clubId={clubId} applicationId={discussion.applicationId}/>
    </DialogContent></Dialog>}
  </section>;
}

/** Leader view: see who has something to add; acknowledge or clear. The conversation happens in person. */
export function DiscussionLeader({clubId,sessionId,discussion,refresh}:{clubId:string;sessionId:string;discussion:Discussion;refresh:()=>unknown}){
  const [busy,setBusy]=useState(""),[error,setError]=useState("");
  const respond=async(memberId:string,action:"ACKNOWLEDGE"|"CLEAR")=>{if(busy)return;setBusy(memberId+action);setError("");
    try{const r=await respondToDiscussionRequest({clubId,sessionId,passNumber:discussion.passNumber,applicationId:discussion.applicationId,memberId,action});if(!r.ok)setError(r.message);await refresh();}
    catch{setError("That update could not be saved. Try again.");}finally{setBusy("");}};
  return <section aria-label="Something to add" className="vr-discussion space-y-2">
    <Interviewers list={discussion.interviewers}/>
    <h3 className="text-sm font-medium">Something to add{discussion.requests.length?` · ${discussion.requests.length}`:""}</h3>
    {!discussion.requests.length?<p className="text-sm text-muted-foreground">No raised hands for this applicant.</p>:
    <ul className="space-y-1">{discussion.requests.map(r=><li key={r.memberId} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{r.label}</span><span className="text-muted-foreground">{time(r.raisedAt)}{r.acknowledged?" · Acknowledged":""}</span>
      {!r.acknowledged&&<Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={()=>void respond(r.memberId,"ACKNOWLEDGE")} aria-label={`Acknowledge ${r.label}`}>Acknowledge</Button>}
      <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={()=>void respond(r.memberId,"CLEAR")} aria-label={`Clear ${r.label}`}>Clear</Button>
    </li>)}</ul>}
    {error&&<p role="alert" className="text-sm">{error}</p>}
  </section>;
}
