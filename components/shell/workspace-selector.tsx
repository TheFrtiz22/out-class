"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { FloatingModeNavigation } from "@/components/shell/floating-header-controls"
import { canLeaveWorkspace, type ProductNavItem } from "@/lib/product-navigation"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { availableSettings } from "@/lib/club-settings"
import type { WorkspaceAccess } from "./use-workspace-access"

export type WorkspaceKind = "personal" | "leader" | "admin"
export function WorkspaceSelector({ access, current, clubId, onSwitch }: { access: WorkspaceAccess; current: WorkspaceKind; clubId: string; onSwitch?: () => void }) {
  const pathname = usePathname(), params = useSearchParams()
  const club = access.clubs.find(member => member.clubId === (clubId || access.activeClubId)) ?? access.clubs[0]
  const inSettings = params.get("section") === "settings" || pathname.startsWith("/settings") && pathname !== "/settings/interviews"
  const settings = club && inSettings ? availableSettings(club) : []
  const section = settings.find(section => section.id === params.get("setting")) ?? settings[0]
  const options: ProductNavItem[] = [
    ...(access.personal ? [{ id: "personal", label: "Personal", href: inSettings ? "/settings" : "/?workspace=student" }] : []),
    ...(club ? [{ id: "leader", label: "Club Leader", href: section ? `/club/${encodeURIComponent(club.clubId)}/workspace?section=settings&setting=${section.id}` : clubWorkspaceHref(club.clubId) }] : []),
    ...(access.admin ? [{ id: "admin", label: "Admin", href: "/platform" }] : []),
  ]
  if (!options.length) return null
  if (options.length === 1 && options[0].id === current) return <div className="oc-current-workspace" aria-label={`Current workspace: ${options[0].label}`}><span aria-hidden="true" />{options[0].label}</div>
  return <div className="oc-workspace-selector" data-workspace-count={options.length}>
    <FloatingModeNavigation modes={options} mode={current} aria-label="Workspaces">
      {options.map(option => <Link key={option.id} href={option.href!} prefetch={false} className="oc-floating-mode-link" aria-current={current === option.id ? "page" : undefined} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
        const links = Array.from(event.currentTarget.closest("nav")!.querySelectorAll<HTMLAnchorElement>("a[href]"))
        const index = links.indexOf(event.currentTarget)
        event.preventDefault()
        links[event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length]?.focus()
      }} onClick={event => {
        if (current === option.id || !canLeaveWorkspace()) event.preventDefault()
        else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) onSwitch?.()
      }}>{option.label}</Link>)}
    </FloatingModeNavigation>
  </div>
}
