"use client"

import { useEffect, useState } from "react"
import { getInterviewerEligibility, setInterviewerEligibility } from "@/actions/availability"
import { organizationRoles, organizationRoleLabels } from "@/lib/organization-authorization"
import { useDemoMode } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import "./availability.css"

/** Uses the existing directory's selection instead of building another roster. */
export function InterviewerEligibilityControls({ clubId, selectedIds, onSaved, individual = false, refreshKey = "" }: { clubId: string; selectedIds: string[]; onSaved?: () => Promise<void>; individual?: boolean; refreshKey?: string }) {
  const demo = useDemoMode()
  const [data, setData] = useState<Awaited<ReturnType<typeof getInterviewerEligibility>> | null>(null), [roles, setRoles] = useState<string[]>([])
  const [roundId, setRoundId] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), [notice, setNotice] = useState("")
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled) return
    let active = true
    getInterviewerEligibility(clubId).then(value => { if (active) { setData(value); setRoles(value.roles) } }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load interviewer eligibility.") })
    return () => { active = false }
  }, [clubId, attempt, demo.ready, demo.isDemoEnabled, refreshKey])
  const selected = data?.members.filter(m => selectedIds.includes(m.id)) ?? []
  async function save(eligible?: boolean | null) {
    if (!data || busy) return
    setBusy(true); setError(""); setNotice("")
    try {
      await setInterviewerEligibility({ clubId, revision: data.revision, ...(eligible === undefined ? { roles } : { targets: selected.map(m => ({ memberId: m.id, eligible })), ...(roundId ? { roundId } : {}) }) })
      setNotice("Eligibility saved. Affected members need to reconfirm round participation.")
      const value = await getInterviewerEligibility(clubId); setData(value); setRoles(value.roles)
      await onSaved?.()
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save eligibility.") }
    finally { setBusy(false) }
  }
  if (demo.isDemoEnabled) return null
  return <section className={`${individual ? "border-t pt-4" : "rounded-xl border p-4"} space-y-4`} data-eligibility-controls data-saving={busy} data-unsaved={!!data && JSON.stringify(roles) !== JSON.stringify(data.roles)}>
    <h3 className="oc-card-heading">Interviewer eligibility</h3><p className="text-xs leading-5 text-muted-foreground">Eligibility is specific to this club. It grants no administrative or applicant-access permissions. Individual settings override role defaults; round settings override both.</p>
    {!data && !error && <p role="status" className="text-sm">Loading eligibility…</p>}
    {data && <fieldset disabled={busy} className="space-y-4">{!individual && <section><h4 className="text-sm font-medium">Eligible membership roles</h4><div className="my-3 flex flex-wrap gap-4">{organizationRoles.map(role => <label key={role} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(role)} onChange={e => setRoles(values => e.target.checked ? [...values, role] : values.filter(v => v !== role))} />{organizationRoleLabels[role]}</label>)}</div><Button variant="outline" onClick={() => void save()}>Save role defaults</Button></section>}
      {(individual || selectedIds.length > 0) && <><label className="block text-sm">Eligibility scope<select value={roundId} className="oc-av-select mt-1 block w-full sm:w-auto" onChange={e => setRoundId(e.target.value)}><option value="">This club · all rounds by default</option>{data.rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
      <p className="text-sm">{selected.length ? `${selected.length} active member${selected.length === 1 ? "" : "s"} selected` : "Select members in the directory to update them together."}</p>
      {selected.length === 1 && (() => { const member = selected[0], override = roundId ? member.rounds.find(r => r.id === roundId)?.override : member.override; const eligible = override ?? (roundId ? member.override : null) ?? data.roles.includes(member.role); return <p className="text-xs text-muted-foreground">{member.name}: {eligible ? "Eligible" : "Not eligible"}{override === undefined || override === null ? " (inherited)" : " (individual override)"}</p> })()}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!selected.length} onClick={() => void save(true)}>Make eligible</Button><Button variant="outline" disabled={!selected.length} onClick={() => void save(false)}>Exclude from interviewing</Button><Button variant="ghost" disabled={!selected.length} onClick={() => void save(null)}>Use inherited eligibility</Button></div></>}
    </fieldset>}
    {notice && <p role="status" className="text-xs">{notice}</p>}{error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => { setError(""); setAttempt(v => v + 1) }}>Reload eligibility</Button></div>}
  </section>
}
