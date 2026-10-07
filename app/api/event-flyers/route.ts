import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { hasPermission } from "@/lib/permissions";
import { eventIsPublished } from "@/lib/campus-events";
import { privateFlyerStorage } from "@/utils/event-flyer-storage";
import { auditSupportAction } from "@/utils/support-audit";
import { z } from "zod";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
/** Stream private bytes; never issue a public or reusable signed Storage URL. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      revision: z.coerce.number().int().min(0),
    })
    .safeParse({ eventId: q.get("eventId"), revision: q.get("revision") });
  if (!parsed.success)
    return new Response("Invalid event", { status: 400, headers });
  try {
    const { eventId, revision } = parsed.data,
      preview = q.get("preview") === "1";
    const read = () =>
      prisma.meeting.findUnique({
        where: { id: eventId },
        include: { club: { select: { suspendedAt: true } }, publication: { include: { flyer: true } } },
      });
    const e = await read();
    if (!e?.publication?.flyer || e.revision !== revision)
      return new Response("Not found", { status: 404, headers });
    if (preview) {
      const { user } = await requireAuth();
      const m = await prisma.clubMember.findUnique({
        where: { userId_clubId: { userId: user.id, clubId: e.clubId } },
      });
      if (e.club.suspendedAt || !hasPermission(m, "meetings.manage")) await requirePlatformAdmin();
      await auditSupportAction(
        "platform.impersonation.event-flyer-read",
        eventId,
      );
    } else if (!eventIsPublished(e))
      return new Response("Not found", { status: 404, headers });
    const storage = await privateFlyerStorage(),
      { data, error } = await storage.download(e.publication.flyer.path);
    if (error || !data)
      return new Response("Not found", { status: 404, headers });
    const current = await read();
    if (
      !current ||
      current.revision !== revision ||
      current.publication?.flyerId !== e.publication.flyerId ||
      (!preview && !eventIsPublished(current))
    )
      return new Response("Not found", { status: 404, headers });
    if (preview && current.club.suspendedAt) await requirePlatformAdmin();
    return new Response(await data.arrayBuffer(), {
      headers: {
        ...headers,
        "Content-Type": e.publication.flyer.mime,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("Flyer unavailable", { status: 403, headers });
  }
}
