"use client";
import { SCHEDULING_TIMEZONE, schedulingDateTime } from "@/lib/scheduling-config"
import type { Notification } from "@/lib/data";
import type { getDurableNotifications } from "@/actions/communications";
export const communicationsChanged = () => window.dispatchEvent(new Event("outclass:communications-changed"));
const notificationTypes: Record<string, Notification["type"]> = {
  DECISION: "Decision Available", OFFER_RESPONSE: "Offer Confirmation", ANNOUNCEMENT: "Announcement", INTERVIEW: "Interview Invite", APPLICATION: "Application Update",
  INVITATION: "Club Invitation", TASK: "Task", PLATFORM: "OutClass Update", MESSAGE: "Private Message",
};
/**
 * The one-line list preview of a notification body. A body of separate lines (a panel schedule's sessions) is joined
 * with " · " so the sessions read apart; prose lines that end a sentence are joined with a space.
 */
export function notificationPreview(body: string) {
  const lines = body.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const joined = lines.reduce((text, line, index) => index === 0 ? line : `${text}${/[.!?:]$/.test(lines[index - 1]) ? " " : " · "}${line}`, "")
  return joined.length > 160 ? `${joined.slice(0, 159).trimEnd()}…` : joined
}
export function inboxNotification(item: Awaited<ReturnType<typeof getDurableNotifications>>["items"][number]): Notification {
  return { applicationId: item.href.match(/^\/applications\/([^/]+)\/decision/)?.[1], id: `durable-${item.id}`, durableId: item.id, href: item.href, clubId: item.clubId ?? undefined,
    ...(item.announcementId ? { announcementId: item.announcementId, ownAnnouncement: item.ownAnnouncement } : {}),
    ...(item.type === "TASK" ? { taskHref: item.href } : {}),
    type: notificationTypes[item.type] ?? "OutClass Update", urgent: item.type === "INTERVIEW",
    club: item.club?.name || "OutClass", color: item.club?.color || "#142d45", logoUrl: item.club?.logoUrl, marketing: item.club?.marketing, logoText: (item.club?.name || "OC").slice(0, 2),
    senderName: item.club?.name || "OutClass", senderTitle: item.type === "MESSAGE" ? "Private message" : "Club update",
    title: item.title, preview: notificationPreview(item.body), body: [item.body], timestamp: new Date(item.createdAt).toLocaleDateString("en-US", { timeZone: SCHEDULING_TIMEZONE }), fullDate: schedulingDateTime(item.createdAt), createdAt: new Date(item.createdAt).toISOString(), read: !!item.readAt, cta: item.eventKey?.startsWith("interview-assignment:") ? "Open interview room" : item.href.startsWith("/settings/interviews") ? "View my schedule" : item.href.startsWith("/interviews/book") ? (item.eventKey?.includes(":confirmed:") ? "View interview" : "Book interview") : item.type === "DECISION" ? "View Decision" : item.type === "OFFER_RESPONSE" ? "View response" : item.type === "MESSAGE" ? "Open conversation" : item.type === "TASK" ? "View task" : item.type === "APPLICATION" || item.type === "INTERVIEW" ? "View application" : item.type === "INVITATION" ? "Review invitation" : undefined };
}
