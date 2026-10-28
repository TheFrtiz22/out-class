import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { createHash } from "node:crypto";
import { editorValue } from "@/lib/editor-value";
export function roomFingerprint(value:unknown) { return createHash("sha256").update(editorValue(value)).digest("hex"); }

export const roomInclude = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const }, include: { ballots: true } } } } };
export type LiveRoom = Prisma.VotingSessionGetPayload<{ include: typeof roomInclude }>;
export async function loadVotingRoom(tx: AppTransactionClient, clubId: string, sessionId: string, write = false) {
  if (write) await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${sessionId} AND "clubId"=${clubId} FOR UPDATE`;
  const s = await tx.votingSession.findFirst({ where: { id: sessionId, clubId, mode: "LIVE" }, include: roomInclude });
  if (!s) throw Error("Voting room unavailable.");
  const round = await tx.pipelineRound.findFirst({ where: { id: s.roundId, clubId } });
  const cycle = s.cycleId ? await tx.recruitmentCycle.findFirst({ where: { id: s.cycleId, clubId } }) : null;
  if (!round || !cycle || (write && (round.archivedAt || cycle.archivedAt))) throw Error("Voting scope unavailable or archived.");
  return { s, round };
}
export { roomAuthority,requireRoomLeader,projectVotingRoom } from "@/lib/voting-room-projection";
