import type React from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { LiveVotingEntry } from "@/components/live-voting/room-view";
import { votingRoomPageAccess } from "@/utils/voting-room-page-access";
import { CLUB_SUSPENDED_MESSAGE } from "@/lib/club-suspension";
import { z } from "zod";
import "@/components/live-voting/room.css";
export default async function Page({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{clubId?:string;view?:string;demo?:string}>}){const p=await params,q=await searchParams;if(!z.string().uuid().safeParse(p.sessionId).success||!z.string().uuid().safeParse(q.clubId).success)return <PageHeader title="Invalid voting session link" />;const view=q.view==="leader"?"leader":q.view==="present"?"present":"member";
// Leader and presentation views check access before rendering, so a refused viewer sees an access state, not a connection error. The member view has its own join check.
const access=view!=="member"&&q.demo!=="1"?await votingRoomPageAccess(q.clubId!,p.sessionId):"CONTINUE";
const present=(node:React.ReactNode)=>view==="present"?<div data-theme="present" className="oc-present-surface">{node}</div>:node;
if(access!=="CONTINUE")return present(<div className="vr-page vr-member"><PageHeader title="Live voting" />{access==="DENIED"?<p role="alert">You don’t have access to this voting session. Ask a club leader if you think that’s wrong.</p>:access==="SUSPENDED"?<p role="alert">{CLUB_SUSPENDED_MESSAGE}</p>:<p role="status">This session link is expired or unavailable.</p>}<Link className="vr-link" href="/">Return to OutClass</Link></div>);
const entry=<LiveVotingEntry clubId={q.clubId!} sessionId={p.sessionId} view={view} demoScoped={q.demo==="1"}/>;
// The projector is the only dark surface; the focus frame follows this marker in CSS, from the server render on.
return present(entry);}
