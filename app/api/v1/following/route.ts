import { getCorkboard, setCorkboardClub } from "@/actions/club-directory";
import { v1Body, v1Route } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/** Clubs the student follows (the web's Follow / saved clubs). */
export async function GET(request: Request) {
  return v1Route(request, "Following", () => getCorkboard());
}

/** Follow or unfollow: { clubId, saved }. Validated by the action's own schema. */
export async function POST(request: Request) {
  return v1Route(request, "Follow", async () => setCorkboardClub(await v1Body(request)));
}
