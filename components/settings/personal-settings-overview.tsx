"use client"

import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { visiblePersonalSettingsSections } from "@/lib/settings-navigation"

/** The /settings list (phones drill in from here). Client-side only to hide Notifications in Demo Mode. */
export function PersonalSettingsOverview() {
  const demo = useDemoMode()
  return <section aria-label="Settings overview" className="divide-y rounded-lg border oc-glass-surface px-5">
    {visiblePersonalSettingsSections(demo.isDemoEnabled).map(section => <Link key={section.id} href={section.href} className="group block py-5 focus-visible:outline-2 focus-visible:outline-ring"><h2 className="text-sm font-semibold group-hover:text-primary">{section.label}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p></Link>)}
  </section>
}
