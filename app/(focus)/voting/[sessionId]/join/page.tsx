import { PageHeader } from "@/components/product/page-header"
import Link from "next/link"
import { z } from "zod"
import { VotingSessionJoin } from "@/components/live-voting/session-join"
export default async function VotingJoinPage({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{demo?:string}>}){
  const {sessionId}=await params,query=await searchParams
  if(!z.string().uuid().safeParse(sessionId).success)return <div className="space-y-4"><PageHeader title="Invalid voting session link" /><Link href="/" className="underline">Return to OutClass</Link></div>
  return <VotingSessionJoin sessionId={sessionId} demoScoped={query.demo==="1"}/>
}
