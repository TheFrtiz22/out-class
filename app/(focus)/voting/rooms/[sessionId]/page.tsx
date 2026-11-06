import { PageHeader } from "@/components/product/page-header"
import { LiveVotingEntry } from "@/components/live-voting/room-view";
import { z } from "zod";
export default async function Page({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{clubId?:string;view?:string;demo?:string}>}){const p=await params,q=await searchParams;if(!z.string().uuid().safeParse(p.sessionId).success||!z.string().uuid().safeParse(q.clubId).success)return <PageHeader title="Invalid voting session link" />;return <LiveVotingEntry clubId={q.clubId!} sessionId={p.sessionId} view={q.view==="leader"?"leader":q.view==="present"?"present":"member"} demoScoped={q.demo==="1"}/>;}
