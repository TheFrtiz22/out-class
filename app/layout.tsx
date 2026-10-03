import { SupportSessionSync } from "@/components/support-session-sync"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { platformViewSession } from "@/utils/platform-view-as"
import { PlatformViewBanner } from "@/components/platform-view-banner"
import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ClubCustomizationProvider } from "@/lib/club-customization"

// One Caslon family, with real variable weights and a real italic face.
const libreCaslonText = localFont({
  src: [
    { path: "./fonts/libre-caslon-text/libre-caslon-text-variable.ttf", weight: "400 700", style: "normal" },
    { path: "./fonts/libre-caslon-text/libre-caslon-text-italic-variable.ttf", weight: "400 700", style: "italic" },
  ],
  variable: "--font-libre-caslon-text",
  display: "swap",
  fallback: ["serif"],
  adjustFontFallback: false,
})

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" }

export const metadata: Metadata = {
  title: "OutClass — One profile. Every selective club.",
  description:
    "OutClass is the recruitment platform for selective college clubs. Students track applications; club leaders review and score applicants.",
  generator: "v0.app",
}

import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { CorkboardProvider } from "@/contexts/corkboard-context"
import { AuthProvider } from "@/contexts/auth-context"
import { OrganizationInvitationsProvider } from "@/contexts/organization-invitations-context"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { prisma } from "@/utils/prisma"
import { readDemoTemplate } from "@/lib/demo/validate"
import { DemoDataProvider } from "@/contexts/demo-context"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const viewSession = cookieStore.has(PLATFORM_VIEW_COOKIE) ? await platformViewSession().catch(() => null) : null
  const supabase = await createClient(cookieStore)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const target = viewSession ? await prisma.user.findUnique({ where: { id: viewSession.targetUserId }, select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } }) : null
  const demoAllowed = !cookieStore.has(PLATFORM_VIEW_COOKIE) && canAccessDemo(authError ? undefined : user?.email)
  const demoEnabled = demoAllowed && cookieStore.get(DEMO_COOKIE)?.value === "1"
  let template
  if (demoEnabled) {
    try {
      const content = await prisma.platformContent.findUnique({ where: { key: "demo.seed" } })
      if (content) template = readDemoTemplate(content.value)
    } catch { /* Demo stays available with its bundled fictional dataset. */ }
  }

  return (
    <html lang="en" className={libreCaslonText.variable}>
      <body className="font-sans antialiased">
        {cookieStore.has(PLATFORM_VIEW_COOKIE) && <PlatformViewBanner label={target ? `${target.studentProfile ? `${target.studentProfile.firstName} ${target.studentProfile.lastName} · ` : ""}${target.email}` : "Expired or unavailable session"} expiresAt={viewSession?.expiresAt.toISOString()} />}
        <SupportSessionSync marker={cookieStore.has(PLATFORM_VIEW_COOKIE)} sessionId={viewSession?.id ?? null} />
        <DemoDataProvider template={template} allowed={demoAllowed} enabled={demoEnabled} clearStaleSession={!demoAllowed && cookieStore.has(DEMO_COOKIE)}>
          <AuthProvider isImpersonating={cookieStore.has(PLATFORM_VIEW_COOKIE)}>
            <OrganizationInvitationsProvider>
            <CorkboardProvider><ClubCustomizationProvider>
              <div style={cookieStore.has(PLATFORM_VIEW_COOKIE) ? { paddingTop: "var(--support-banner-height, 120px)" } : undefined}>{children}</div>
            </ClubCustomizationProvider></CorkboardProvider>
            </OrganizationInvitationsProvider>
          </AuthProvider>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </DemoDataProvider>
      </body>
    </html>
  )
}
