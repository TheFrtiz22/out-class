import { z } from "zod";
import { setSavedCampusEvent } from "@/actions/campus-events";
import { v1Body, v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/** Save or unsave a campus event: { saved: boolean }. */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return v1Route(request, "Save event", async () => {
    const { eventId } = await params;
    const { saved } = z.object({ saved: z.boolean() }).strict().parse(await v1Body(request));
    return setSavedCampusEvent({ eventId, saved });
  });
}
