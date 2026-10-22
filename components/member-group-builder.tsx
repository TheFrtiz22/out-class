"use client"

import { useMemo, useRef, useState } from "react"
import { ActionWorkflow } from "@/components/product/action-workflow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createOrganizationMemberGroups } from "@/actions/organization-members"
import type { getOrganizationMemberManagement } from "@/lib/workspace-read"
import { organizationRoleLabels } from "@/lib/organization-authorization"
import { compareAcademicYears } from "@/lib/recruitment-profile"
import { planMemberGroups, selectGroupMembers, type MemberGroupCriteria, type MemberGroupSplit } from "@/lib/member-groups"

type Member = Awaited<ReturnType<typeof getOrganizationMemberManagement>>["members"][number]
const memberName = (member: Member) => member.user.studentProfile ? `${member.user.studentProfile.firstName} ${member.user.studentProfile.lastName}` : member.user.email
const emptyCriteria: MemberGroupCriteria = { everyone: false, years: [], roles: [], groups: [], recent: false, people: [], match: "ANY" }
export function MemberGroupBuilder({ clubId, members, onSaved }: { clubId: string; members: Member[]; onSaved: () => Promise<void> }) {
  return <ActionWorkflow title="Create group(s)" description="Name your group, choose who belongs, then optionally divide it into smaller groups." trigger="Create group(s)" presentation="sheet" showCloseAction={false}>
    {done => <GroupWizard clubId={clubId} members={members} onSaved={onSaved} done={done} />}
  </ActionWorkflow>
}
function GroupWizard({ clubId, members, onSaved, done }: { clubId: string; members: Member[]; onSaved: () => Promise<void>; done: () => void }) {
  const [step, setStep] = useState(1), [name, setName] = useState("")
  const [criteria, setCriteria] = useState<MemberGroupCriteria>(emptyCriteria), [dimensions, setDimensions] = useState<string[]>([])
  const [query, setQuery] = useState(""), [split, setSplit] = useState<MemberGroupSplit | null>(null)
  const working = useRef(false)
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("")
  const active = members.filter(member => member.status === "ACTIVE" && !member.user.disabledAt)
  const selected = useMemo(() => selectGroupMembers(members, criteria), [members, criteria])
  const years = [...new Set(active.flatMap(member => member.user.studentProfile?.academicYear ? [member.user.studentProfile.academicYear.replace(/\*$/, "")] : []))].sort(compareAcademicYears)
  const groups = [...new Set(active.flatMap(member => member.groups))].sort()
  const roles = [...new Set(active.map(member => member.isOwner ? "OWNER" : member.accessRole))]
  let plan: ReturnType<typeof planMemberGroups> = [], planError = ""
  if (step === 3 && selected.length && name.trim()) {
    try { plan = planMemberGroups(selected.map(member => member.id), name.trim(), split) }
    catch (error) { planError = error instanceof Error ? error.message : "Check the group size." }
  }
  function dimension(field: "years" | "roles" | "groups" | "people") {
    setCriteria(value => ({ ...value, everyone: false, [field]: [] }))
    setDimensions(value => value.includes(field) ? value.filter(item => item !== field) : [...value, field])
  }
  function toggle(field: "years" | "roles" | "groups" | "people", value: string) {
    setCriteria(current => ({ ...current, everyone: false, [field]: current[field].includes(value) ? current[field].filter(item => item !== value) : [...current[field], value] }))
  }
  async function save() {
    if (working.current || busy || saved || !plan.length || selected.length > 500) return
    working.current = true
    setBusy(true); setError("")
    try {
      await createOrganizationMemberGroups({ clubId, name: name.trim(), targets: selected.map(member => ({ id: member.id, updatedAt: member.updatedAt })), split })
      setSaved(true)
      try { await onSaved(); done() }
      catch { setError("Groups were created. Close this window and refresh members to see them.") }
    } catch (error) { setError(error instanceof Error ? error.message : "Groups could not be saved. Refresh members before retrying.") }
    finally { working.current = false; setBusy(false) }
  }
  return <form className="space-y-5" data-saving={busy} data-unsaved={!saved && (!!name || selected.length > 0)} onSubmit={event => { event.preventDefault(); if (step === 1 && name.trim()) setStep(2) }}>
    <ol aria-label="Group creation steps" className="flex gap-4 border-b pb-3 text-sm">{["Name", "Members", "Review"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step === index + 1 ? "font-semibold text-primary" : "text-muted-foreground"}>{index + 1}. {label}</li>)}</ol>
    <fieldset disabled={busy || saved} className="space-y-5">
      {step === 1 && <label className="block space-y-2 text-sm font-medium">Group name<Input required maxLength={64} placeholder="e.g. New members, Second years, Finance" value={name} onChange={event => setName(event.target.value)} /></label>}
      {step === 2 && <>
        <h3 className="oc-card-heading">Who belongs in {name.trim()}?</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose member categories">
          <Button type="button" size="sm" variant={criteria.everyone ? "secondary" : "outline"} aria-pressed={criteria.everyone} onClick={() => { setCriteria({ ...emptyCriteria, everyone: !criteria.everyone }); setDimensions([]) }}>All members</Button>
          <Button type="button" size="sm" variant={criteria.recent ? "secondary" : "outline"} aria-pressed={criteria.recent} onClick={() => setCriteria(value => ({ ...value, everyone: false, recent: !value.recent }))}>New members · last 30 days</Button>
          {([["years", "By year"], ["roles", "By role"], ["groups", "Existing groups"], ["people", "Choose people"]] as const).map(([field, label]) => <Button type="button" size="sm" key={field} variant={dimensions.includes(field) ? "secondary" : "outline"} aria-pressed={dimensions.includes(field)} onClick={() => dimension(field)}>{label}</Button>)}
        </div>
        {dimensions.length + Number(criteria.recent) > 1 && <label className="flex flex-wrap items-center gap-3 text-sm">Combine categories<select className="min-h-11 rounded border bg-card px-3" value={criteria.match} onChange={event => setCriteria(value => ({ ...value, match: event.target.value as "ANY" | "ALL" }))}><option value="ANY">Match any selected category</option><option value="ALL">Match every selected category</option></select></label>}
        {dimensions.includes("years") && <fieldset><legend className="mb-2 text-sm font-semibold">Class year</legend><div className="grid gap-2 sm:grid-cols-2">{years.map(year => <label key={year} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={criteria.years.includes(year)} onChange={() => toggle("years", year)} />{year}</label>)}</div></fieldset>}
        {dimensions.includes("roles") && <fieldset><legend className="mb-2 text-sm font-semibold">Club role</legend><div className="grid gap-2 sm:grid-cols-2">{roles.map(role => <label key={role} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={criteria.roles.includes(role)} onChange={() => toggle("roles", role)} />{organizationRoleLabels[role]}</label>)}</div></fieldset>}
        {dimensions.includes("groups") && <fieldset><legend className="mb-2 text-sm font-semibold">Existing groups</legend><div className="grid gap-2 sm:grid-cols-2">{groups.map(group => <label key={group} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={criteria.groups.includes(group)} onChange={() => toggle("groups", group)} />{group}</label>)}{!groups.length && <p className="text-sm text-muted-foreground">No groups yet. Choose years, roles, or individual people.</p>}</div></fieldset>}
        {dimensions.includes("people") && <section className="space-y-3"><Input type="search" aria-label="Search people for group" placeholder="Search people…" value={query} onChange={event => setQuery(event.target.value)} /><div className="max-h-60 overflow-y-auto">{active.filter(member => `${memberName(member)} ${member.user.email}`.toLowerCase().includes(query.toLowerCase())).map(member => <label key={member.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={criteria.people.includes(member.id)} onChange={() => toggle("people", member.id)} />{memberName(member)}</label>)}</div></section>}
        <p role="status" className="text-sm font-medium">{selected.length} {selected.length === 1 ? "member" : "members"} selected</p>
        {!!selected.length && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Preview selected people</summary><ul className="max-h-48 overflow-y-auto">{selected.map(member => <li key={member.id} className="py-1">{memberName(member)}</li>)}</ul></details>}
        {selected.length > 500 && <p role="alert" className="text-sm text-destructive">Choose up to 500 members per group creation.</p>}
      </>}
      {step === 3 && <>
        <h3 className="oc-card-heading">{name.trim()} · {selected.length} {selected.length === 1 ? "member" : "members"}</h3>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={!!split} onChange={event => setSplit(event.target.checked ? { mode: "SIZE", amount: 4, seed: crypto.randomUUID() } : null)} />Divide into random groups</label>
        {split && <section className="space-y-3 rounded-lg border p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm">Divide by<select aria-label="Divide by" className="block min-h-11 w-full rounded border bg-card px-3" value={split.mode} onChange={event => setSplit({ ...split, mode: event.target.value as "SIZE" | "COUNT", amount: event.target.value === "COUNT" ? Math.min(split.amount, selected.length, 100) : split.amount })}><option value="SIZE">People per group (maximum)</option><option value="COUNT">Number of groups</option></select></label><label className="space-y-2 text-sm">{split.mode === "SIZE" ? "People per group" : "Number of groups"}<Input aria-label={split.mode === "SIZE" ? "People per group" : "Number of groups"} type="number" min={1} max={split.mode === "SIZE" ? 500 : Math.min(100, selected.length)} value={split.amount} onChange={event => setSplit({ ...split, amount: Number(event.target.value) })} /></label></div><Button type="button" variant="ghost" onClick={() => setSplit({ ...split, seed: crypto.randomUUID() })}>Shuffle again</Button><p className="text-xs text-muted-foreground">Everyone stays in {name.trim()} and is assigned to one subgroup.</p></section>}
        {planError && <p role="alert" className="text-sm text-destructive">{planError}</p>}
        <div className="max-h-72 space-y-3 overflow-y-auto">{plan.map(group => <section key={group.name} className="border-t pt-3"><h4 className="text-sm font-semibold">{group.name} · {group.memberIds.length}</h4><p className="mt-1 text-sm text-muted-foreground">{group.memberIds.map(id => memberName(members.find(member => member.id === id)!)).join(", ")}</p></section>)}</div>
      </>}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-4">{step > 1 ? <Button type="button" variant="ghost" onClick={() => { setError(""); setStep(step - 1) }}>Back</Button> : <span />}{step < 3 ? <Button type="button" disabled={step === 1 ? !name.trim() : !selected.length || selected.length > 500} onClick={() => setStep(step + 1)}>Next</Button> : <Button type="button" disabled={busy || !!planError || !plan.length} onClick={() => void save()}>{busy ? "Creating…" : split ? `Create ${plan.length} ${plan.length === 1 ? "group" : "groups"}` : "Create group"}</Button>}</div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && <Button type="button" variant="outline" onClick={done}>Close</Button>}
  </form>
}
