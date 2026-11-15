"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import { AlumniDetailsFields, alumniDetailsDraft, alumniDetailsInput, type AlumniDetailsDraft } from "@/components/alumni-details-fields"
import { saveAlumniDetails } from "@/actions/graduation"
import { useAuth } from "@/contexts/auth-context"
import { unwrapAction } from "@/lib/action-result"
import { isAlumniProfile } from "@/lib/graduation"
import { userMessage } from "@/lib/user-message"

type Profile = Parameters<typeof alumniDetailsDraft>[0] & { graduatedAt?: Date | string | null; graduationConfirmedAt?: Date | string | null }

/** Profile → After graduation: edit employer, role and the alumni choices once graduation is confirmed or the student is alumni. */
export function AlumniDetailsPanel({ profile }: { profile: Profile }) {
  const { user, refreshUser } = useAuth()
  const [saved, setSaved] = useState(() => alumniDetailsDraft(profile))
  const [draft, setDraft] = useState<AlumniDetailsDraft | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("")
  if (!profile?.graduationConfirmedAt && !isAlumniProfile(profile)) return null
  const readOnly = !!user?.impersonating
  async function save(next: AlumniDetailsDraft) {
    setBusy(true); setError(""); setStatus("")
    try { unwrapAction(await saveAlumniDetails(alumniDetailsInput(next))); setSaved(next); setDraft(null); setStatus("Saved."); await refreshUser() }
    catch (e) { setError(userMessage(e, "We couldn’t save that. Try again.")) }
    finally { setBusy(false) }
  }
  const work = [saved.role.trim(), saved.employer.trim()].filter(Boolean).join(" at ")
  return <Panel as="section" aria-label="After graduation" data-saving={busy}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="oc-card-heading">After graduation</h3>
      {!draft && !readOnly && <Button size="sm" variant="outline" onClick={() => setDraft(saved)}>Edit</Button>}
    </div>
    {draft ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(draft) }}>
      <AlumniDetailsFields value={draft} onChange={setDraft} disabled={busy} focusOnMount />
      <div className="flex flex-wrap gap-2"><Button size="sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button><Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button></div>
    </form> : <dl className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2"><dt className="text-muted-foreground">Working at</dt><dd>{work || "Not added"}</dd></div>
      <div className="flex flex-wrap gap-2"><dt className="text-muted-foreground">Clubs’ alumni list</dt><dd>{saved.showInAlumniList ? "Shown to current members" : "Hidden"}</dd></div>
      <div className="flex flex-wrap gap-2"><dt className="text-muted-foreground">“Where members go”</dt><dd>{saved.shareEmployer ? "Company name added" : "Not added"}</dd></div>
    </dl>}
    <p role="status" className="sr-only">{status}</p>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </Panel>
}
