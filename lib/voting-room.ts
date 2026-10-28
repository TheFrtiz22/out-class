import { z } from "zod";
import { votingDisplaySchema, defaultVotingDisplay } from "@/lib/voting-presentation";
import { ballotOutcome } from "@/lib/voting-engine";

export const roomChoice = z.enum(["ACCEPT", "HOLD", "REJECT"]);
export const storedChoice = { ACCEPT: "PASS", HOLD: "HOLD", REJECT: "NOT_PASS" } as const;
export function publicChoice(value: string | null) { return value === "PASS" ? "ACCEPT" : value === "NOT_PASS" ? "REJECT" : value === "HOLD" ? "HOLD" : "UNREVIEWED"; }
export const roomScope = z.object({ clubId: z.string().uuid(), sessionId: z.string().uuid() }).strict();
export const createRoomSchema = roomScope.extend({
  cycleId: z.string().uuid(), roundId: z.string().uuid(),
  leaderMemberIds: z.array(z.string().uuid()).min(1).max(50),
  participantIds: z.array(z.string().uuid()).min(1).max(500),
  applicationIds: z.array(z.string().uuid()).min(1).max(2000),
  targetSize: z.number().int().min(1).max(2000), displayConfig: votingDisplaySchema.default(defaultVotingDisplay),
});
export const roomCommandSchema = roomScope.extend({ requestId: z.string().uuid(), revision: z.number().int().nonnegative(),
  action: z.enum(["START", "OPEN_VOTING", "CLOSE_VOTING", "CONFIRM", "ADVANCE", "NEXT_PASS", "END", "FINALIZE", "CORRECT"]),
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
export function recommendedOutcome(entry: RoomEntry, count: number) { return ballotOutcome(entry.ballots, count, "NONE", 100).outcome; }
