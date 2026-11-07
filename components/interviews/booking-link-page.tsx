"use client"
import { LoadingState } from "@/components/ui/loading-state"
import { PageHeader } from "@/components/ui/page-header"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { getBookingApplication } from "@/lib/workspace-api"
import { ApplicantBooking } from "./applicant-booking"
import { Panel } from "@/components/ui/panel"
import { Button } from "@/components/ui/button"
export function BookingLinkPage(){
  const params=useSearchParams(),demo=useDemoMode(),auth=useAuth(),clubId=params.get("clubId"),roundId=params.get("roundId")
  const userId = auth.user?.id
  const [id,setId]=useState(""),[state,setState]=useState<"loading"|"ready"|"unavailable"|"error">("loading"),[retry,setRetry]=useState(0)
  useEffect(()=>{if(!demo.ready||auth.loading||!userId)return;let current=true;setId("");setState("loading");if(!clubId||!roundId){setState("unavailable");return}getBookingApplication(clubId,roundId).then(v=>{if(!current)return;if(v.status==="ready"){setId(v.applicationId);setState("ready")}else setState(v.status)}).catch(()=>{if(current)setState("error")});return()=>{current=false}},[clubId,roundId,demo.ready,demo.isDemoEnabled,auth.loading,userId,retry])
  return <div><PageHeader title="Book your interview" />{!auth.loading&&!auth.user?<p className="mt-5 text-sm">Sign in with your applicant account, then reopen this invitation. <Link href="/login" className="underline">Sign in</Link></p>:state==="unavailable"?<Panel as="section" role="status" className="mt-5 space-y-3 text-sm"><h2 className="font-medium">Interview invitation unavailable</h2><p>This invitation has expired, or it’s no longer available for this round. Check your applications for your current interview.</p><Link href="/applications" className="underline">Your applications</Link></Panel>:state==="error"?<Panel role="alert" className="mt-5 space-y-3 text-sm"><p>Could not load this invitation. Please retry.</p><Button type="button" variant="link" className="h-auto min-h-11 px-0" onClick={()=>setRetry(n=>n+1)}>Retry invitation</Button></Panel>:state==="ready"?<ApplicantBooking key={id} applicationId={id}/>:<LoadingState label="Loading your invitation…" layout="calendar" rows={3} />}</div>
}
