"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useClubCustomization, type PublicProfile } from "@/lib/club-customization"
import { publicClubs } from "@/lib/public-clubs"
import { ClubProfileView } from "@/components/views/club-profile-view"

const sections = [
  { key: "showAcceptance", label: "Show Acceptance Rate" },
  { key: "showAum", label: "Show AUM (Money Managed)" },
  { key: "showPlacements", label: "Show Notable Alumni/Placements" },
  { key: "showDirectory", label: "Show Member Directory" },
] as const

export function ProfileBuilder({ clubId = "vvf" }: { clubId?: string }) {
  const { state, update, ready, storageError } = useClubCustomization(clubId)
  const profile = state.profile
  const [hex, setHex] = useState(profile.accent)
  useEffect(() => setHex(profile.accent), [profile.accent])
  const validHex = /^#[0-9a-f]{6}$/i.test(hex)
  const club = publicClubs.find(club => club.id === clubId)
  function set<K extends keyof PublicProfile>(key: K, value: PublicProfile[K]) {
    update(previous => ({ ...previous, profile: { ...previous.profile, [key]: value } }))
  }
  return <div className="space-y-5 font-sans">
    <div><h2 className="text-lg font-semibold">Profile &amp; Branding</h2><p className="mt-1 text-sm text-neutral-500">Choose what students see. Changes save automatically in this browser.</p></div>
    {storageError && <p role="status" className="text-sm text-amber-800">Browser storage is unavailable or was invalid. Changes remain available during this visit.</p>}
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <fieldset disabled={!ready} className="min-w-0 space-y-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">Club name<Input value={profile.name} maxLength={100} onChange={event => set("name", event.target.value)} className="shadow-none" /></label>
          <label className="block space-y-2 text-sm font-medium">Tagline<Input value={profile.tagline} maxLength={180} onChange={event => set("tagline", event.target.value)} className="shadow-none" /></label>
          <label className="block space-y-2 text-sm font-medium">About your club<Textarea value={profile.about} rows={5} onChange={event => set("about", event.target.value)} className="shadow-none" /></label>
          <label className="block space-y-2 text-sm font-medium">Brand accent<Input value={hex} maxLength={7} spellCheck={false} aria-invalid={!validHex} aria-describedby="accent-help" onChange={event => { const value = event.target.value; setHex(value); if (/^#[0-9a-f]{6}$/i.test(value)) set("accent", value) }} className="shadow-none" /></label>
          <p id="accent-help" className={`text-xs ${validHex ? "text-neutral-500" : "text-red-700"}`}>{validHex ? "A subtle accent for your logo fallback and application button." : "Use a six-digit hex color, such as #245A72. The last valid color stays in the preview."}</p>
        </div>
        <div className="space-y-1 border-t border-neutral-200 pt-4"><h3 className="mb-2 text-sm font-semibold">Public sections</h3>
          {sections.map(section => <div key={section.key} className="flex items-center justify-between gap-4 rounded-lg p-2 hover:bg-neutral-50"><label htmlFor={section.key} className="text-sm">{section.label}</label><Switch id={section.key} checked={profile[section.key]} onCheckedChange={value => set(section.key, value)} className="shadow-none [&_[data-slot=switch-thumb]]:shadow-none" /></div>)}
        </div>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">Acceptance rate<Input value={profile.acceptance} placeholder="8%" onChange={event => set("acceptance", event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Money managed<Input value={profile.aum} placeholder="$100,000" onChange={event => set("aum", event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Notable alumni / placements<Textarea value={profile.placements} placeholder="Add placements or alumni highlights" onChange={event => set("placements", event.target.value)} /></label>
        </div>
      </fieldset>
      <section aria-label="Live student profile preview" className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white xl:sticky xl:top-6">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3"><h3 className="text-sm font-semibold">Live student preview</h3><p className="mt-1 text-xs text-neutral-500">The student profile at 75% scale. Explore its tabs below.</p></div>
        <div className="max-h-[850px] overflow-auto p-4">
          {club ? <div style={{ zoom: 0.75 }}><ClubProfileView club={club} preview onBack={() => {}} onNavigate={() => {}} /></div> : <p className="text-sm text-neutral-500">No public profile exists for this club yet.</p>}
        </div>
      </section>
    </div>
  </div>
}
