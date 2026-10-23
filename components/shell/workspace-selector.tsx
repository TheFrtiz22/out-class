"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { canLeaveWorkspace, type ProductNavItem } from "@/lib/product-navigation"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { availableSettings } from "@/lib/club-settings"
import type { WorkspaceAccess } from "./use-workspace-access"

export type WorkspaceKind = "personal" | "leader" | "admin"
export function WorkspaceSelector({ access, current, clubId, onSwitch, children, clubSwitcher }: { access: WorkspaceAccess; current: WorkspaceKind; clubId: string; onSwitch?: () => void; children?: ReactNode; clubSwitcher?: ReactNode }) {
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
  if (!options.length) return children ? <div className="oc-evolving-toggle oc-evolving-guest">{children}</div> : null
  const divided = current !== "admin" && !!children
  const index = options.findIndex(option => option.id === current)
  const columns = options.map((_, position) => position === index ? "var(--workspace-selected-track)" : "minmax(0,1fr)").join(" ")
  return <div className="oc-workspace-selector oc-evolving-toggle" data-workspace-count={options.length} data-current-workspace={current} data-subdivided={divided} style={{ "--workspace-count": options.length, "--workspace-index": Math.max(0, index), "--workspace-columns": columns } as CSSProperties}>
    <div className="oc-workspace-captions">{options.map(option => <span key={option.id} role={option.id === current ? "group" : undefined} aria-label={option.id === current ? `Current workspace: ${option.label}` : undefined}>{option.id === current && divided ? option.label : null}</span>)}</div>
    <div className="oc-evolving-bar"><nav aria-label="Workspaces" className="oc-evolving-segments" data-has-active={index >= 0}>
      <span className="oc-evolving-indicator" aria-hidden="true" />
      {options.map(option => <div key={option.id} className="oc-workspace-segment" data-selected={current === option.id} data-workspace-kind={option.id} data-workspace-label={option.label}>
        {current === option.id && divided ? <div className="oc-workspace-segment-content" role="group" aria-label={`${option.label} workspace`}>{children}</div> : <Link data-workspace-option href={option.href!} prefetch={false} className="oc-workspace-option" aria-current={current === option.id ? "page" : undefined} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
          const links = Array.from(event.currentTarget.closest("nav")!.querySelectorAll<HTMLAnchorElement>("a[data-workspace-option]"))
          const position = links.indexOf(event.currentTarget)
          event.preventDefault()
          links[event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (position + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length]?.focus()
        }} onClick={event => {
          if (current === option.id || !canLeaveWorkspace()) event.preventDefault()
          else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) onSwitch?.()
        }}><span>{option.label}</span>{current !== option.id && option.id !== "admin" && <span className="oc-workspace-hint" aria-hidden="true">{option.id === "personal" ? <>Explore/Apply/<wbr />My Clubs</> : <>Recruiting/<wbr />Club</>}</span>}</Link>}
      </div>)}
    </nav></div>
    {current === "leader" && access.clubs.length > 1 && clubSwitcher && <div className="oc-workspace-club-switch">{clubSwitcher}</div>}
  </div>
}
