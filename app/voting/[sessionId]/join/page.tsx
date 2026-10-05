import Link from "next/link"
import { z } from "zod"
import { VotingSessionJoin } from "@/components/live-voting/session-join"
export default async function VotingJoinPage({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{demo?:string}>}){
  const {sessionId}=await params,query=await searchParams
  if(!z.string().uuid().safeParse(sessionId).success)return <main className="p-8"><h1 className="oc-page-title">Invalid voting session link</h1><Link href="/" className="underline">Return to OutClass</Link></main>
  return <VotingSessionJoin sessionId={sessionId} demoScoped={query.demo==="1"}/>
}
