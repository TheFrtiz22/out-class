import { PageHeader } from "@/components/ui/page-header"
import { VotingRoomSetup } from "@/components/live-voting/room-setup";
import { z } from "zod";
import {redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
export default async function Page({searchParams}:{searchParams:Promise<{clubId?:string;demo?:string;cycleId?:string;roundId?:string;selection?:string;draft?:string;session?:string}>}){const q=await searchParams;if(!z.string().uuid().safeParse(q.clubId).success)return <PageHeader title="Choose a club from your workspace to prepare voting." />;if(!z.string().uuid().safeParse(q.draft).success){const query=new URLSearchParams(Object.entries(q).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));query.set('draft',z.string().uuid().safeParse(q.session).success?q.session!:randomUUID());redirect(`/voting/rooms/new?${query}`);}return <VotingRoomSetup clubId={q.clubId!} demoScoped={q.demo==="1"} initialCycleId={q.cycleId} initialRoundId={q.roundId} selectionKey={q.selection} draftId={q.draft} editSession={z.string().uuid().safeParse(q.session).success?q.session:undefined}/>;}
