"use client"

import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { CONTACT_HREF } from "@/lib/legal-content"
import { visiblePersonalSettingsSections } from "@/lib/settings-navigation"

/** The /settings list (phones drill in from here). Client-side only to hide Notifications in Demo Mode. */
export function PersonalSettingsOverview() {
  const demo = useDemoMode()
  return <>
    <section aria-label="Settings overview" className="divide-y rounded-lg border oc-glass-surface px-5">
      {visiblePersonalSettingsSections(demo.isDemoEnabled).map(section => <Link key={section.id} href={section.href} className="group block py-5 focus-visible:outline-2 focus-visible:outline-ring"><h2 className="text-sm font-semibold group-hover:text-primary">{section.label}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p></Link>)}
    </section>
    <nav aria-label="Legal and support" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm text-muted-foreground">
      <Link href="/terms" prefetch={false} className="underline-offset-2 hover:underline">Terms of Service</Link>
      <Link href="/privacy" prefetch={false} className="underline-offset-2 hover:underline">Privacy Policy</Link>
      <a href={CONTACT_HREF} className="underline-offset-2 hover:underline">Contact us</a>
    </nav>
    <p className="mt-2 px-1 text-xs text-muted-foreground">OutClass is independent and is not an official service of the University of Virginia.</p>
  </>
}
