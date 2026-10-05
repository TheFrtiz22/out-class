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
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, privateRobots } from "@/lib/seo"

// One Caslon family, with real variable weights and a real italic face.
const libreCaslonText = localFont({
  src: [
    { path: "./fonts/libre-caslon-text/libre-caslon-text-variable.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/libre-caslon-text/libre-caslon-text-italic-variable.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-libre-caslon-text",
  display: "swap",
  fallback: ["serif"],
  adjustFontFallback: false,
})

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" }

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s | OutClass" },
  description: SITE_DESCRIPTION,
  applicationName: "OutClass",
  // Public pages opt in explicitly; new product routes stay out of search by default.
  robots: privateRobots,
  manifest: "/manifest.webmanifest",
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
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
          <AuthProvider isImpersonating={cookieStore.has(PLATFORM_VIEW_COOKIE)} hasSession={(!authError && !!user) || cookieStore.has(PLATFORM_VIEW_COOKIE)}>
            <OrganizationInvitationsProvider>
            <CorkboardProvider><ClubCustomizationProvider>
              <div style={cookieStore.has(PLATFORM_VIEW_COOKIE) ? { paddingTop: "var(--support-banner-height, 120px)" } : undefined}>{children}</div>
            </ClubCustomizationProvider></CorkboardProvider>
            </OrganizationInvitationsProvider>
          </AuthProvider>
          <Toaster />
          {process.env.VERCEL && <><Analytics /><SpeedInsights /></>}
        </DemoDataProvider>
      </body>
    </html>
  )
}
