import { NextResponse } from 'next/server';
import { requireAuth } from '@/utils/auth';
import { prisma } from '@/utils/prisma';
import { storagePathSchema } from '@/lib/student-profile';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return new NextResponse('Missing path', { status: 400 });
  }

  // 1. USE THE SHARED STORAGE PATH VALIDATOR
  const pathValidation = storagePathSchema.safeParse(path);
  if (!pathValidation.success) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  const studentId = path.split('/')[0];

  try {
    // Unauthenticated -> 401 or project's existing behavior (redirect)
    const { user } = await requireAuth();

    // 2. ONLY SERVE THE CURRENT SAVED RESUME
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { resumeUrl: true, userId: true }
    });

    if (!profile || profile.resumeUrl !== path) {
      // Do not leak whether an unauthorized file exists
      return new NextResponse('Not found', { status: 404 });
    }

    // 3. AUTHORIZATION ORDER
    let isAuthorized = false;

    if (user.id === profile.userId) {
      // Owner
      isAuthorized = true;
    } else {
      // Reviewer
      const hasAccess = await prisma.application.findFirst({
        where: {
          studentId: profile.userId,
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
      // Authenticated but unauthorized -> 403
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 4. SERVER SECRET HANDLING
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      console.error('Missing Supabase server secret for resume generation');
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      secret
    );

    const { data, error } = await adminClient.storage
      .from('resumes')
      .createSignedUrl(path, 60 * 5); // 5 minutes

    if (error || !data?.signedUrl) {
      return new NextResponse('Not found', { status: 404 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error: any) {
    // Rethrow Next.js redirects so we get the project's existing authentication behavior
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Internal API error in /resumes', error);
    // Internal configuration/database failure -> 500
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
