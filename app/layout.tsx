import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ClubCustomizationProvider } from "@/lib/club-customization"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" }

export const metadata: Metadata = {
  title: "OutClass — One profile. Every selective club.",
  description:
    "OutClass is the recruitment platform for selective college clubs. Students track applications; club leaders review and score applicants.",
  generator: "v0.app",
}

import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { AuthProvider } from "@/contexts/auth-context"
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
  const supabase = await createClient(cookieStore)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const demoAllowed = canAccessDemo(authError ? undefined : user?.email)
  const demoEnabled = demoAllowed && cookieStore.get(DEMO_COOKIE)?.value === "1"
  let template
  if (demoEnabled) {
    try {
      const content = await prisma.platformContent.findUnique({ where: { key: "demo.seed" } })
      if (content) template = readDemoTemplate(content.value)
    } catch { /* Demo stays available with its bundled fictional dataset. */ }
  }

  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <DemoDataProvider template={template} allowed={demoAllowed} enabled={demoEnabled} clearStaleSession={!demoAllowed && cookieStore.has(DEMO_COOKIE)}>
          <AuthProvider>
            <ClubCustomizationProvider>
              {children}
            </ClubCustomizationProvider>
          </AuthProvider>
          <Toaster />
          <Analytics />
        </DemoDataProvider>
      </body>
    </html>
  )
}

