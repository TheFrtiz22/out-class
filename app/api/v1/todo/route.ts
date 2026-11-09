import { getTaskNotifications } from "@/actions/tasks";
import { v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/** Club tasks assigned to the signed-in student across active memberships (same read as the web). */
export async function GET(request: Request) {
  return v1Route(request, "To-do", async () => {
    const items = await getTaskNotifications();
    return {
      items: items.map((n) => ({
        id: n.id, title: n.title, preview: n.preview, club: n.club, clubId: n.clubId, color: n.color,
        urgent: n.urgent, dueAt: n.taskActivity?.dueAt ?? null, needsSubmission: n.taskActivity?.needsSubmission ?? false,
        href: n.taskHref ?? n.href ?? null, createdAt: n.createdAt ?? null,
      })),
    };
  });
}
