"use client"
import { LoadingState } from "@/components/ui/loading-state"
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getVotingJoinInfo, joinVotingSession, getJoinedVotingWorkspace, submitVotingBallot } from "@/lib/workspace-api"
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"
import { votingJoinPath, votingSessionStage } from "@/lib/voting-presentation"
import { Button } from "@/components/ui/button"
import "./voting-mode.css"
import { PageHeader } from "@/components/ui/page-header"
import { Panel } from "@/components/ui/panel"
import { NativeSelect } from "@/components/ui/native-select"
type Workspace=Awaited<ReturnType<typeof getJoinedVotingWorkspace>>
const messages={NOT_FOUND:"This voting session was not found.",UNAUTHORIZED:"You do not have voting access for this club. Ask leadership to check your membership and permissions.",NOT_JOINABLE:"Leadership has not opened this session for joining yet.",FINISHED:"This session is finished. You can return if leadership reopens it.",ROSTER_LOCKED:"Voting has started and you are not on the frozen participant roster. Ask leadership about the next session."}
export function VotingSessionJoin({sessionId,demoScoped}:{sessionId:string;demoScoped:boolean}){
  const auth=useAuth(),demo=useDemoMode()
  const identityScope=JSON.stringify([sessionId,auth.user?.id,demoScoped,demo.isDemoEnabled])
  const [rawInfo,setInfo]=useState<Awaited<ReturnType<typeof getVotingJoinInfo>>|null>(null),[rawData,setData]=useState<Workspace|null>(null),[error,setError]=useState(""),[joinedScope,setJoinedScope]=useState<string|null>(null),[busy,setBusy]=useState(false),[member,setMember]=useState("")
  const joined=joinedScope===identityScope
  const scope=JSON.stringify([identityScope,joined,member])
  const [dataScope,setDataScope]=useState("")
  const data=dataScope===scope?rawData:null
  const info=dataScope===scope?rawInfo:null
  const reader=useRef<ReturnType<typeof serializedWorkspaceRead<unknown>>|null>(null)
  const permitted=demoScoped?demo.ready&&demo.isDemoEnabled:!auth.loading&&!!auth.user&&!demo.isDemoEnabled
  const refresh=useCallback(()=>reader.current?.refresh()??Promise.resolve(),[])
  useEffect(()=>{
    setData(null);setInfo(null);setError("")
    if(!permitted)return
    const reads=serializedWorkspaceRead(async()=>joined?getJoinedVotingWorkspace(sessionId,demoScoped?member||undefined:undefined):getVotingJoinInfo(sessionId),value=>{
      setDataScope(scope)
      if(joined)setData(value as Workspace);else setInfo(value as Awaited<ReturnType<typeof getVotingJoinInfo>>)
      setError("")
    },error=>{setData(null);setInfo(null);setError(error instanceof Error?error.message:"Session temporarily unavailable. Retry shortly.")})
    reader.current=reads;void reads.poll()
    const timer=setInterval(()=>void reads.poll(),5000)
    return()=>{reads.dispose();if(reader.current===reads)reader.current=null;clearInterval(timer)}
  },[sessionId,joined,member,demoScoped,permitted,auth.user?.id,scope])
  async function join(){setBusy(true);setError("");try{await joinVotingSession(sessionId,demoScoped?member||undefined:undefined);setJoinedScope(identityScope)}catch(e){setError(e instanceof Error?e.message:"Could not join. Try again.")}finally{setBusy(false)}}
  const s=data?.session,pass=s?.passes.find(p=>p.number===s.currentPass),candidate=pass?.candidates.find(c=>c.applicationId===s?.activeApplicationId),ballot=candidate?.ballots.find(b=>b.memberId===data?.memberId)
  if(demoScoped&&!demo.ready)return <div role="status">Opening isolated Demo session…</div>
  if(demoScoped&&!demo.isDemoEnabled)return <div className="space-y-4"><PageHeader title="Demo voting join" /><p>This link belongs to the isolated Demo graph. Enable Demo Mode in your authorized workspace first; it never opens a production voting session.</p><Link className="underline" href="/?workspace=leader">Open workspace</Link></div>
  if(!demoScoped&&demo.isDemoEnabled)return <div><PageHeader title="Production voting unavailable in Demo Mode" /><p>Use the Demo-scoped QR link or exit Demo Mode.</p></div>
  if(!permitted)return <div className="space-y-4"><PageHeader title="Join live voting" />{auth.loading?<LoadingState label="Checking your sign-in…" layout="inline" rows={3} />:<><p>This link opens a club’s live voting session. Sign in so we can confirm your membership and voting permissions.</p><Button asChild className="w-fit"><a href={`/login?next=${encodeURIComponent(votingJoinPath(sessionId))}`}>Sign in</a></Button></>}</div>
  return <div className="space-y-5">
    <p role="status" aria-atomic="true" className="sr-only">{joined ? candidate ? `Pass ${s?.currentPass}. Candidate ${(pass?.candidates.findIndex(c=>c.applicationId===candidate.applicationId)??0)+1} of ${pass?.candidates.length}. ${data?.canVote && !ballot ? "Voting is open. Review the candidate below." : "Your ballot is recorded or voting is closed."}` : "Joined. Waiting for leadership to start the next pass." : ""}</p>
    <header><p className="text-sm text-muted-foreground">OutClass · {demoScoped?"Isolated Demo voting":"Live voting"}</p><PageHeader title={joined?"Session voting":"Join this voting session"} /><p className="text-sm text-muted-foreground">Server state refreshes every five seconds. Ballots do not publish application decisions.</p></header>
    {error&&<p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={()=>void refresh()}>Retry</Button></p>}
    {!joined&&<>
      {!info&&!error&&<LoadingState label="Checking session and membership…" layout="inline" rows={3} />}
      {info&&("clubName" in info?<Panel as="section" className="space-y-4"><h2 className="text-xl">{info.clubName}</h2>{info.status==="ALREADY_JOINED"&&<p>You have already joined. Your ballots are preserved.</p>}
        {demoScoped&&<label className="block">Demo member <NativeSelect className="ml-2" value={member} onChange={e=>setMember(e.target.value)}><option value="">Current Demo leader</option>{demo.state?.memberships.filter(m=>m.clubId===info.clubId).map(m=><option key={m.id} value={m.id}>{demo.state?.students.find(u=>u.id===m.userId)?.profile.firstName??m.id}</option>)}</NativeSelect></label>}
        <Button className="min-h-11" disabled={busy} onClick={()=>void join()}>{busy?"Joining…":info.status==="ALREADY_JOINED"?"Enter voting":"Join session"}</Button></Panel>:<p role="status">{messages[info.status]}</p>)}
    </>}
    {joined&&!data&&!error&&<p role="status">Opening your persisted voting session…</p>}
    {s&&<><Panel as="section"><h2>Pass {s.currentPass} · {votingSessionStage(s)}{candidate&&` · Candidate ${(pass?.candidates.findIndex(c=>c.applicationId===candidate.applicationId)??0)+1} of ${pass?.candidates.length}`}</h2><p>Target {data?.summary?.target} · Passed {data?.summary?.passed} · Hold {data?.summary?.held} · Not passed {data?.summary?.notPassed} · Remaining {data?.summary?.remaining}</p></Panel>
      {candidate?<><ApplicantDisplayPanel key={candidate.applicationId} clubId={s.clubId} applicationId={candidate.applicationId} sessionId={s.id} refreshKey={String(s.revision)} mode="voting" layout="slide"/><p role="status">Your ballot: {ballot?ballot.decision==="PASS"?"Pass":ballot.decision==="HOLD"?"Hold / Fringe":"Do Not Pass":"Not recorded"}</p><div className="flex flex-wrap gap-3">{(["PASS","HOLD","NOT_PASS"] as const).map(decision=><Button key={decision} className="min-h-11" disabled={busy||!data?.canVote||!!ballot||s.state!=="OPEN"||pass?.state!=="OPEN"} onClick={async()=>{setBusy(true);setError("");try{await submitVotingBallot({clubId:s.clubId,sessionId:s.id,passNumber:s.currentPass,applicationId:candidate.applicationId,decision,...(demoScoped&&member?{demoMemberId:member}:{})});await refresh()}catch(e){setError(e instanceof Error?e.message:"Ballot could not be saved.")}finally{setBusy(false)}}}>{decision==="PASS"?"Pass":decision==="HOLD"?"Hold / Fringe":"Do Not Pass"}</Button>)}</div></>:<p role="status">You’re joined. Waiting for leadership to start the next pass.</p>}
    </>}
  </div>
}
