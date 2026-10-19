import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { requireAuth } from "@/utils/auth";
import { hasWorkspace } from "@/lib/permissions";
import { accountUserInclude } from "@/lib/account-data";
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { cookies } from 'next/headers';

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value === "1") return reply({ error: "Live account access is unavailable in this mode." }, 403);
    const { user, impersonation } = await requireAuth();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: accountUserInclude,
    });

    if (userData?.disabledAt) return reply({ error: "Account unavailable" }, 403);
    if (!userData) return reply({ error: 'User not found' }, 404);

    // Filter memberships to determine where the user holds leadership permissions
    const adminRoles = userData.memberships.filter(
      hasWorkspace
    );

    return reply({
      ...userData,
      impersonating: !!impersonation,
      profile: userData.studentProfile, // Map for frontend convenience
      adminRoles,
    });
  } catch (error: unknown) {
    if ((await cookies()).has(PLATFORM_VIEW_COOKIE)) return reply({ error: "Impersonation is unavailable. Exit impersonation to continue." }, 403);
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) return reply({ error: "Unauthorized" }, 401);
    console.error('Account data unavailable');
    return reply({ error: 'Internal Server Error' }, 500);
  }
}
