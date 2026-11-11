"use server";

import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewScopeSchema } from "@/lib/interview-access";
import { interviewDraftSchema } from "@/lib/interview-kits";
import { collaborationSession } from "@/utils/interview-collaboration";
import { interviewTransactionOptions } from "@/utils/interview-access";
import { interviewTiming } from "@/lib/interview-session-timing";
import { applyTimerCommand, freshTimerState, presentTimer, timerCommandSchema, type TimerControlResult } from "@/lib/interview-shared-timer";

const controlSchema = interviewScopeSchema.extend({
  // The timer revision the device last saw; 0 means no one has pressed a control yet.
  revision: z.number().int().min(0),
  requestId: z.string().uuid(),
  command: timerCommandSchema,
}).strict();

/** Start, pause, resume, reset or adjust the room's shared countdown.
 * Same authority as shared question selection: current panel access to this
 * application, round and booked room (collaborationSession), re-checked on every
 * call under the application lock, which also orders simultaneous presses.
 * A stale revision is not an error: the caller gets the current timer back. */
export async function controlInterviewTimer(input: z.infer<typeof controlSchema>): Promise<TimerControlResult> {
  const data = controlSchema.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async (tx): Promise<TimerControlResult> => {
    const { member, session, round, booking, app, record } = await collaborationSession(tx, data, user.id);
    // Same rule as selectSharedInterviewQuestion: a submitted or closing reviewer no longer drives the room.
    if (record.completedAt || interviewDraftSchema.parse(record.draft).postInterview || round.archivedAt || app.roundId !== round.id) throw Error("Only active interviews can use the shared timer.");
    const timing = interviewTiming(data, round.configuration, booking);
    const row = await tx.interviewTimer.findUnique({ where: { sessionId: session.id } });
    const now = Date.now();
    if (!timing) return { status: "conflict", timer: presentTimer(row, timing, now) };
    // A retried request (lost response) returns the state it produced, never applies twice.
    if (row && row.lastRequestId === data.requestId) return { status: "ok", timer: presentTimer(row, timing, now) };
    if ((row?.revision ?? 0) !== data.revision) return { status: "conflict", timer: presentTimer(row, timing, now) };
    const current = row ? presentTimer(row, timing, now)! : freshTimerState(timing);
    const next = applyTimerCommand(current, data.command, now, timing);
    if (!next) return { status: "conflict", timer: presentTimer(row, timing, now) };
    const values = { durationMs: next.durationMs, contextKey: next.contextKey, startedAt: next.startedAt === null ? null : new Date(next.startedAt), pausedAt: next.pausedAt === null ? null : new Date(next.pausedAt), pausedMs: next.pausedMs, lastRequestId: data.requestId, updatedBy: member.id, updatedAt: new Date(now) };
    let saved;
    if (row) {
      const result = await tx.interviewTimer.updateMany({ where: { sessionId: session.id, revision: row.revision }, data: { ...values, revision: { increment: 1 } } });
      if (result.count !== 1) return { status: "conflict", timer: presentTimer(await tx.interviewTimer.findUnique({ where: { sessionId: session.id } }), timing, Date.now()) };
      saved = await tx.interviewTimer.findUnique({ where: { sessionId: session.id } });
    } else saved = await tx.interviewTimer.create({ data: { sessionId: session.id, ...values, revision: 1 } });
    return { status: "ok", timer: presentTimer(saved, timing, now) };
  }, interviewTransactionOptions);
}
