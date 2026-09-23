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
import { DemoDataProvider } from "@/contexts/demo-context"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  const demoAllowed = canAccessDemo(user?.email)
  const demoEnabled = demoAllowed && cookieStore.get(DEMO_COOKIE)?.value === "1"

  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <DemoDataProvider allowed={demoAllowed} enabled={demoEnabled} clearStaleSession={!demoAllowed && cookieStore.has(DEMO_COOKIE)}>
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

