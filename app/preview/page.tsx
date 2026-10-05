"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import type { ViewId } from "@/lib/views"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"

/** Use the actual portal, including navigation and controls, without marketing recursion. */
export default function PreviewPage() {
  const [view, setView] = useState<ViewId | null>(null)
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view")
    setView(requested === "student-profile" || requested === "leader-dashboard" || requested === "interview-workspace" ? requested : "student-dashboard")
  }, [])
  if (!view) return <OutClassLoadingScreen />
  return <AppShell initialView={view} embedded />
}
