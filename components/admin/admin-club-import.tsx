"use client"
import { UserFacingError } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { useState } from "react"
import { getAdminClub, getAdminClubs, saveAdminClub } from "@/actions/admin-clubs"
import { uploadClubAsset } from "@/actions/club-assets"
import { clubProfileImportSchema, importImageNames, runClubProfileImport, type ClubProfileImport } from "@/lib/club-profile-import"
import { AboutSection, MarketingProfile, MarketingSections } from "@/components/clubs/marketing-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

type Current = NonNullable<Awaited<ReturnType<typeof getAdminClub>>['value']>
type Planned = { row: ClubProfileImport['profiles'][number]; current: Current | null }
/** A visible, reviewed client of canonical audited actions; no bulk authorization shortcut. */
export function AdminClubImport({ schools, onComplete }: { schools: { id: string; name: string }[]; onComplete: () => void }) {
  // The list is the server's active-school scope; saveAdminClub re-checks the chosen school on every write.
  const [schoolId, setSchoolId] = useState(schools.length === 1 ? schools[0].id : '')
  const [plan, setPlan] = useState<Planned[]>([]), [images, setImages] = useState<File[]>([])
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [reason, setReason] = useState('')
  async function review(file?: File) {
    setError(''); setPlan([]); if (!file) return
    if (!schools.some(s => s.id === schoolId)) { setError('Choose a school before selecting the package.'); return }
    setBusy(true)
    try {
      if (file.size > 2 * 1024 * 1024) throw new UserFacingError('Choose a profile JSON package up to 2 MB.')
      const parsed = clubProfileImportSchema.parse(JSON.parse(await file.text()))
      const next: Planned[] = []
      for (const row of parsed.profiles) {
        const matches = await getAdminClubs({ query: row.slug })
        const match = matches.rows.find(c => c.slug === row.slug)
        if (row.existingId && match?.id !== row.existingId) throw new UserFacingError(`Existing club mismatch: ${row.profile.name}.`)
        const loaded = match ? await getAdminClub(match.id) : null
        if (loaded && !loaded.value) throw new UserFacingError('Could not load an existing club. Refresh and try again.')
        const current = loaded?.value ?? null
        if (current && (current.schoolId !== schoolId || current.suspendedAt || current.profile.name !== row.profile.name)) throw new UserFacingError(`Review the existing club separately: ${row.profile.name}.`)
        next.push({ row, current })
      }
      setPlan(next); setMessage('Review every create/update below. New clubs start with applications closed. Existing recruitment settings are preserved; no invitations are sent.')
    } catch (e) { setError(userMessage(e, 'Could not review this package.')) }
    finally { setBusy(false) }
  }
  const missing = [...new Set(plan.flatMap(({ row }) => importImageNames(row)))].filter(name => !images.some(f => f.name === name))
  async function run() {
    setBusy(true); setError('')
    try {
      await runClubProfileImport(plan, images, schoolId, reason, {
        save: saveAdminClub,
        load: async id => (await getAdminClub(id)).value ?? null,
        upload: async (id, file) => {
          const body = new FormData(); body.set('clubId', id); body.set('file', file); body.set('admin', 'true')
          return (await uploadClubAsset(body)).reference
        },
        progress: name => setMessage(`Importing ${name}…`),
      })
      setPlan([]); setMessage('All reviewed profiles published. No leadership granted or invitations sent.'); onComplete()
    } catch (e) { setPlan([]); setError(`${userMessage(e, 'Import stopped.')} Earlier completed clubs are preserved. Select the package again to review current state before retrying.`) }
    finally { setBusy(false) }
  }
  return <details className="oc-content-panel"><summary className="cursor-pointer font-semibold">Import researched club profiles</summary><div className="mt-5 space-y-4">
    <p className="text-sm text-muted-foreground">Review a JSON profile package and its local images. Creates or updates public profiles in the chosen school; new clubs start with applications closed and existing recruitment settings stay unchanged. Existing memberships, applicants and history are preserved. Each upload and save requires fresh Admin verification.</p>
    {schools.length > 1 && <label className="block space-y-2 text-sm">School<NativeSelect required value={schoolId} disabled={busy} onChange={e => { setSchoolId(e.target.value); setPlan([]); setMessage('') }}><option value="" disabled>Choose a school</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></label>}
    <label className="block space-y-2 text-sm">Profile JSON<Input type="file" accept="application/json,.json" disabled={busy || !schoolId} onChange={e => { void review(e.target.files?.[0]); e.target.value = '' }} /></label>
    <label className="block space-y-2 text-sm">Profile images<Input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => setImages(Array.from(e.target.files || []))} /></label>
    <label className="block space-y-2 text-sm">Reason for import<Input value={reason} maxLength={1000} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
    {plan.length > 0 && <><ul className="space-y-2 text-sm">{plan.map(({ row, current }) => <li key={row.slug}><details><summary className="cursor-pointer py-2"><strong>{current ? 'Update' : 'Create'}:</strong> {row.profile.name} · /{row.slug} · {importImageNames(row).length} images · {current ? "recruitment settings preserved" : "applications initially closed"}</summary><div className="space-y-4 py-4"><MarketingProfile profile={row.profile} /><AboutSection profile={row.profile} /><MarketingSections profile={row.profile} /></div></details></li>)}</ul>{missing.length > 0 && <p className="text-sm text-destructive">Missing images: {missing.join(', ')}</p>}<Button disabled={busy || !!missing.length || reason.trim().length < 10} onClick={() => void run()}>Publish {plan.length} reviewed profiles</Button></>}
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div></details>
}
