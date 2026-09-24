import { hasWorkspace } from "@/lib/permissions";
import { isUvaEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !user.email || !isUvaEmail(user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      
      include: {
        studentProfile: true,
        applications: {
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
      profile: userData.studentProfile, // Map for frontend convenience
      adminRoles,
    });
  } catch (error: unknown) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

