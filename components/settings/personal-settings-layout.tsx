"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { availableSettings } from "@/lib/club-settings"
import { personalSettingsSections } from "@/lib/settings-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { PageHeader } from "@/components/product/page-header"
import "@/components/clubs/club-settings.css"

export function PersonalSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname(), router = useRouter(), { user } = useAuth()
  // This legacy URL is an operational panel schedule, not a configuration page.
  if (pathname === "/settings/interviews") return children
  const section = personalSettingsSections.find(item => item.href === pathname)
  const managed = user?.memberships.filter(member => !member.club.suspendedAt && availableSettings(member).length > 0) ?? []
  const value = section?.href ?? "/settings"
  return <div data-settings-hub>
    <PageHeader title={section?.label ?? "Settings"} description={section?.description ?? "Manage your personal preferences and organization configuration."} />
    <div className="oc-settings-workspace">
      <aside className="oc-settings-menu">
        <label className="oc-settings-mobile-selector text-sm" htmlFor="personal-settings-section">Settings section
          <select id="personal-settings-section" aria-label="Settings section" className="oc-settings-select" value={value} onChange={event => { if (canLeaveWorkspace()) router.push(event.target.value) }}>
            <option value="/settings">Settings overview</option>
            <optgroup label="Personal settings">{personalSettingsSections.map(item => <option key={item.id} value={item.href}>{item.label}</option>)}</optgroup>
            {managed.length > 0 && <optgroup label="Organization settings">{managed.map(member => <option key={member.clubId} value={`/club/${encodeURIComponent(member.clubId)}/workspace?section=settings`}>{member.club.name}</option>)}</optgroup>}
          </select>
        </label>
        <nav className="oc-settings-navigation oc-settings-desktop-navigation" aria-label="Personal settings">
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Personal settings</p>
          {personalSettingsSections.map(item => <Link key={item.id} href={item.href} aria-current={value === item.href ? "page" : undefined} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>{item.label}</Link>)}
          {managed.length > 0 && <div className="mt-5 border-t pt-4"><p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Organization settings</p>{managed.map(member => <Link key={member.clubId} href={`/club/${encodeURIComponent(member.clubId)}/workspace?section=settings`} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}><span className="truncate">{member.club.name}</span></Link>)}</div>}
        </nav>
      </aside>
      <div className="min-w-0 max-w-5xl" data-settings-content>{children}</div>
    </div>
  </div>
}
