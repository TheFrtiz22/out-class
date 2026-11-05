"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { availableSettings } from "@/lib/club-settings"
import { workspaceOptionName, workspaceOptions, type WorkspaceKind, type WorkspaceOption } from "@/lib/navigation"
import type { WorkspaceAccess } from "./use-workspace-access"

export type { WorkspaceKind }

/** Options for the current account and page; shared by the pill and the phone account menu. */
export function useWorkspaceOptions(access: WorkspaceAccess, clubId: string): WorkspaceOption[] {
  const pathname = usePathname(), params = useSearchParams()
  const club = access.clubs.find(member => member.clubId === (clubId || access.activeClubId)) ?? access.clubs[0]
  const inSettings = params.get("section") === "settings" || pathname.startsWith("/settings") && pathname !== "/settings/interviews"
  const settings = club && inSettings ? availableSettings(club) : []
  const section = settings.find(section => section.id === params.get("setting")) ?? settings[0]
  return workspaceOptions({ personal: access.personal, admin: access.admin, club: club ? { clubId: club.clubId, name: club.club.name } : null, inSettings, settingsSection: section?.id })
}

/** The pill switches workspace only. Sections live in the rail (desktop) or the bottom bar (phones). */
export function WorkspaceSelector({ access, current, clubId, onSwitch, clubSwitcher }: { access: WorkspaceAccess; current: WorkspaceKind; clubId: string; onSwitch?: () => void; clubSwitcher?: ReactNode }) {
  const options = useWorkspaceOptions(access, clubId)
  // A student without other workspaces still sees "Personal": the pill reads the same everywhere.
  if (!options.length) return null
  const index = options.findIndex(option => option.id === current)
  const columns = options.map((_, position) => position === index ? "var(--workspace-selected-track)" : "minmax(0,1fr)").join(" ")
  return <div className="oc-workspace-selector oc-evolving-toggle" data-workspace-count={options.length} data-current-workspace={current} style={{ "--workspace-count": options.length, "--workspace-index": Math.max(0, index), "--workspace-columns": columns } as CSSProperties}>
    <div className="oc-evolving-bar"><nav aria-label="Workspaces" className="oc-evolving-segments" data-has-active={index >= 0}>
      <span className="oc-evolving-indicator" aria-hidden="true" />
      {options.map(option => <div key={option.id} className="oc-workspace-segment" data-selected={current === option.id} data-workspace-kind={option.id} data-workspace-label={option.label}>
        <Link data-workspace-option href={option.href} prefetch={false} className="oc-workspace-option" aria-label={workspaceOptionName(option)} title={option.id === "leader" ? option.label : undefined} aria-current={current === option.id ? "page" : undefined} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
          const links = Array.from(event.currentTarget.closest("nav")!.querySelectorAll<HTMLAnchorElement>("a[data-workspace-option]"))
          const position = links.indexOf(event.currentTarget)
          event.preventDefault()
          links[event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (position + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length]?.focus()
        }} onClick={event => {
          if (current === option.id || !canLeaveWorkspace()) event.preventDefault()
          else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) onSwitch?.()
        }}><span className="oc-workspace-option-label">{option.label}</span></Link>
      </div>)}
    </nav></div>
    {current === "leader" && access.clubs.length > 1 && clubSwitcher && <div className="oc-workspace-club-switch">{clubSwitcher}</div>}
  </div>
}
