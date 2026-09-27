"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { demoStore } from "@/lib/demo/store"
import { hasPermission } from "@/lib/permissions"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { updateClubSettings } from "@/actions/club-workspace"
import { ClubManagerView } from "@/components/views/club-manager-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function ClubProfileSettings({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const club = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId) : member?.club
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false)
  useEffect(() => { if (!dirty && !busy) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload",warn); return () => window.removeEventListener("beforeunload",warn) }, [dirty,busy])
  if (!club || !hasPermission(member, "club.settings")) return <p role="alert">Club settings are not available with your current access.</p>
  const root = `/club/${encodeURIComponent(clubId)}/workspace`
  const links = [
    ...(hasPermission(member,"members.manage") || hasPermission(member,"leaders.manage") ? [{title:"Members & management access",detail:"Membership, invitations, and granular club capabilities.",href:`${root}?section=members`,group:"Access"}] : []),
    ...(hasPermission(member,"recruitment.manage") ? [{title:"Review privacy & test requirements",detail:"Round-level anonymous review and required tests for future applications.",href:`${root}?section=recruitment&tool=rounds`,group:"Recruiting"}] : []),
    ...(hasPermission(member,"interviews.manage") ? [{title:"Interview kits & settings",detail:"Manage round questions and guidance in the recruiting workspace.",href:`${root}?section=recruitment&tool=interviews`,group:"Recruiting"}] : []),
  ]
  return <div className="max-w-3xl space-y-10" data-unsaved={dirty} data-saving={busy}>
    <section aria-labelledby="public-profile-settings" className="space-y-6">
      <div><h2 id="public-profile-settings" className="font-display text-2xl">Public club profile</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">The name, tagline, and description shown on your club profile.</p>{demo.isDemoEnabled && <p className="mt-3 text-sm text-muted-foreground">Demo Mode · description changes stay in this browser. The demo club name and tagline are fixed.</p>}</div>
      <form className="space-y-6" onChange={() => { setDirty(true); setMessage("") }} onSubmit={async event => {
        event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setMessage(""); setFailed(false)
        try {
          if (demo.isDemoEnabled) demoStore.mutate(state => { if(clubId !== state.clubs[0].id) throw new Error("Demo management is limited to MII."); state.clubs[0].description = String(values.get("description")) })
          else await updateClubSettings({clubId,name:String(values.get("name")),tagline:String(values.get("tagline")),description:String(values.get("description"))})
          setDirty(false); onSaved?.()
          try { await refreshUser(); setMessage(demo.isDemoEnabled ? "Demo description saved on this device." : "Public club profile saved.") }
          catch { setMessage("Profile saved. Reload the workspace to refresh its header.") }
        } catch(error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Could not save. Your edits are still here; try again.") }
        finally { setBusy(false) }
      }}>
        <fieldset disabled={busy} className="space-y-6">
          <label className="block space-y-2 text-sm font-medium">Club name<Input name="name" required maxLength={150} defaultValue={club.name} disabled={demo.isDemoEnabled} /></label>
          <label className="block space-y-2 text-sm font-medium">Tagline<Input name="tagline" maxLength={300} defaultValue={member?.club.tagline || ""} disabled={demo.isDemoEnabled} /><span className="block text-xs font-normal text-muted-foreground">A short introduction to what your club does.</span></label>
          <label className="block space-y-2 text-sm font-medium">Description<Textarea name="description" rows={7} className="min-h-48" maxLength={10000} defaultValue={club.description} /><span className="block text-xs font-normal text-muted-foreground">Describe your club’s purpose and what members can expect.</span></label>
          <Button type="submit">{busy ? "Saving…" : demo.isDemoEnabled ? "Save demo description" : "Save public profile"}</Button>
        </fieldset>
        {message && <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
      </form>
    </section>
    {links.length > 0 && <section aria-labelledby="related-club-settings" className="border-t pt-7"><h2 id="related-club-settings" className="font-display text-2xl">Other club settings</h2><ul className="mt-4 divide-y">{links.map(link => <li key={link.href}><Link href={link.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }} className="block rounded py-5 focus-visible:outline-2 focus-visible:outline-ring"><p className="text-xs text-muted-foreground">{link.group}</p><h3 className="mt-1 text-sm font-medium">{link.title} →</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{link.detail}</p></Link></li>)}</ul></section>}
    {!demo.isDemoEnabled && <details className="border-t pt-5"><summary className="min-h-11 cursor-pointer text-sm text-muted-foreground">Local preview branding & builder tools</summary><p role="note" className="my-4 border-l-2 border-brand-orange pl-4 text-sm leading-7 text-muted-foreground">Preview only · these existing tools use browser-local state. They do not update the public profile above, publish branding, send invitations, or change permissions.</p><ClubManagerView /></details>}
  </div>
}
