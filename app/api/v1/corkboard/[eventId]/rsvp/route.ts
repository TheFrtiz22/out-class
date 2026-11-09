import { z } from "zod";
import { setCampusEventRsvp } from "@/actions/campus-events";
import { v1Body, v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/** RSVP to a campus event: { going: boolean }. Capacity and deadline are enforced by the action. */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return v1Route(request, "RSVP", async () => {
    const { eventId } = await params;
    const { going } = z.object({ going: z.boolean() }).strict().parse(await v1Body(request));
    return setCampusEventRsvp({ eventId, going });
  });
}
