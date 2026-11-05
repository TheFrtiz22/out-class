import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/utils/prisma';
import { processInvitationEmails } from '@/utils/invitation-delivery';

export const runtime = 'nodejs';
export const maxDuration = 60;
const CLUBS_PER_RUN = 2;
const SECOND_CLUB_START_BUDGET_MS = 20_000;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(supplied), expectedBytes = Buffer.from(expected);
  if (!secret || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Oldest due work first, one club at a time. Suspended clubs keep their rows
    // QUEUED until restoration but must not hold the head of the queue: picking
    // them would make every run a no-op for all other clubs.
    const clubs = await prisma.$queryRaw<{ clubId: string }[]>`
      SELECT i."clubId" FROM "InvitationDelivery" d
      JOIN "ClubInvitation" i ON i.id = d."invitationId"
      JOIN "Club" c ON c.id = i."clubId" AND c."suspendedAt" IS NULL
      WHERE d.status = 'QUEUED' AND d."nextAttemptAt" <= now()
      GROUP BY i."clubId" ORDER BY MIN(d."createdAt") ASC LIMIT ${CLUBS_PER_RUN}`;
    if (!clubs.length) return Response.json({ sent: 0, remaining: 0, clubs: 0 });
    const started = Date.now(), totals = { sent: 0, failed: 0, cancelled: 0, uncertain: 0, remaining: 0, clubs: 0 };
    for (const { clubId } of clubs) {
      // Each club run is bounded to ~25s; only start another while it can finish within maxDuration.
      if (totals.clubs && Date.now() - started > SECOND_CLUB_START_BUDGET_MS) break;
      const result = await processInvitationEmails(clubId, 25);
      for (const key of ['sent', 'failed', 'cancelled', 'uncertain', 'remaining'] as const) totals[key] += result[key] ?? 0;
      totals.clubs++;
      if ('paused' in result && result.paused) return Response.json({ ...totals, paused: true });
    }
    return Response.json(totals);
  } catch { return Response.json({ error: 'Delivery unavailable; queued invitations are retained.' }, { status: 503 }); }
}

// Vercel Cron invokes GET with the same bearer-secret check as POST.
export const GET = POST;
