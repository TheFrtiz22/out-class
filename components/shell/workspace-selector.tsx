"use client"

import Link from "next/link"
import { startTransition, useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  return workspaceOptions({ personal: access.personal, admin: access.admin, club: club ? { clubId: club.clubId, name: club.club.name, shortName: club.club.shortName } : null, inSettings, settingsSection: section?.id })
}

/** True when leaving now could open the unsaved-changes prompt (or is blocked by a save in flight). */
function leaveMayPrompt() {
  return !!document.querySelector('[data-unsaved="true"],[data-saving="true"]')
}

/**
 * The pill switches workspace only. Sections live in the rail (desktop) or the bottom bar (phones).
 * A click moves the indicator at once (a pending target) and navigates in a transition, so the
 * spring slide plays while the next workspace loads. The target clears when the URL settles; a
 * cancelled leave (unsaved changes) clears it straight away and the indicator slides back.
 */
export function WorkspaceSelector({ access, current, clubId, onSwitch, clubSwitcher }: { access: WorkspaceAccess; current: WorkspaceKind; clubId: string; onSwitch?: () => void; clubSwitcher?: ReactNode }) {
  const confirmed = useWorkspaceOptions(access, clubId)
  // While eligibility is rechecked, a known admin keeps a non-interactive Admin segment so the pill doesn't change width.
  const options: (WorkspaceOption & { placeholder?: boolean })[] = access.adminPlaceholder && !confirmed.some(option => option.id === "admin") ? [...confirmed, { id: "admin", label: "Admin", href: "/platform", placeholder: true }] : confirmed
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const [target, setTarget] = useState<WorkspaceKind | null>(null)
  const location = `${pathname}?${params.toString()}`
  // Any committed navigation (this switch, a rail link, back/forward) settles the pending target.
  useEffect(() => { setTarget(null) }, [location, current])
  // A navigation that never commits (offline, server error) must not leave the indicator stranded.
  useEffect(() => {
    if (!target) return
    const timer = window.setTimeout(() => setTarget(null), 15000)
    return () => window.clearTimeout(timer)
  }, [target])
  // The pill only appears when there is somewhere to switch to: a student with no club workspace or
  // admin access sees no pill at any width (Personal is the only workspace they have).
  if (options.length < 2) return null
  const shown = target ?? current
  const index = options.findIndex(option => option.id === shown)
  const columns = options.map((_, position) => position === index ? "var(--workspace-selected-track)" : "minmax(0,1fr)").join(" ")
  function go(option: WorkspaceOption) {
    startTransition(() => router.push(option.href))
    onSwitch?.()
  }
  return <div className="oc-workspace-selector oc-evolving-toggle" data-workspace-count={options.length} data-current-workspace={current} data-pending-workspace={target ?? undefined} style={{ "--workspace-count": options.length, "--workspace-index": Math.max(0, index), "--workspace-columns": columns } as CSSProperties}>
    <div className="oc-evolving-bar"><nav aria-label="Workspaces" className="oc-evolving-segments" data-has-active={index >= 0}>
      <span className="oc-evolving-indicator" aria-hidden="true" />
      {options.map(option => {
        // The club segment shows its short label when not selected (and always in the phone mini pill); the
        // accessible name starts with it so it contains every visible label (WCAG 2.5.3), then the full name.
        const abbreviated = option.shortLabel && option.shortLabel !== option.label ? option.shortLabel : null
        const short = shown !== option.id ? abbreviated : null
        if (option.placeholder) return <div key={option.id} className="oc-workspace-segment" data-selected={shown === option.id} data-workspace-kind={option.id} data-workspace-label={option.label} data-placeholder="true" aria-hidden="true">
          <span className="oc-workspace-option" aria-disabled="true"><span className="oc-workspace-option-label">{option.label}</span></span></div>
        return <div key={option.id} className="oc-workspace-segment" data-selected={shown === option.id} data-workspace-kind={option.id} data-workspace-label={option.label}>
        <Link data-workspace-option href={option.href} className="oc-workspace-option" aria-label={abbreviated ? `${abbreviated}, ${workspaceOptionName(option)}` : workspaceOptionName(option)} title={option.id === "leader" ? option.label : undefined} aria-current={current === option.id ? "page" : undefined}
          onMouseEnter={() => { if (current !== option.id) router.prefetch(option.href) }}
          onFocus={() => { if (current !== option.id) router.prefetch(option.href) }}
          onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
          const links = Array.from(event.currentTarget.closest("nav")!.querySelectorAll<HTMLAnchorElement>("a[data-workspace-option]"))
          const position = links.indexOf(event.currentTarget)
          event.preventDefault()
          links[event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (position + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length]?.focus()
        }} onClick={event => {
          // Modified clicks keep the browser's own behaviour (new tab, new window).
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          event.preventDefault()
          if (current === option.id) { setTarget(null); return }
          setTarget(option.id)
          if (!leaveMayPrompt()) { go(option); return }
          // Let the slide start painting before the leave prompt blocks the page; a cancel slides it back.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (canLeaveWorkspace()) go(option)
            else setTarget(null)
          }))
        }}><span className="oc-workspace-option-label" data-mini={abbreviated ?? undefined}>{short ?? option.label}</span></Link>
      </div> })}
    </nav></div>
    {current === "leader" && access.clubs.length > 1 && clubSwitcher && <div className="oc-workspace-club-switch">{clubSwitcher}</div>}
  </div>
}
