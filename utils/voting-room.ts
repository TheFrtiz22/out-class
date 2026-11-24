import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { editorValue } from "@/lib/editor-value";
export function roomFingerprint(value:unknown) { return createHash("sha256").update(editorValue(value)).digest("hex"); }

/** Domain-separated key from the existing server-only secret (same derivation pattern as
 * utils/admin-elevation.ts). No secret configured means no tokens: callers keep the strict revision check. */
function roomViewKey(){
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret?createHash("sha256").update("outclass-voting-room-view-v1\0"+secret).digest():null;
}
type RoomView={sessionId:string;revision:number;viewedAt:string;memberId:string};
const roomViewPayload=(v:RoomView)=>JSON.stringify([v.sessionId,v.revision,v.viewedAt,v.memberId]);
/** Binds a room snapshot's server read time to that snapshot, session, revision and viewer. */
export function signRoomView(v:RoomView){const key=roomViewKey();return key?createHmac("sha256",key).update(roomViewPayload(v)).digest("hex"):null;}
export function verifyRoomView(v:RoomView,token:string|undefined|null){
  const key=roomViewKey();if(!key||!token||!/^[a-f0-9]{64}$/.test(token))return false;
  const expected=createHmac("sha256",key).update(roomViewPayload(v)).digest();
  return timingSafeEqual(expected,Buffer.from(token,"hex"));
}

/** Every room projection, rule and tally reads only these ballot fields (lib/voting-room.ts RoomEntry). */
export const roomBallotSelect = { memberId: true, decision: true, revision: true } as const;
export const roomInclude = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const }, include: { ballots: { select: roomBallotSelect } } } } } };
export type LiveRoom = Prisma.VotingSessionGetPayload<{ include: typeof roomInclude }>;
/** Round-wide counts read confirmed outcomes and room access only, never ballots (lib/voting-target-summary.ts). */
export const roomOutcomeInclude = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const } } } } };
export type RoomOutcomes = Prisma.VotingSessionGetPayload<{ include: typeof roomOutcomeInclude }>;
/**
 * The room as `roomInclude` describes it. Ballots come from one flat, indexed read joined here by
 * (pass, applicant): Prisma's nested include matched 12,000 ballots to their candidates in about
 * 150 ms per poll for a 400-applicant, 30-voter room, and every voter polls every few seconds.
 */
async function loadRoomWithBallots(tx: AppTransactionClient, clubId: string, sessionId: string): Promise<LiveRoom | null> {
  const room = await tx.votingSession.findFirst({ where: { id: sessionId, clubId, mode: "LIVE" }, include: roomOutcomeInclude });
  if (!room) return null;
  const ballots = await tx.votingBallot.findMany({ where: { sessionId: room.id }, select: { passNumber: true, applicationId: true, ...roomBallotSelect } });
  const byEntry = new Map<string, LiveRoom["passes"][number]["candidates"][number]["ballots"]>();
  for (const { passNumber, applicationId, ...ballot } of ballots) {
    const key = `${passNumber}:${applicationId}`, entry = byEntry.get(key);
    if (entry) entry.push(ballot); else byEntry.set(key, [ballot]);
  }
  return { ...room, passes: room.passes.map(pass => ({ ...pass, candidates: pass.candidates.map(entry => ({ ...entry, ballots: byEntry.get(`${pass.number}:${entry.applicationId}`) ?? [] })) })) };
}
export async function loadVotingRoom(tx: AppTransactionClient, clubId: string, sessionId: string, write = false) {
  if (write) await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${sessionId} AND "clubId"=${clubId} FOR UPDATE`;
  const s = await loadRoomWithBallots(tx, clubId, sessionId);
  if (!s) throw Error("Voting room unavailable.");
  const round = await tx.pipelineRound.findFirst({ where: { id: s.roundId, clubId } });
  const cycle = s.cycleId ? await tx.recruitmentCycle.findFirst({ where: { id: s.cycleId, clubId } }) : null;
  if (!round || !cycle || (write && (round.archivedAt || cycle.archivedAt))) throw Error("Voting scope unavailable or archived.");
  return { s, round, cycle };
}
export { roomAuthority,requireRoomLeader,projectVotingRoom,undoableDecision,onRoomRoster,roomRosterIds } from "@/lib/voting-room-projection";
