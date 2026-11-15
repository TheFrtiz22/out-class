"use client"

import type { ReactNode } from "react"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { personalSettingsSectionFor, visiblePersonalSettingsSections } from "@/lib/settings-navigation"
import { useDemoMode } from "@/contexts/demo-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { PageHeader } from "@/components/ui/page-header"
import "@/components/clubs/club-settings.css"

export function PersonalSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname(), demo = useDemoMode()
  // This legacy URL is an operational panel schedule, not a configuration page.
  if (pathname === "/settings/interviews") return children
  const section = personalSettingsSectionFor(pathname)
  const value = section?.href ?? "/settings"
  // Personal settings only: club settings are reached from each club workspace. Phones use the
  // overview list (/settings) and drill in; a section shows breadcrumbs back to it.
  const guard = (event: { preventDefault(): void }) => { if (!canLeaveWorkspace()) event.preventDefault() }
  return <div data-settings-hub>
    {section && <Breadcrumbs className="mb-2" items={[{ label: "Settings", href: "/settings" }, { label: section.label }]} onLinkClick={guard} />}
    <PageHeader title={section?.label ?? "Settings"} description={section?.description ?? "Your account, notifications and availability."} />
    <div className="oc-settings-workspace">
      <aside className="oc-settings-menu oc-personal-settings-menu">
        <nav className="oc-settings-navigation oc-settings-desktop-navigation" aria-label="Personal settings">
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Personal settings</p>
          {visiblePersonalSettingsSections(demo.isDemoEnabled).map(item => <Link key={item.id} href={item.href} aria-current={value === item.href ? "page" : undefined} onClick={guard}>{item.label}</Link>)}
        </nav>
      </aside>
      <div className="oc-workspace-stack" data-settings-content>{children}</div>
    </div>
  </div>
}
