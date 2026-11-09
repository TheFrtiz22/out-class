import { z } from "zod";
import { getDurableNotifications, setDurableNotificationsRead } from "@/actions/communications";
import { v1Body, v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/** The signed-in student's notifications, newest first, 50 per page (same read as the web Inbox). */
export async function GET(request: Request) {
  return v1Route(request, "Inbox", async () => {
    const cursor = new URL(request.url).searchParams.get("cursor");
    const page = await getDurableNotifications(cursor ? z.string().uuid().parse(cursor) : undefined);
    return {
      unread: page.unread,
      nextCursor: page.nextCursor,
      items: page.items.map((n) => ({
        id: n.id, type: n.type, title: n.title, body: n.body, href: n.href,
        read: !!n.readAt, createdAt: n.createdAt,
        club: n.club ? { id: n.clubId, name: n.club.name, color: n.club.color, logoUrl: n.club.logoUrl } : null,
      })),
    };
  });
}

/** Marks notifications read or unread: { ids: uuid[] (max 100), read: boolean }. */
export async function POST(request: Request) {
  return v1Route(request, "Inbox update", async () => {
    const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), read: z.boolean() }).strict().parse(await v1Body(request));
    return setDurableNotificationsRead(input.ids, input.read);
  });
}
