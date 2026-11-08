import { requireBearerAuth } from "@/utils/bearer-auth";
import { accountUserInclude } from "@/lib/account-data";
import { hasWorkspace } from "@/lib/permissions";
import { v1Error, v1Json } from "@/lib/api-v1";
import { prisma } from "@/utils/prisma";

export const dynamic = "force-dynamic";

/** The signed-in account for the native app: profile, applications and active memberships. */
export async function GET(request: Request) {
  try {
    const { user } = await requireBearerAuth(request);
    const account = await prisma.user.findUnique({ where: { id: user.id }, include: accountUserInclude });
    if (!account || account.disabledAt) return v1Json({ error: "This account is unavailable." }, 403);
    return v1Json({
      ...account,
      profile: account.studentProfile,
      adminRoles: account.memberships.filter(hasWorkspace),
    });
  } catch (error) {
    return v1Error(error, "Account data");
  }
}
