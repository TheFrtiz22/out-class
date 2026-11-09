import { z } from "zod";
import { getMyCampusEventRsvps, getPublicCorkboard, getSavedCampusEventIds } from "@/actions/campus-events";
import { v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

const query = z.object({
  period: z.enum(["All", "Today", "This Week", "Weekend"]).default("All"),
  query: z.string().max(120).optional(),
  // 1-based for the app; the action's page is 0-based.
  page: z.coerce.number().int().min(1).max(50).default(1).transform((page) => page - 1),
});

/** Published campus events (same read as the web Corkboard), plus the student's saves and RSVPs. */
export async function GET(request: Request) {
  return v1Route(request, "Corkboard", async () => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const filters = query.parse(params);
    const [board, saved, rsvps] = await Promise.all([getPublicCorkboard(filters), getSavedCampusEventIds(), getMyCampusEventRsvps()]);
    return { ...board, saved, going: rsvps.map((r) => r.eventId) };
  });
}
