"use client"
import { memberAcademicProfile } from "@/lib/recruitment-profile"
import { organizationCapabilities } from "@/lib/organization-authorization"
import { OrganizationMemberManagement } from "@/components/organization-member-management"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { permissionLabels, type ClubPermission } from "@/lib/permissions"
import { getClubMembers, getClubAccess, addClubMember, removeClubMember } from "@/actions/club-access"
import { updateTaskMember } from "@/lib/workspace-api"
import { RosterCsvImporter } from "@/components/roster-csv-importer"
import { ClubAccessEditor } from "@/components/club-access-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
type Member = Omit<Awaited<ReturnType<typeof getClubMembers>>[number], "status" | "accessRole" | "joinedAt" | "updatedAt">
const name = (m: Member) => m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email
const role = (m: Member) => m.title || m.role.replaceAll("_", " ").toLowerCase()
type Directory = Awaited<ReturnType<typeof import("@/actions/organization-members").getOrganizationMemberManagement>>
export function ClubMembers({ clubId, initialDirectory, onDirectory }: { clubId: string; initialDirectory?: Directory | null; onDirectory?: (data: Directory | null) => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const actor = user?.memberships.find(m => m.clubId === clubId)
  const { canChangeRoles: canAccess, canManageMembers: canMembers } = organizationCapabilities(actor)
  const [data, setData] = useState<{ clubId: string; members: Member[]; access: Awaited<ReturnType<typeof getClubAccess>> | null } | null>(null)
  const [query, setQuery] = useState(""), [activeId, setActiveId] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [dirty, setDirty] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
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
  const demoMembers: Member[] = demo.isDemoEnabled ? (demo.state?.memberships.filter(m => m.clubId === clubId) || []).flatMap(m => { const student = demo.state?.students.find(s => s.id === m.userId); return student ? [{...m,title:null,isOwner:m.userId === user?.id && !!actor?.isOwner,permissions:m.userId === user?.id ? [...(actor?.permissions || [])] : [],user:{email:student.email,studentProfile:memberAcademicProfile({ firstName:student.profile.firstName,lastName:student.profile.lastName,major:student.profile.major,gradYear:student.profile.gradYear,transferStudent:student.profile.transferStudent })}}] : [] }) : []
  const members = demo.isDemoEnabled ? demoMembers : data?.clubId === clubId ? data.members : []
  const active = members.find(m => m.id === activeId)
  const visible = members.filter(m => `${name(m)} ${m.user.email} ${role(m)} ${m.user.studentProfile?.academicYear || ""} ${m.cohort || ""} ${m.groups.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
  async function reload() {
    if (canAccess) { const access = await getClubAccess(clubId); setData({clubId,members:access.members,access}) }
    else setData({clubId,members:await getClubMembers(clubId),access:null})
    setDirty(false); await refreshUser()
  }
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await reload() } catch(e) { setError(e instanceof Error ? e.message : "Could not save.") } finally { setBusy(false) } }
  if (!canAccess && !canMembers) return <p role="alert">Member management is not available with your current access.</p>
  if (demo.ready && !demo.isDemoEnabled) return <OrganizationMemberManagement key={clubId} clubId={clubId} initialData={initialDirectory} onData={onDirectory} />
  return <div className="max-w-5xl space-y-6" data-unsaved={dirty} data-saving={busy}>
    <p className="text-sm leading-7 text-muted-foreground">Club roles describe responsibilities. Management access is granted separately, capability by capability.</p>
    {demo.isDemoEnabled && <p className="text-sm text-muted-foreground">Fictional demo directory. Membership and access changes are available outside Demo Mode.</p>}
    {!demo.isDemoEnabled && canMembers && <RosterCsvImporter key={clubId} clubId={clubId} />}
    <Input type="search" aria-label="Search members" placeholder="Search name, role, year, or group" value={query} onChange={e=>setQuery(e.target.value)} className="max-w-md" />
    {!demo.isDemoEnabled && canAccess && data?.access && <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Invite & pending invitations</summary><div className="mt-5"><ClubAccessEditor clubId={clubId} initial={data.access} inviteOnly onSaved={reload} /></div></details>}
    {!demo.isDemoEnabled && canMembers && <details className="border-b pb-4"><summary className="cursor-pointer text-sm">Add an existing member</summary><form className="mt-4 flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const email=String(new FormData(e.currentTarget).get("email"));void run(()=>addClubMember(clubId,email))}}><Input name="email" type="email" required aria-label="Existing member UVA email" placeholder="UVA email" className="max-w-sm" /><Button disabled={busy}>Add member</Button></form></details>}
    {error && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Reload members</Button></div>}
    {!demo.isDemoEnabled && !data && !error ? <p role="status">Loading members…</p> : <><div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b pb-3 text-xs text-muted-foreground md:grid" aria-hidden="true"><span>Member</span><span>Role / title</span><span>Year · groups</span><span>Access</span></div><ul className="divide-y">{visible.map(m=><li key={m.id}><button type="button" className="grid w-full gap-3 rounded py-5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center md:gap-4" onClick={e=>{trigger.current=e.currentTarget;setActiveId(m.id);setDirty(false)}}><span className="min-w-0"><span className="block break-words font-medium">{name(m)}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{m.user.email}</span></span><span className="text-sm capitalize">{role(m)}</span><span className="text-xs text-muted-foreground">{[m.user.studentProfile?.academicYear,m.cohort,...m.groups].filter(Boolean).join(" · ") || "Not provided"}</span><span className="text-xs">{m.isOwner ? "Owner" : m.permissions.length ? "Management access" : "Member"}</span></button></li>)}</ul>{!visible.length && <p role="status" className="py-8 text-sm text-muted-foreground">{members.length ? "No members match your search." : "No members available."}</p>}</>}
    <Sheet open={!!active} onOpenChange={open=>{if(!open){if(busy || document.querySelector('[data-saving="true"]'))return;if(dirty&&!window.confirm("Discard unsaved member changes?"))return;setActiveId(null);setDirty(false)}}}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={e=>{e.preventDefault();if(trigger.current?.isConnected)trigger.current.focus();else document.getElementById("workspace-content")?.focus()}}><SheetTitle>{active ? name(active) : "Member"}</SheetTitle><SheetDescription>{active?.user.email}</SheetDescription>{active && <div className="mt-6 space-y-7" onChangeCapture={e=>{if((e.target as HTMLElement).closest("form, fieldset"))setDirty(true)}}>
      <section className="space-y-2"><h3 className="oc-card-heading capitalize">{role(active)}</h3><p className="text-sm text-muted-foreground">{[active.user.studentProfile?.major,active.user.studentProfile?.academicYear ? active.user.studentProfile.academicYear : ""].filter(Boolean).join(" · ") || "Academic summary not provided."}</p><p className="text-sm">Groups: {active.groups.join(", ") || "None"}</p><p className="text-sm">Cohort: {active.cohort || "Not set"}</p></section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!demo.isDemoEnabled && canMembers && <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Edit groups & cohort</summary><form key={`${active.id}:${active.groups.join(",")}:${active.cohort}`} className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>updateTaskMember({clubId,memberId:active.id,groups:String(form.get("groups")).split(",").map(s=>s.trim()).filter(Boolean),cohort:String(form.get("cohort")).trim()||null}))}}><label className="block text-sm">Groups (comma-separated)<Input name="groups" defaultValue={active.groups.join(", ")} /></label><label className="block text-sm">Cohort<Input name="cohort" maxLength={80} defaultValue={active.cohort || ""} /></label><Button disabled={busy}>Save groups & cohort</Button></form></details>}
      <section className="space-y-4 border-t pt-5"><h3 className="oc-card-heading ">Management access</h3>{!demo.isDemoEnabled && canAccess && data?.access ? <ClubAccessEditor key={active.id} clubId={clubId} initial={data.access} selectedMemberId={active.id} onSaved={reload} /> : <p className="text-sm leading-7 text-muted-foreground">{active.isOwner ? "Owner · all club capabilities" : active.permissions.map(p=>permissionLabels[p as ClubPermission] || p).join(", ") || "No management capabilities."}</p>}</section>
      {!demo.isDemoEnabled && canMembers && !active.isOwner && !active.permissions.length && <section className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Removing membership revokes club access. Members with evaluation or interview history must be retained.</p><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(`Remove ${name(active)} from this club?`))void run(()=>removeClubMember(clubId,active.id))}}>Remove membership</Button></section>}
    </div>}</SheetContent></Sheet>
  </div>
}
