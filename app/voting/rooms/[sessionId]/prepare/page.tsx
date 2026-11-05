import { VotingSlidePreparation } from "@/components/live-voting/slide-preparation";
import { z } from "zod";
export default async function Page({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{clubId?:string}>}){
  const p=await params,q=await searchParams;
  if(!z.string().uuid().safeParse(p.sessionId).success||!z.string().uuid().safeParse(q.clubId).success)return <main className="p-6"><h1>Invalid voting session link</h1></main>;
  return <VotingSlidePreparation clubId={q.clubId!} sessionId={p.sessionId}/>;
}
