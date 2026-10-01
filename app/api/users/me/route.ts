import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { requireAuth } from "@/utils/auth";
import { hasWorkspace } from "@/lib/permissions";
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value === "1") return NextResponse.json({ error: "Live account access is unavailable in this mode." }, { status: 403 });
    const { user, impersonation } = await requireAuth();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      
      include: {
        studentProfile: true,
        applications: {
          omit: { anonymousReviewText: true },
          include: {
            club: true,
          }
        },
        memberships: {
          include: {
            club: true,
          }
        }
      }
    });

    if (userData?.disabledAt) return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
    if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Filter memberships to determine where the user holds leadership permissions
    const adminRoles = userData.memberships.filter(
      hasWorkspace
    );

    return NextResponse.json({
      ...userData,
      impersonating: !!impersonation,
      profile: userData.studentProfile, // Map for frontend convenience
      adminRoles,
    });
  } catch (error: unknown) {
    if ((await cookies()).has(PLATFORM_VIEW_COOKIE)) return NextResponse.json({ error: "Impersonation is unavailable. Exit impersonation to continue." }, { status: 403 });
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

