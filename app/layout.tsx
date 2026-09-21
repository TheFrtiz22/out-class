import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ClubCustomizationProvider } from "@/lib/club-customization"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "OutClass — One profile. Every selective club.",
  description:
    "OutClass is the recruitment platform for selective college clubs. Students track applications; club leaders review and score applicants.",
  generator: "v0.app",
}

import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { AuthProvider } from "@/contexts/auth-context"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <ClubCustomizationProvider>
            {children}
          </ClubCustomizationProvider>
        </AuthProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}

