import { PageHeader } from "@/components/ui/page-header"
import Link from "next/link"
import { redirect } from "next/navigation"
import { z } from "zod"
import { VotingSessionJoin } from "@/components/live-voting/session-join"
import { liveRoomHrefForLegacyLink } from "@/utils/legacy-voting-link"

export const metadata = { title: "Join live voting", robots: { index: false, follow: false } }
export default async function VotingJoinPage({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{demo?:string}>}){
  const {sessionId}=await params,query=await searchParams
  if(!z.string().uuid().safeParse(sessionId).success)return <div className="space-y-4"><PageHeader title="Invalid voting session link" /><Link href="/" className="underline">Return to OutClass</Link></div>
  // A live room is joined from its own page; this join flow serves board-mode sessions only.
  const href=query.demo==="1"?null:await liveRoomHrefForLegacyLink(sessionId)
  if(href)redirect(href)
  return <VotingSessionJoin sessionId={sessionId} demoScoped={query.demo==="1"}/>
}
