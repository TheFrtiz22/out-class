"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission } from "@/lib/permissions";
import { listLiveVotingRooms,listVotingSetupDrafts } from "@/lib/voting-room-api";
import { liveRoomPath } from "@/lib/voting-room";
import { votingSetupHref } from "@/lib/voting-navigation";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";

export function VotingRoomLanding({clubId}:{clubId:string}){
  const auth=useAuth(),demo=useDemoMode(),params=useSearchParams(),member=auth.user?.memberships.find(m=>m.clubId===clubId);
  const canRead=hasPermission(member,"applications.review")&&(["decisions.start","decisions.vote","decisions.view"] as const).some(p=>hasPermission(member,p));
  const canStart=hasPermission(member,"applications.review")&&hasPermission(member,"decisions.manage")&&hasPermission(member,"decisions.start");
  const cycleId=params.get("cycleId")||undefined,roundId=params.get("roundId")||undefined;
  const identity=`${auth.user?.id}:${clubId}:${cycleId}:${roundId}:${demo.isDemoEnabled}:${JSON.stringify(member?.permissions)}`;
  const [drafts,setDrafts]=useState<Awaited<ReturnType<typeof listVotingSetupDrafts>>>([]),[draftError,setDraftError]=useState('');
  const [snapshot,setSnapshot]=useState<{identity:string;rooms:Awaited<ReturnType<typeof listLiveVotingRooms>>}|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let current=true;setSnapshot(null);setError("");if(auth.loading||!demo.ready||!canRead)return;
    const load=()=>listLiveVotingRooms({clubId,cycleId,roundId}).then(rooms=>{if(current){setSnapshot({identity,rooms});setError("")}}).catch(()=>{if(current){setSnapshot(null);setError("Voting sessions could not be loaded. Check your current access and retry.")}});
    void load();if(canStart)listVotingSetupDrafts({clubId}).then(v=>{if(current){setDrafts(v);setDraftError('')}}).catch(()=>{if(current)setDraftError('Your setup drafts could not be loaded. Retry sessions.');});else setDrafts([]);const onFocus=()=>void load();window.addEventListener("focus",onFocus);window.addEventListener("storage",onFocus);
    return()=>{current=false;window.removeEventListener("focus",onFocus);window.removeEventListener("storage",onFocus)};
  },[identity,clubId,cycleId,roundId,canRead,auth.loading,demo.ready,retry,canStart]);
  if(!auth.loading&&demo.ready&&!canRead)return <p role="alert">Voting room is unavailable with your current access.</p>;
  const rooms=snapshot?.identity===identity?snapshot.rooms:null;
  const search=new URLSearchParams(params.toString());if(demo.isDemoEnabled)search.set("demo","1");
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Voting room</h2>{canStart&&<Button asChild><Link href={votingSetupHref(clubId,search.toString())}>Start voting session</Link></Button>}</header>
    {canStart&&draftError&&<p role="alert">{draftError}</p>}
    {canStart&&drafts.length>0&&<section aria-label="Setup drafts"><h3 className="font-medium">Drafts</h3><ul className="divide-y border-y">{drafts.map(d=><li key={d.id} className="flex flex-wrap justify-between gap-3 py-3"><div><p>{d.name}</p><p className="text-sm text-muted-foreground">{d.applicantCount} applicants selected</p></div><Button asChild variant="outline" size="sm"><Link href={`/voting/rooms/new?clubId=${clubId}&draft=${encodeURIComponent(d.id)}${demo.isDemoEnabled?'&demo=1':''}`}>Continue setup</Link></Button></li>)}</ul></section>}
    {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry sessions</Button></div>:!rooms?<LoadingState label="Loading voting sessions…" layout="rows" rows={3}/>:<>
      {(["scheduled","active","past"] as const).map(kind=>{const past=kind==="past",group=rooms.filter(r=>kind==="past"?r.state==="COMPLETED":kind==="scheduled"?r.state==="DRAFT"&&r.meeting?.status==="SCHEDULED":r.state!=="COMPLETED"&&!(r.state==="DRAFT"&&r.meeting?.status==="SCHEDULED"));return <section key={kind}><h3 className="mb-2 font-medium">{past?"Past sessions":kind==="scheduled"?"Scheduled sessions":"Active sessions"}</h3>{!group.length?<p className="py-3 text-sm text-muted-foreground">{past?"No past sessions.":kind==="scheduled"?"No scheduled sessions.":"No voting sessions available."}</p>:<ul className="divide-y border-y">{group.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.meeting?.name??r.roundName}</p>{r.meeting?.plannedAt&&<p className="text-sm">{new Date(r.meeting.plannedAt).toLocaleString(undefined,{timeZone:r.meeting.timeZone})} · {r.meeting.timeZone}</p>}<p className="text-sm text-muted-foreground">{r.cycleName} · {r.roundName} · {r.meeting?.status==="CANCELLED"?"Cancelled":r.state==="DRAFT"?r.meeting?.status==="SCHEDULED"?"Scheduled":"Prepared":r.state==="COMPLETED"?r.finalizedAt?"Finalized":"Ended · Provisional":r.state==="PAUSED"?"Pass complete":"In progress"} · {r.applicantCount} {r.applicantCount===1?"applicant":"applicants"}</p><p className="text-xs text-muted-foreground">Last activity {new Date(r.updatedAt??r.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap items-center gap-2">{!past&&r.view==="leader"&&!demo.isDemoEnabled&&<Link className="vr-link inline-flex min-h-11 items-center text-sm" href={`/voting/rooms/${encodeURIComponent(r.id)}/prepare?clubId=${encodeURIComponent(clubId)}`}>Prepare slides</Link>}<Button asChild variant="outline" size="sm"><Link href={`${liveRoomPath(clubId,r.id,r.view,demo.isDemoEnabled)}&cycleId=${encodeURIComponent(r.cycleId??"")}&roundId=${encodeURIComponent(r.roundId)}`}>{past?"View summary":kind==="scheduled"?"View details":r.view==="leader"?"Resume session":r.view==="member"?r.joined?"Rejoin session":"Join session":"View session"}</Link></Button></div></li>)}</ul>}</section>})}
    </>}
  </div>;
}
