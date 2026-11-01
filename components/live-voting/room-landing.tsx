"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission } from "@/lib/permissions";
import { listLiveVotingRooms } from "@/lib/voting-room-api";
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
  const [snapshot,setSnapshot]=useState<{identity:string;rooms:Awaited<ReturnType<typeof listLiveVotingRooms>>}|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let current=true;setSnapshot(null);setError("");if(auth.loading||!demo.ready||!canRead)return;
    const load=()=>listLiveVotingRooms({clubId,cycleId,roundId}).then(rooms=>{if(current){setSnapshot({identity,rooms});setError("")}}).catch(()=>{if(current){setSnapshot(null);setError("Voting sessions could not be loaded. Check your current access and retry.")}});
    void load();const onFocus=()=>void load();window.addEventListener("focus",onFocus);window.addEventListener("storage",onFocus);
    return()=>{current=false;window.removeEventListener("focus",onFocus);window.removeEventListener("storage",onFocus)};
  },[identity,clubId,cycleId,roundId,canRead,auth.loading,demo.ready,retry]);
  if(!auth.loading&&demo.ready&&!canRead)return <p role="alert">Voting room is unavailable with your current access.</p>;
  const rooms=snapshot?.identity===identity?snapshot.rooms:null;
  const search=new URLSearchParams(params.toString());if(demo.isDemoEnabled)search.set("demo","1");
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Voting room</h2>{canStart&&<Button asChild><Link href={votingSetupHref(clubId,search.toString())}>Start voting session</Link></Button>}</header>
    {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry sessions</Button></div>:!rooms?<LoadingState label="Loading voting sessions…" layout="rows" rows={3}/>:<>
      {([false,true] as const).map(past=>{const group=rooms.filter(r=>(r.state==="COMPLETED")===past);return <section key={String(past)}><h3 className="mb-2 font-medium">{past?"Past sessions":"Active sessions"}</h3>{!group.length?<p className="py-3 text-sm text-muted-foreground">{past?"No past sessions.":"No voting sessions available."}</p>:<ul className="divide-y border-y">{group.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.roundName}</p><p className="text-sm text-muted-foreground">{r.cycleName} · {r.state==="DRAFT"?"Prepared":r.state==="COMPLETED"?r.finalizedAt?"Finalized":"Ended · Provisional":r.state==="PAUSED"?"Pass complete":"In progress"} · {r.applicantCount} {r.applicantCount===1?"applicant":"applicants"}</p><p className="text-xs text-muted-foreground">Last activity {new Date(r.updatedAt??r.createdAt).toLocaleString()}</p></div><Button asChild variant="outline" size="sm"><Link href={`${liveRoomPath(clubId,r.id,r.view,demo.isDemoEnabled)}&cycleId=${encodeURIComponent(r.cycleId??"")}&roundId=${encodeURIComponent(r.roundId)}`}>{past?"View summary":r.view==="leader"?"Resume session":r.view==="member"?r.joined?"Rejoin session":"Join session":"View session"}</Link></Button></li>)}</ul>}</section>})}
    </>}
  </div>;
}
