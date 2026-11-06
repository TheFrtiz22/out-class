import { PageHeader } from "@/components/ui/page-header"
import { LiveVotingEntry } from "@/components/live-voting/room-view";
import { z } from "zod";
export default async function Page({params,searchParams}:{params:Promise<{sessionId:string}>;searchParams:Promise<{clubId?:string;view?:string;demo?:string}>}){const p=await params,q=await searchParams;if(!z.string().uuid().safeParse(p.sessionId).success||!z.string().uuid().safeParse(q.clubId).success)return <PageHeader title="Invalid voting session link" />;const view=q.view==="leader"?"leader":q.view==="present"?"present":"member";const entry=<LiveVotingEntry clubId={q.clubId!} sessionId={p.sessionId} view={view} demoScoped={q.demo==="1"}/>;
// The projector is the only dark surface; the focus frame follows this marker in CSS, from the server render on.
return view==="present"?<div data-theme="present" className="oc-present-surface">{entry}</div>:entry;}
