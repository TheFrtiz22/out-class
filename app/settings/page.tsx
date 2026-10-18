import Link from "next/link"
import { personalSettingsSections } from "@/lib/settings-navigation"

export default function SettingsPage() {
  return <section aria-label="Settings overview" className="divide-y rounded-lg border bg-card px-5">
    {personalSettingsSections.map(section => <Link key={section.id} href={section.href} className="group block py-5 focus-visible:outline-2 focus-visible:outline-ring"><h2 className="text-sm font-semibold group-hover:text-primary">{section.label}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p></Link>)}
  </section>
}
