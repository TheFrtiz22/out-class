import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Filter memberships to determine where the user holds leadership permissions
  const adminRoles = userData.memberships.filter(
    (m) => m.role === 'PRESIDENT' || m.role === 'RECRUITMENT_LEAD'
  );

  return NextResponse.json({
    ...userData,
    profile: userData.studentProfile, // Map for frontend convenience
    adminRoles,
  });
}

