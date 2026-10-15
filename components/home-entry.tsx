"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { LandingPageView } from "@/components/views/landing-page-view"
import type { AppShellProps } from "@/components/app-shell"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"
import type { LandingAudience } from "@/lib/landing-audience"

// Marketing HTML is rendered immediately. The authenticated product bundle is
// requested only when a visitor enters an account view or follows a workspace URL.
const AppShell = dynamic(() => import("@/components/app-shell").then(module => module.AppShell), {
  loading: () => <OutClassLoadingScreen />,
})

export function HomeEntry({ initialLandingAudience = "leader", ...props }: AppShellProps & { initialLandingAudience?: LandingAudience }) {
  const params = useSearchParams()
  const [authRole, setAuthRole] = useState<"student" | "leader" | undefined>()
  const landing = !authRole && props.initialView === "landing" &&
    !["workspace", "view", "demoClub", "next", "error"].some(key => params.has(key))
  if (landing) return <LandingPageView initialAudience={initialLandingAudience} launchClubs={props.launchClubs} onNavigateToApp={role => setAuthRole(role ?? "student")} />
  return <AppShell {...props} initialAuthRole={authRole} />
}
