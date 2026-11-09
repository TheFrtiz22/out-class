import { getPublicClub } from "@/actions/club-directory";
import { v1Error, v1Json } from "@/lib/api-v1";
import { withBearerIdentity } from "@/utils/bearer-context";

export const dynamic = "force-dynamic";

/** One club's public profile (same fields as the web club page). */
export async function GET(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(clubId)) return v1Json({ error: "Club not found." }, 404);
    const { club, error } = await withBearerIdentity(request, () => getPublicClub(clubId));
    if (!club) return v1Json({ error: error ?? "Club not found." }, error ? 503 : 404);
    return v1Json({ club });
  } catch (error) {
    return v1Error(error, "Club profile");
  }
}
