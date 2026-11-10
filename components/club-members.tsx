"use client"
import { SearchField } from "@/components/ui/search-field"
import { memberAcademicProfile } from "@/lib/recruitment-profile"
import { normalizeProfileFieldVisibility, restrictProfileFields } from "@/lib/profile-field-visibility"
import { organizationCapabilities } from "@/lib/organization-authorization"
import { OrganizationMemberManagement } from "@/components/organization-member-management"
import { useEffect, useRef, useState } from "react"
import { DataTable, DataTableSecondary } from "@/components/ui/data-table"
import { joinFacts } from "@/lib/join-facts"
import { SortControl } from "@/components/ui/sort-control"
import { useListSort } from "@/hooks/use-list-sort"
import { compareAcademicYears } from "@/lib/recruitment-profile"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { permissionLabels, type ClubPermission } from "@/lib/permissions"
import { getClubMembers, getClubAccess, addClubMember, removeClubMember } from "@/actions/club-access"
import { updateTaskMember } from "@/lib/workspace-api"
import { RosterCsvImporter } from "@/components/roster-csv-importer"
import { ClubAccessEditor } from "@/components/club-access-editor"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
type Member = Omit<Awaited<ReturnType<typeof getClubMembers>>[number], "status" | "accessRole" | "joinedAt" | "updatedAt">
const name = (m: Member) => m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email
const role = (m: Member) => m.title || m.role.replaceAll("_", " ").toLowerCase()
const access = (m: Member) => m.isOwner ? "Owner" : m.permissions.length ? "Management access" : "Member"
const sortKeys = ["name", "year", "role", "status"] as const
type MemberSort = (typeof sortKeys)[number]
const sortOptions: { key: MemberSort; label: string }[] = [{ key: "name", label: "Name" }, { key: "year", label: "Year" }, { key: "role", label: "Role" }, { key: "status", label: "Access" }]
const sortsDescending = (key: MemberSort) => key === "year"
type Directory = Awaited<ReturnType<typeof import("@/actions/organization-members").getOrganizationMemberManagement>>
export function ClubMembers({ clubId, initialDirectory, onDirectory, validatedInitialData = false }: { clubId: string; validatedInitialData?: boolean; initialDirectory?: Directory | null; onDirectory?: (data: Directory | null) => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const actor = user?.memberships.find(m => m.clubId === clubId)
  const { canChangeRoles: canAccess, canManageMembers: canMembers } = organizationCapabilities(actor)
  const [data, setData] = useState<{ clubId: string; members: Member[]; access: Awaited<ReturnType<typeof getClubAccess>> | null } | null>(null)
  const [query, setQuery] = useState(""), [activeId, setActiveId] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [dirty, setDirty] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
  const listSort = useListSort(sortKeys, "name", sortsDescending)
  useEffect(() => {
    if (!demo.ready || !demo.isDemoEnabled) return
    let current = true
    setData(null); setError(""); setActiveId(null); setDirty(false)
    if (demo.isDemoEnabled) return
    if (!canAccess && !canMembers) return
    const load = canAccess ? getClubAccess(clubId).then(access => ({clubId,members:access.members,access})) : getClubMembers(clubId).then(members => ({clubId,members,access:null}))
    load.then(value => { if (current) setData(value) }).catch(() => { if(current) setError("Could not load members. Your access may have changed.") })
    return () => { current = false }
  }, [clubId,canAccess,canMembers,demo.ready,demo.isDemoEnabled,retry])
  useEffect(() => { if (!dirty && !busy) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload",warn); return () => window.removeEventListener("beforeunload",warn) }, [dirty,busy])
  // Demo roster follows the Demo club's profile field setting, as the live roster read does on the server.
  const profileFields = normalizeProfileFieldVisibility(demo.state?.profileFieldVisibility?.[clubId])
  const demoMembers: Member[] = demo.isDemoEnabled ? (demo.state?.memberships.filter(m => m.clubId === clubId) || []).flatMap(m => { const student = demo.state?.students.find(s => s.id === m.userId); return student ? [{...m,interviewerEligible:null,title:null,isOwner:m.userId === user?.id && !!actor?.isOwner,permissions:m.userId === user?.id ? [...(actor?.permissions || [])] : [],user:{email:student.email,studentProfile:restrictProfileFields(memberAcademicProfile({ firstName:student.profile.firstName,lastName:student.profile.lastName,major:student.profile.major,gradYear:student.profile.gradYear,transferStudent:student.profile.transferStudent }), profileFields)}}] : [] }) : []
  const members = demo.isDemoEnabled ? demoMembers : data?.clubId === clubId ? data.members : []
  const active = members.find(m => m.id === activeId)
  const year = (m: Member) => m.user.studentProfile?.academicYear || ""
  const visible = members.filter(m => `${name(m)} ${m.user.email} ${role(m)} ${year(m)} ${m.cohort || ""} ${m.groups.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    // Members without a class year stay last in either direction; Name is a real sort key, not only the tie-break.
    if (listSort.key === "year" && !year(a) !== !year(b)) return Number(!year(a)) - Number(!year(b))
    const compared = listSort.key === "year" ? (year(a) ? compareAcademicYears(year(a), year(b)) : 0) : listSort.key === "role" ? role(a).localeCompare(role(b)) : listSort.key === "status" ? access(a).localeCompare(access(b)) : listSort.key === "name" ? name(a).localeCompare(name(b)) : 0
    return (listSort.descending ? -compared : compared) || name(a).localeCompare(name(b)) || a.id.localeCompare(b.id)
  })
  async function reload() {
    if (canAccess) { const access = await getClubAccess(clubId); setData({clubId,members:access.members,access}) }
    else setData({clubId,members:await getClubMembers(clubId),access:null})
    setDirty(false); await refreshUser()
  }
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await reload() } catch(e) { setError(e instanceof Error ? e.message : "Could not save.") } finally { setBusy(false) } }
  if (!canAccess && !canMembers) return <p role="alert">Member management is not available with your current access.</p>
  if (demo.ready && !demo.isDemoEnabled) return <OrganizationMemberManagement key={clubId} clubId={clubId} initialData={initialDirectory} onData={onDirectory} validatedInitialData={validatedInitialData} />
  return <div className="oc-workspace-stack" data-unsaved={dirty} data-saving={busy}>
    <p className="text-sm leading-7 text-muted-foreground">Club roles describe responsibilities. Management access is granted separately, capability by capability.</p>
    {demo.isDemoEnabled && <p className="text-sm text-muted-foreground">Fictional demo directory. Membership and access changes are available outside Demo Mode.</p>}
    {!demo.isDemoEnabled && canMembers && <RosterCsvImporter key={clubId} clubId={clubId} />}
    <div className="oc-list-toolbar"><SearchField aria-label="Search members" placeholder="Search name, role, year, or group" value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery("")} containerClassName="min-w-0 max-w-md flex-1 basis-60" /><SortControl label="Sort members" options={sortOptions} value={listSort.key} descending={listSort.descending} descendingByDefault={sortsDescending} onChange={listSort.set} /></div>
    {!demo.isDemoEnabled && canAccess && data?.access && <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Invite & pending invitations</summary><div className="mt-5"><ClubAccessEditor clubId={clubId} initial={data.access} inviteOnly onSaved={reload} /></div></details>}
    {!demo.isDemoEnabled && canMembers && <details className="border-b pb-4"><summary className="cursor-pointer text-sm">Add an existing member</summary><form className="mt-4 flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const email=String(new FormData(e.currentTarget).get("email"));void run(()=>addClubMember(clubId,email))}}><Input name="email" type="email" required aria-label="Existing member UVA email" placeholder="UVA email" className="max-w-sm" /><Button disabled={busy}>Add member</Button></form></details>}
    {error && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Reload members</Button></div>}
    {!demo.isDemoEnabled && !data && !error ? <LoadingState label="Loading club members…" layout="table" rows={4} /> : <>{visible.length > 0 && <DataTable caption="Club members" rows={visible} rowKey={m => m.id}
      sort={{ key: listSort.key, descending: listSort.descending, toggle: key => listSort.toggle(key as MemberSort) }}
      openLabel={m => `Member details · ${name(m)}`}
      onOpen={(m, origin) => { trigger.current = origin; setActiveId(m.id); setDirty(false) }}
      columns={[
        { id: "name", header: "Member", sortKey: "name", primary: true, cell: m => <span className="oc-dt-name">{name(m)}</span>, secondary: m => <DataTableSecondary from="lg">{m.user.email}</DataTableSecondary> },
        { id: "role", header: "Role / title", sortKey: "role", cell: m => <span className="capitalize">{role(m)}</span> },
        { id: "year", header: "Year", sortKey: "year", showFrom: "md", cell: m => year(m) || "—" },
        { id: "groups", header: "Groups", showFrom: "xl", cell: m => <span className="oc-dt-muted">{[m.cohort, ...m.groups].filter(Boolean).join(" · ") || "—"}</span> },
        { id: "access", header: "Access", sortKey: "status", cell: m => access(m) },
      ]}
      card={{ title: m => name(m), meta: m => joinFacts(year(m), access(m) === "Member" ? role(m).replace(/^./, c => c.toUpperCase()) : access(m)) }} />}{!visible.length && <div role="status" className="space-y-3 py-8 text-sm text-muted-foreground"><p>{members.length ? `No members match “${query}”.` : "This club has no active members yet. Members are added when they accept an invitation."}</p>{members.length ? <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>Clear search</Button> : null}</div>}</>}
    <Sheet open={!!active} onOpenChange={open=>{if(!open){if(busy || document.querySelector('[data-saving="true"]'))return;if(dirty&&!window.confirm("Discard unsaved member changes?"))return;setActiveId(null);setDirty(false)}}}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={e=>{e.preventDefault();if(trigger.current?.isConnected)trigger.current.focus();else document.getElementById("workspace-content")?.focus()}}><SheetTitle>{active ? name(active) : "Member"}</SheetTitle><SheetDescription>{active?.user.email}</SheetDescription>{active && <div className="mt-6 space-y-7" onChangeCapture={e=>{if((e.target as HTMLElement).closest("form, fieldset"))setDirty(true)}}>
      <section className="space-y-2"><h3 className="oc-card-heading capitalize">{role(active)}</h3>{(profileFields.major || profileFields.academicYear) && <p className="text-sm text-muted-foreground">{[profileFields.major ? active.user.studentProfile?.major : "",profileFields.academicYear ? active.user.studentProfile?.academicYear : ""].filter(Boolean).join(" · ") || "Academic summary not provided."}</p>}<p className="text-sm">Groups: {active.groups.join(", ") || "None"}</p><p className="text-sm">Cohort: {active.cohort || "Not set"}</p></section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!demo.isDemoEnabled && canMembers && <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Edit groups & cohort</summary><form key={`${active.id}:${active.groups.join(",")}:${active.cohort}`} className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>updateTaskMember({clubId,memberId:active.id,groups:String(form.get("groups")).split(",").map(s=>s.trim()).filter(Boolean),cohort:String(form.get("cohort")).trim()||null}))}}><label className="block text-sm">Groups (comma-separated)<Input name="groups" defaultValue={active.groups.join(", ")} /></label><label className="block text-sm">Cohort<Input name="cohort" maxLength={80} defaultValue={active.cohort || ""} /></label><Button disabled={busy}>Save groups & cohort</Button></form></details>}
      <section className="space-y-4 border-t pt-5"><h3 className="oc-card-heading ">Management access</h3>{!demo.isDemoEnabled && canAccess && data?.access ? <ClubAccessEditor key={active.id} clubId={clubId} initial={data.access} selectedMemberId={active.id} onSaved={reload} /> : <p className="text-sm leading-7 text-muted-foreground">{active.isOwner ? "Owner · all club capabilities" : active.permissions.map(p=>permissionLabels[p as ClubPermission] || p).join(", ") || "No management capabilities."}</p>}</section>
      {!demo.isDemoEnabled && canMembers && !active.isOwner && !active.permissions.length && <section className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Removing membership revokes club access. Members with evaluation or interview history must be retained.</p><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(`Remove ${name(active)} from this club?`))void run(()=>removeClubMember(clubId,active.id))}}>Remove membership</Button></section>}
    </div>}</SheetContent></Sheet>
  </div>
}
