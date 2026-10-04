"use client"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getVotingJoinInfo, joinVotingSession, getJoinedVotingWorkspace, submitVotingBallot } from "@/lib/workspace-api"
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"
import { votingJoinPath, votingSessionStage } from "@/lib/voting-presentation"
import { Button } from "@/components/ui/button"
import "./voting-mode.css"
type Workspace=Awaited<ReturnType<typeof getJoinedVotingWorkspace>>
const messages={NOT_FOUND:"This voting session was not found.",UNAUTHORIZED:"You do not have voting access for this club. Ask leadership to check your membership and permissions.",NOT_JOINABLE:"Leadership has not opened this session for joining yet.",FINISHED:"This session is finished. You can return if leadership reopens it.",ROSTER_LOCKED:"Voting has started and you are not on the frozen participant roster. Ask leadership about the next session."}
export function VotingSessionJoin({sessionId,demoScoped}:{sessionId:string;demoScoped:boolean}){
  const auth=useAuth(),demo=useDemoMode()
  const [info,setInfo]=useState<Awaited<ReturnType<typeof getVotingJoinInfo>>|null>(null),[data,setData]=useState<Workspace|null>(null),[error,setError]=useState(""),[joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[member,setMember]=useState("")
  const epoch=useRef({value:0})
  const permitted=demoScoped?demo.ready&&demo.isDemoEnabled:!auth.loading&&!!auth.user&&!demo.isDemoEnabled
  const refresh=useCallback(async()=>{
    const request=++epoch.current.value
    try{
      if(joined){const value=await getJoinedVotingWorkspace(sessionId,demoScoped?member||undefined:undefined);if(request!==epoch.current.value)return;setData(value)}
      else{const value=await getVotingJoinInfo(sessionId);if(request!==epoch.current.value)return;setInfo(value)}
      setError("")
    }catch(e){if(request!==epoch.current.value)return;setData(null);setInfo(null);setError(e instanceof Error?e.message:"Session temporarily unavailable. Retry shortly.")}
  },[sessionId,joined,member,demoScoped])
  useEffect(()=>{if(!permitted)return;const counter=epoch.current;void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>{counter.value++;clearInterval(timer)}},[refresh,permitted])
  async function join(){setBusy(true);setError("");try{await joinVotingSession(sessionId,demoScoped?member||undefined:undefined);setJoined(true)}catch(e){setError(e instanceof Error?e.message:"Could not join. Try again.")}finally{setBusy(false)}}
  const s=data?.session,pass=s?.passes.find(p=>p.number===s.currentPass),candidate=pass?.candidates.find(c=>c.applicationId===s?.activeApplicationId),ballot=candidate?.ballots.find(b=>b.memberId===data?.memberId)
  if(demoScoped&&!demo.ready)return <main className="p-6" role="status">Opening isolated Demo session…</main>
  if(demoScoped&&!demo.isDemoEnabled)return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="oc-page-title">Demo voting join</h1><p>This link belongs to the isolated Demo graph. Enable Demo Mode in your authorized workspace first; it never opens a production voting session.</p><Link className="underline" href="/?workspace=leader">Open workspace</Link></main>
  if(!demoScoped&&demo.isDemoEnabled)return <main className="p-6"><h1 className="oc-page-title">Production voting unavailable in Demo Mode</h1><p>Use the Demo-scoped QR link or exit Demo Mode.</p></main>
  if(!permitted)return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="oc-page-title">Join live voting</h1>{auth.loading?<p role="status">Checking your sign-in…</p>:<><p>Sign in to verify your club membership and voting permissions.</p><a className="inline-flex min-h-11 items-center underline" href={`/login?next=${encodeURIComponent(votingJoinPath(sessionId))}`}>Sign in and return to this session</a></>}</main>
  return <main className="mx-auto min-h-dvh max-w-6xl space-y-5 p-4 sm:p-6">
    <header><p className="text-sm text-muted-foreground">OutClass · {demoScoped?"Isolated Demo voting":"Live voting"}</p><h1 className="oc-page-title">{joined?"Session voting":"Join this voting session"}</h1><p className="text-sm text-muted-foreground">Server state refreshes every five seconds. Ballots do not publish application decisions.</p></header>
    {error&&<p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={()=>void refresh()}>Retry</Button></p>}
    {!joined&&<>
      {!info&&!error&&<p role="status">Checking session and membership…</p>}
      {info&&("clubName" in info?<section className="space-y-4 rounded-lg border p-5"><h2 className="text-xl">{info.clubName}</h2>{info.status==="ALREADY_JOINED"&&<p>You have already joined. Your ballots are preserved.</p>}
        {demoScoped&&<label className="block">Demo member <select className="ml-2 rounded border p-2" value={member} onChange={e=>setMember(e.target.value)}><option value="">Current Demo leader</option>{demo.state?.memberships.filter(m=>m.clubId===info.clubId).map(m=><option key={m.id} value={m.id}>{demo.state?.students.find(u=>u.id===m.userId)?.profile.firstName??m.id}</option>)}</select></label>}
        <Button className="min-h-11" disabled={busy} onClick={()=>void join()}>{busy?"Joining…":info.status==="ALREADY_JOINED"?"Enter voting":"Join session"}</Button></section>:<p role="status">{messages[info.status]}</p>)}
    </>}
    {joined&&!data&&!error&&<p role="status">Opening your persisted voting session…</p>}
    {s&&<><section className="rounded-lg border p-4"><h2>Pass {s.currentPass} · {votingSessionStage(s)}{candidate&&` · Candidate ${(pass?.candidates.findIndex(c=>c.applicationId===candidate.applicationId)??0)+1} of ${pass?.candidates.length}`}</h2><p>Target {data?.summary?.target} · Passed {data?.summary?.passed} · Hold {data?.summary?.held} · Not passed {data?.summary?.notPassed} · Remaining {data?.summary?.remaining}</p></section>
      {candidate?<><ApplicantDisplayPanel key={candidate.applicationId} clubId={s.clubId} applicationId={candidate.applicationId} sessionId={s.id} refreshKey={String(s.revision)} mode="voting" layout="slide"/><p role="status">Your ballot: {ballot?ballot.decision==="PASS"?"Pass":ballot.decision==="HOLD"?"Hold / Fringe":"Do Not Pass":"Not recorded"}</p><div className="flex flex-wrap gap-3">{(["PASS","HOLD","NOT_PASS"] as const).map(decision=><Button key={decision} className="min-h-11" disabled={busy||!data?.canVote||!!ballot||s.state!=="OPEN"||pass?.state!=="OPEN"} onClick={async()=>{setBusy(true);setError("");try{await submitVotingBallot({clubId:s.clubId,sessionId:s.id,passNumber:s.currentPass,applicationId:candidate.applicationId,decision,...(demoScoped&&member?{demoMemberId:member}:{})});await refresh()}catch(e){setError(e instanceof Error?e.message:"Ballot could not be saved.")}finally{setBusy(false)}}}>{decision==="PASS"?"Pass":decision==="HOLD"?"Hold / Fringe":"Do Not Pass"}</Button>)}</div></>:<p role="status">You’re joined. Waiting for leadership to start the next pass.</p>}
    </>}
  </main>
}
