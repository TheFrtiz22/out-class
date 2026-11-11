import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isUvaEmail, loginReturnPath, authFailurePath } from '@/lib/auth'
import { MICROSOFT_AUTH_ENABLED } from '@/lib/auth-features'
import { passwordAlreadySecured, secureVerifiedAccount } from '@/lib/email-confirmation'

export async function GET(request: Request) {
  if ((await cookies()).has(PLATFORM_VIEW_COOKIE)) return NextResponse.json({ error: "Exit impersonation before changing authentication." }, { status: 403 })
  const { searchParams, origin } = new URL(request.url)
  if (!MICROSOFT_AUTH_ENABLED && searchParams.get('provider') === 'azure') {
    return NextResponse.json({ error: "This sign-in method is unavailable. Use email sign-in." }, { status: 403, headers: { "Cache-Control": "private, no-store" } })
  }
  const code = searchParams.get('code')
  const next = loginReturnPath(searchParams.get('next'))

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
        return NextResponse.redirect(`${origin}${authFailurePath(next, "uva_only")}`)
      }

      // A provider sign-in proves the address. For an email-and-password account whose password is not yet
      // recorded as set by a verified session, set an unusable password, sign out other sessions and record
      // it, as the email-code flow does; the user can choose a password through password reset.
      if (user.identities?.some(identity => identity.provider === 'email') && !passwordAlreadySecured(user)) {
        const { serviceAuthClient } = await import('@/utils/admin-elevation')
        const admin = serviceAuthClient()
        const result = admin ? await secureVerifiedAccount(supabase, admin, user, undefined) : null
        if (!result?.secured || !result.recorded) {
          console.error(admin ? "Provider sign-in verified; password or session update incomplete" : "Provider sign-in needs the Supabase secret key")
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}${authFailurePath(next, "email-code-required")}`)
        }
      }

      // Ensure user exists in the public Prisma database
      const { prisma } = await import('@/utils/prisma')
      const lowerEmail = user.email.toLowerCase()
      await prisma.user.upsert({
        where: { id: user.id },
        update: { email: lowerEmail },
        create: {
          id: user.id,
          email: lowerEmail,
          role: "STUDENT",
        }
      })

      // The request origin is the redirect authority; never trust a caller-supplied forwarded host.
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}${authFailurePath(next, "auth-code-expired")}`)
}
