"use client";
import type { Notification } from "@/lib/data";
import type { getDurableNotifications } from "@/actions/communications";
export const communicationsChanged = () => window.dispatchEvent(new Event("outclass:communications-changed"));
export function inboxNotification(item: Awaited<ReturnType<typeof getDurableNotifications>>["items"][number]): Notification {
  return { id: `durable-${item.id}`, durableId: item.id, href: item.href, clubId: item.clubId ?? undefined,
    ...(item.type === "TASK" ? { taskHref: item.href } : {}),
    type: item.type === "INTERVIEW" ? "Interview Invite" : "Announcement", urgent: item.type === "INTERVIEW",
    club: item.club?.name || "OutClass", color: item.club?.color || "#142d45", logoUrl: item.club?.logoUrl, logoText: (item.club?.name || "OC").slice(0, 2),
    senderName: item.club?.name || "OutClass", senderTitle: item.type === "MESSAGE" ? "Private message" : "Club update",
    title: item.title, preview: item.body.slice(0, 160), body: [item.body], timestamp: new Date(item.createdAt).toLocaleDateString(), fullDate: new Date(item.createdAt).toLocaleString(), createdAt: new Date(item.createdAt).toISOString(), read: !!item.readAt, cta: item.type === "MESSAGE" ? "Open conversation" : item.type === "TASK" ? "View task" : item.type === "APPLICATION" || item.type === "INTERVIEW" ? "View application" : item.type === "INVITATION" ? "Review invitation" : undefined };
}
