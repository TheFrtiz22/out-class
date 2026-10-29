import { VotingRoomSetup } from "@/components/live-voting/room-setup";
import { z } from "zod";
export default async function Page({searchParams}:{searchParams:Promise<{clubId?:string;demo?:string}>}){const q=await searchParams;if(!z.string().uuid().safeParse(q.clubId).success)return <main className="p-6"><h1>Choose a club from your workspace to prepare voting.</h1></main>;return <VotingRoomSetup clubId={q.clubId!} demoScoped={q.demo==="1"}/>;}
