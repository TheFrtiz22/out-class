"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import type { ViewId } from "@/lib/views"

/** Use the actual portal, including navigation and controls, without marketing recursion. */
export default function PreviewPage() {
  const [view, setView] = useState<ViewId | null>(null)
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view")
    setView(requested === "student-profile" || requested === "leader-dashboard" || requested === "interview-workspace" ? requested : "student-dashboard")
  }, [])
  if (!view) return <p className="p-6 font-sans text-sm text-neutral-500" role="status">Loading the live portal…</p>
  return <AppShell initialView={view} embedded />
}
