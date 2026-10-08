"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { LandingPageView } from "@/components/views/landing-page-view"
import type { AppShellProps } from "@/components/app-shell"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"

// Marketing HTML is rendered immediately. The authenticated product bundle is
// requested only when a visitor enters an account view or follows a workspace URL.
const AppShell = dynamic(() => import("@/components/app-shell").then(module => module.AppShell), {
  loading: () => <OutClassLoadingScreen />,
})

export function HomeEntry(props: AppShellProps) {
  const params = useSearchParams()
  const [authRole, setAuthRole] = useState<"student" | "leader" | undefined>()
  const landing = !authRole && props.initialView === "landing" &&
    !["workspace", "view", "demoClub", "next", "error"].some(key => params.has(key))
  if (landing) return <LandingPageView launchClubs={props.launchClubs} initialSignup={params.get("signup") === "student"} onNavigateToApp={role => setAuthRole(role ?? "student")} />
  return <AppShell {...props} initialAuthRole={authRole} />
}
