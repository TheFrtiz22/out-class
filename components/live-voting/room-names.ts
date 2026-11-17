import type {useLiveVotingRoom} from "@/hooks/use-live-voting-room";

/** Plain helpers over the room snapshot, shared by the projector, the leader screen and the setup preview. */
export type RoomSnapshot=NonNullable<ReturnType<typeof useLiveVotingRoom>["room"]>;
export type Entry=RoomSnapshot["history"][number]["candidates"][number];
export const resultWords={ACCEPT:"Passed",HOLD:"Held",REJECT:"Did not pass"} as const;

/** Where the room is: the current applicant's place in this pass, as "Applicant 8 of 12" (or "Applicant 1 of 3 · Pass 2"). */
export function applicantPosition(room:RoomSnapshot){
 const pass=room.history.find(p=>p.number===room.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room.currentApplicantId);
 // From the second pass on (held applicants), the pass is named too.
 return entry&&pass?`Applicant ${entry.position+1} of ${pass.candidates.length}${room.passNumber>1?` · Pass ${room.passNumber}`:""}`:"";
}
/** The next applicant in this pass after the current one, or null at the end of the pass. */
export function nextApplicant(room:RoomSnapshot){
 const pass=room.history.find(p=>p.number===room.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room.currentApplicantId);
 if(!pass||!entry)return null;
 return [...pass.candidates].sort((a,b)=>a.position-b.position).find(c=>c.position>entry.position)??null;
}
export function roundLine(room:RoomSnapshot){return [room.roundName,room.cycleName].filter(Boolean).join(" · ");}
export function shortLinkText(url:string){return url.replace(/^https?:\/\//,"");}

/** Names come from the leader-only summary labels; without them the applicant's number is shown. */
export function nextName(room:RoomSnapshot,labels:readonly {id:string;label:string}[]|undefined){
 const next=nextApplicant(room);
 return next?labels?.find(l=>l.id===next.applicationId)?.label??`Applicant ${next.position+1}`:null;
}
/** Confirmed outcomes only: re-read summaries when this changes, never on each ballot. */
export function outcomeSignature(room:{outcomes:readonly {applicationId:string;passNumber:number;outcome:string}[]}){return room.outcomes.map(o=>`${o.applicationId}:${o.passNumber}:${o.outcome}`).join("|");}
