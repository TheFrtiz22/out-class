import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/utils/prisma';
import { processInvitationEmails } from '@/utils/invitation-delivery';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(supplied), expectedBytes = Buffer.from(expected);
  if (!secret || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pending = await prisma.invitationDelivery.findFirst({ where: { status: 'QUEUED', nextAttemptAt: { lte: new Date() } }, include: { invitation: { select: { clubId: true } } }, orderBy: { createdAt: 'asc' } });
    if (!pending) return Response.json({ sent: 0, remaining: 0 });
    return Response.json(await processInvitationEmails(pending.invitation.clubId, 25));
  } catch { return Response.json({ error: 'Delivery unavailable; queued invitations are retained.' }, { status: 503 }); }
}

// Vercel Cron invokes GET with the same bearer-secret check as POST.
export const GET = POST;
