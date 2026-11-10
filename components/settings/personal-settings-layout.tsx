"use client"

import type { ReactNode } from "react"
import { ArrowLeft } from "@/components/icons"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { personalSettingsSections } from "@/lib/settings-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { PageHeader } from "@/components/ui/page-header"
import "@/components/clubs/club-settings.css"

export function PersonalSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // This legacy URL is an operational panel schedule, not a configuration page.
  if (pathname === "/settings/interviews") return children
  const section = personalSettingsSections.find(item => item.href === pathname)
  const value = section?.href ?? "/settings"
  // Personal settings only: club settings are reached from each club workspace. Phones use the
  // overview list (/settings) and drill in; a section shows a link back instead of a dropdown.
  return <div data-settings-hub>
    <PageHeader title={section?.label ?? "Settings"} description={section?.description ?? "Your account, notifications and availability."} />
    <div className="oc-settings-workspace">
      <aside className="oc-settings-menu">
        {section && <Link className="oc-settings-mobile-selector inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4" href="/settings" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}><ArrowLeft size={16} aria-hidden="true" />All settings</Link>}
        <nav className="oc-settings-navigation oc-settings-desktop-navigation" aria-label="Personal settings">
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Personal settings</p>
          {personalSettingsSections.map(item => <Link key={item.id} href={item.href} aria-current={value === item.href ? "page" : undefined} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>{item.label}</Link>)}
        </nav>
      </aside>
      <div className="oc-workspace-stack" data-settings-content>{children}</div>
    </div>
  </div>
}
