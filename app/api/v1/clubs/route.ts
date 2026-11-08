import { getClubDirectory } from "@/actions/club-directory";
import { requireBearerAuth } from "@/utils/bearer-auth";
import { v1Error, v1Json } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * Club directory for the native Explore tab. Same public fields and the same
 * cached read as the web directory; the app requires a signed-in account.
 */
export async function GET(request: Request) {
  try {
    await requireBearerAuth(request);
    const { clubs, error } = await getClubDirectory();
    if (error) return v1Json({ error }, 503);
    return v1Json({ clubs });
  } catch (error) {
    return v1Error(error, "Club directory");
  }
}
