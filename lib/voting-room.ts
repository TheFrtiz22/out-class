import { z } from "zod";
import { votingDisplaySchema, defaultVotingDisplay } from "@/lib/voting-presentation";

export const roomChoice = z.enum(["ACCEPT", "HOLD", "REJECT"]);
export const storedChoice = { ACCEPT: "PASS", HOLD: "HOLD", REJECT: "NOT_PASS" } as const;
export function publicChoice(value: string | null):"ACCEPT"|"HOLD"|"REJECT"|"UNREVIEWED" { return value === "PASS" ? "ACCEPT" : value === "NOT_PASS" ? "REJECT" : value === "HOLD" ? "HOLD" : "UNREVIEWED"; }
export const roomScope = z.object({ clubId: z.string().uuid(), sessionId: z.string().uuid() }).strict();
export const liveRoomFields=["photo","name","major","academicYear","gpa","sat","act","resumeHighlight","interviewScore"] as const;
export type LiveRoomField=typeof liveRoomFields[number];
export const roomPresentationSchema=z.object({fields:z.array(z.enum(liveRoomFields)).max(9).refine(v=>new Set(v).size===v.length),highlights:z.record(z.string().uuid(),z.string().uuid()).default({})}).strict();
export function roomDisplayConfig(fields:LiveRoomField[]){return {version:1 as const,fields:fields.filter((f):f is Exclude<LiveRoomField,"resumeHighlight"|"interviewScore">=>f!=="resumeHighlight"&&f!=="interviewScore")};}
export function liveRoomPath(clubId:string,sessionId:string,view:"leader"|"present"|"member"="member",demo=false){return `/voting/rooms/${encodeURIComponent(sessionId)}?clubId=${encodeURIComponent(clubId)}&view=${view}${demo?"&demo=1":""}`;}
export const createRoomSchema = roomScope.extend({
  cycleId: z.string().uuid(), roundId: z.string().uuid(),
  leaderMemberIds: z.array(z.string().uuid()).min(1).max(50),
  participantIds: z.array(z.string().uuid()).min(1).max(500),
  applicationIds: z.array(z.string().uuid()).min(1).max(2000),
  targetSize: z.number().int().min(1).max(2000).nullable().default(null), displayConfig: votingDisplaySchema.default(defaultVotingDisplay),
  presentationOptions:roomPresentationSchema.optional(),
});
export const roomCommandSchema = roomScope.extend({ requestId: z.string().uuid(), revision: z.number().int().nonnegative(),
  action: z.enum(["START", "OPEN_VOTING", "CLOSE_VOTING", "CONFIRM", "ACCEPT_WITHOUT_VOTE", "ADVANCE", "NEXT_PASS", "END", "FINALIZE", "CORRECT"]),
  confirmed: z.boolean().optional(),
  applicationId: z.string().uuid().optional(), passNumber: z.number().int().positive().optional(),
  choice: roomChoice.optional(), reason: z.string().trim().min(1).max(1000).optional(),
});
export const roomBallotSchema = roomScope.extend({ requestId: z.string().uuid(), passNumber: z.number().int().positive(), applicationId: z.string().uuid(), choice: roomChoice, ballotRevision: z.number().int().nonnegative().nullable() });
export function uniqueSelection(values: string[]) { if (new Set(values).size !== values.length) throw Error("Duplicate selection."); }
export type RoomEntry = { applicationId: string; passNumber?: number; position: number; ballotState: string; confirmedDecision: string | null; ballots: { memberId: string; decision: string; revision: number }[] };
export function roomOutcomes(s: { candidates: { applicationId: string }[]; passes: { number: number; candidates: RoomEntry[] }[] }) {
  return s.candidates.map(c => {
    const ordered=[...s.passes].sort((a,b)=>b.number-a.number);
    // An unfinished revisit does not erase the previously confirmed Hold.
    const pass = ordered.find(p => p.candidates.some(e => e.applicationId === c.applicationId && e.confirmedDecision))
      ?? ordered.find(p => p.candidates.some(e => e.applicationId === c.applicationId));
    const entry = pass?.candidates.find(e => e.applicationId === c.applicationId);
    return { applicationId: c.applicationId, passNumber: pass?.number ?? 0, outcome: publicChoice(entry?.confirmedDecision ?? null) };
  });
}
export function roomTally(entry: RoomEntry) { return { ACCEPT: entry.ballots.filter(b => b.decision === "PASS").length, HOLD: entry.ballots.filter(b => b.decision === "HOLD").length, REJECT: entry.ballots.filter(b => b.decision === "NOT_PASS").length }; }
export function recommendedOutcome(entry: RoomEntry, _count?: number) {
  const choice=leadingBallotChoice(roomTally(entry));return choice?storedChoice[choice]:null;
}
export function leadingBallotChoice(totals:ReturnType<typeof roomTally>){const highest=Math.max(...Object.values(totals)),leaders=Object.entries(totals).filter(([,n])=>n===highest);return highest>0&&leaders.length===1?leaders[0][0] as keyof typeof storedChoice:null;}
export const finalizationMapping=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("ADVANCE"),roundId:z.string().uuid()}).strict(),
 z.object({kind:z.literal("ADMISSION")}).strict(),
]);
export const finalizationPreviewInput=roomScope.extend({mapping:finalizationMapping});
export const finalizeRoomInput=finalizationPreviewInput.extend({requestId:z.string().uuid(),revision:z.number().int().nonnegative(),guard:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)});
