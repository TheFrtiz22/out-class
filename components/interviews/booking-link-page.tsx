"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { getBookingApplication } from "@/lib/workspace-api"
import { ApplicantBooking } from "./applicant-booking"
export function BookingLinkPage(){
  const params=useSearchParams(),demo=useDemoMode(),auth=useAuth(),clubId=params.get("clubId"),roundId=params.get("roundId")
  const userId = auth.user?.id
  const [id,setId]=useState(""),[state,setState]=useState<"loading"|"ready"|"unavailable"|"error">("loading"),[retry,setRetry]=useState(0)
  useEffect(()=>{if(!demo.ready||auth.loading||!userId)return;let current=true;setId("");setState("loading");if(!clubId||!roundId){setState("unavailable");return}getBookingApplication(clubId,roundId).then(v=>{if(!current)return;if(v.status==="ready"){setId(v.applicationId);setState("ready")}else setState(v.status)}).catch(()=>{if(current)setState("error")});return()=>{current=false}},[clubId,roundId,demo.ready,demo.isDemoEnabled,auth.loading,userId,retry])
  return <main className="mx-auto max-w-6xl px-5 py-10"><Link href="/?workspace=student" className="text-sm text-muted-foreground hover:underline">← OutClass home</Link><h1 className="oc-page-title mt-6">Book your interview</h1>{!auth.loading&&!auth.user?<p className="mt-5 text-sm">Sign in with your applicant account, then reopen this invitation. <Link href="/login" className="underline">Sign in</Link></p>:state==="unavailable"?<section role="status" className="mt-5 space-y-3 rounded-xl border p-5 text-sm"><h2 className="font-medium">Interview invitation unavailable</h2><p>This invitation has expired or you are no longer eligible for this round. Check your applications for your current interview or booking.</p><Link href="/?workspace=student&view=tracker&section=applications" className="underline">Your applications</Link></section>:state==="error"?<div role="alert" className="mt-5 space-y-3 rounded-xl border p-5 text-sm"><p>Could not load this invitation. Please retry.</p><button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry invitation</button></div>:state==="ready"?<ApplicantBooking key={id} applicationId={id}/>:<p role="status" className="mt-5 text-sm">Loading your invitation…</p>}</main>
}
