import { PageHeader } from "@/components/ui/page-header"
import { VotingSlidePreparation } from "@/components/live-voting/slide-preparation";
import { z } from "zod";
export default async function Page({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{clubId?:string}>}){
  const p=await params,q=await searchParams;
  if(!z.string().uuid().safeParse(p.sessionId).success||!z.string().uuid().safeParse(q.clubId).success)return <PageHeader title="Invalid voting session link" />;
  return <VotingSlidePreparation clubId={q.clubId!} sessionId={p.sessionId}/>;
}
