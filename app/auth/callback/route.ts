import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isUvaEmail } from '@/lib/auth'

/** Validate `next` param: must be a relative path, no protocol, no double-slash. */
function safeNextPath(raw: string | null): string {
  const value = raw?.trim() ?? '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    return '/'
  }
  return value
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    
    // Exchange the code for a session
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // ── UVA email enforcement ──
      // Reject users whose email is not @virginia.edu.
      // Do NOT delete the Supabase auth user — just end the session.
      if (!user.email || !isUvaEmail(user.email)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/?error=uva_only`)
      }

      // Ensure user exists in the public Prisma database
      const { prisma } = await import('@/utils/prisma')
      await prisma.user.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: {
          id: user.id,
          email: user.email,
          role: "STUDENT",
        }
      })

      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=auth-code-expired`)
}
