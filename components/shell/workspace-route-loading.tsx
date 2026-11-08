"use client"

import { useSearchParams } from "next/navigation"
import { DashboardLoading } from "@/components/product/dashboard-presentation"
import { WorkspaceLoading } from "@/components/workspace-loading"

/** Club workspace route placeholder, shaped like the section being opened, under the persistent shell. */
export function WorkspaceRouteLoading() {
  const params = useSearchParams()
  const section = params.get("section") ?? "overview", tool = params.get("tool")
  if (section === "overview") return <DashboardLoading mode="club" />
  if (section === "recruitment" && tool === "overview") return <DashboardLoading mode="recruiting" />
  return <WorkspaceLoading label="Opening club workspace…" layout={section === "recruitment" ? "applicants" : section === "members" ? "table" : section === "settings" ? "form" : "rows"} rows={3} />
}
