import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAuth } from '@/utils/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/prisma';
import { z } from 'zod';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  // Basic validation that path exists and looks like a uuid prefix
  if (!path) {
    return new NextResponse('Missing path', { status: 400 });
  }
  
  // Extract student ID (UUID is 36 chars)
  const pathParts = path.split('/');
  const studentId = pathParts[0];

  // Validate studentId is a valid UUID to prevent path traversal like ../
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(studentId).success || pathParts.length < 2) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  try {
    const { user } = await requireAuth();

    // Authorization: A student may access their OWN resume
    let isAuthorized = (user.id === studentId);

    // If not their own, check if they are an authorized club member reviewing an application
    if (!isAuthorized) {
      // Find an application submitted by this student to a club where the requester is a member
      const hasAccess = await prisma.application.findFirst({
        where: {
          studentId: studentId,
          status: { not: "DRAFTING" },
          club: {
            members: {
              some: {
                userId: user.id
              }
            }
          }
        }
      });
      if (hasAccess) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Return 403 Forbidden
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Need to bypass RLS to generate a signed URL for a file we don't own in Supabase Storage,
    // since we already explicitly authorized it via Prisma.
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data, error } = await adminClient.storage
      .from('resumes')
      .createSignedUrl(path, 60 * 5); // 5 minutes

    if (error || !data?.signedUrl) {
      return new NextResponse('Could not generate signed URL', { status: 404 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    // requireAuth redirects, but if it throws or we catch something else
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
