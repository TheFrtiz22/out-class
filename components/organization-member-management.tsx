"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getOrganizationMemberManagement, changeOrganizationMemberRole, removeOrganizationMember, transferOrganizationOwnership, inviteOrganizationMember, manageOrganizationInvitation } from "@/actions/organization-members";
import { canChangeOrganizationRole, canRemoveOrganizationMember, canManageOrganizationInvitation, organizationCapabilities, organizationRoles, organizationRoleLabels } from "@/lib/organization-authorization";
import { canGrantOnboardingRole } from "@/lib/club-onboarding";
import { updateTaskMember } from "@/lib/workspace-api";
import { ClubAccessEditor } from "@/components/club-access-editor";
import { RosterCsvImporter } from "@/components/roster-csv-importer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Directory = Awaited<ReturnType<typeof getOrganizationMemberManagement>>;
type Member = Directory["members"][number];
const memberName = (member: Member) => member.user.studentProfile ? `${member.user.studentProfile.firstName} ${member.user.studentProfile.lastName}` : member.user.email;
const statusLabel = (status: string) => status === "LEFT" ? "Removed" : status.charAt(0) + status.slice(1).toLowerCase();

/** Extends the existing club Members route; all authorization comes from the shared layer. */
export function OrganizationMemberManagement({ clubId }: { clubId: string }) {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<Directory | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(""), [history, setHistory] = useState(false), [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const working = useRef(false), trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(""); setData(null);
    getOrganizationMemberManagement(clubId).then(value => { if (current) setData(value); })
      .catch(() => { if (current) setError("Could not load members. Your access may have changed."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [clubId, attempt]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const caps = organizationCapabilities(data?.actor);
  const active = data?.members.find(member => member.id === selectedId);
  async function reload() {
    await refreshUser();
    setData(await getOrganizationMemberManagement(clubId));
    setDirty(false);
  }
  async function run(action: () => Promise<unknown>, message: string) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await action(); setDirty(false); setNotice(message);
      try { await reload(); } catch { setData(null); setError("The change was saved, but the directory could not be refreshed. Reload members to check your current access."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Try again."); }
    finally { working.current = false; setBusy(false); }
  }
  const needle = query.trim().toLowerCase();
  const rows = data ? [
    ...data.members.map(member => ({ id: member.id, name: memberName(member), year: member.user.studentProfile?.gradYear, role: member.isOwner ? "OWNER" as const : member.accessRole, status: member.user.disabledAt ? "Account disabled" : statusLabel(member.status), detail: member.user.email, member, invitation: null })),
    ...data.invitations.filter(invitation => history || invitation.status === "PENDING").map(invitation => ({ id: invitation.id, name: invitation.invitedName || invitation.email, year: invitation.invitedYear, role: invitation.requestedRole, status: invitation.status === "PENDING" ? invitation.expiresAt <= new Date() ? "Expired" : "Invited" : statusLabel(invitation.status), detail: invitation.schoolIdentity?.normalizedIdentifier || invitation.email, member: null, invitation })),
  ].filter(row => `${row.name} ${row.detail} ${row.year || ""} ${organizationRoleLabels[row.role]} ${row.status}`.toLowerCase().includes(needle)) : [];
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const visiblePage = Math.min(page, pages - 1);
  return <div className="max-w-5xl space-y-6" data-saving={busy} data-unsaved={dirty} aria-busy={busy}>
    <p className="text-sm leading-7 text-muted-foreground">Manage memberships and invitations for this organization. Roles grant organization-specific capabilities; groups, cohorts, and custom access remain available in member details.</p>
    <p className="text-xs leading-5 text-muted-foreground">Email delivery is not configured yet. Resend queues a delivery request; share invitation links to invite members now.</p>
    {notice && <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">{notice}</p>}
    {error && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Reload members</Button></div>}
    {loading ? <p role="status">Loading members…</p> : data && <>
      {caps.canManageMembers && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Upload additional CSV</summary><div className="mt-4"><RosterCsvImporter clubId={clubId} onImported={reload} /></div></details>}
      <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Add member manually</summary>
        <p className="mt-3 text-sm text-muted-foreground">Create an invitation using the member’s school identity. They must accept before becoming a member. No account or email is created.</p>
        {!data.identifierTypes.length ? <p className="mt-3 text-sm">This school has no configured email identity mapping. Contact OutClass support.</p> : <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          const input = { clubId, invitedName: String(form.get("name")), invitedYear: String(form.get("year")) || null, identifierTypeId: String(form.get("identifierType")), identifier: String(form.get("identifier")), requestedRole: String(form.get("role")) };
          if (input.requestedRole === "OWNER" && !window.confirm("Invite an additional owner with full control of this organization?")) return;
          void run(() => inviteOrganizationMember(input), "Invitation is pending. No email has been sent.");
        }}><fieldset disabled={busy} className="contents">
          <label className="text-sm">Name<Input name="name" required maxLength={200} /></label>
          <label className="text-sm">Year (optional)<select name="year" className="mt-1 min-h-11 w-full rounded-md border bg-card px-3"><option value="">Not provided</option>{[2025,2026,2027,2028,2029,2030].map(year => <option key={year}>{year}</option>)}</select></label>
          <label className="text-sm">School identifier type<select name="identifierType" className="mt-1 min-h-11 w-full rounded-md border bg-card px-3">{data.identifierTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
          <label className="text-sm">School identifier<Input name="identifier" required maxLength={128} autoCapitalize="none" autoComplete="off" /></label>
          <label className="text-sm">Organization role<select name="role" defaultValue="MEMBER" className="mt-1 min-h-11 w-full rounded-md border bg-card px-3">{organizationRoles.filter(role => canGrantOnboardingRole(data.actor, role)).map(role => <option key={role} value={role}>{organizationRoleLabels[role]}</option>)}</select></label>
          <Button className="self-end min-h-11">Create member invitation</Button>
        </fieldset></form>}
      </details>
      <div className="flex flex-wrap items-center gap-3"><Input type="search" aria-label="Search members and invitations" placeholder="Search name, year, role, or status" className="max-w-md" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={history} onChange={event => { setHistory(event.target.checked); setPage(0); }} />Show invitation history</label><Button variant="ghost" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh members</Button></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Organization members and invitations</caption><thead className="bg-muted"><tr>{["Member", "Year", "Role", "Status", "Actions"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{rows.slice(visiblePage * 50, (visiblePage + 1) * 50).map(row => <tr key={row.id} className="border-t align-top">
        <td className="max-w-64 break-words p-3"><span className="font-medium">{row.name}</span><p className="mt-1 break-all text-xs text-muted-foreground">{row.detail}</p></td><td className="p-3">{row.year || "—"}</td><td className="p-3">{organizationRoleLabels[row.role]}</td><td className="p-3">{row.status}{row.invitation?.deliveries[0] && <p className="mt-1 text-xs text-muted-foreground">Email: {statusLabel(row.invitation.deliveries[0].status)}</p>}</td>
        <td className="p-3">{row.member ? <Button size="sm" variant="outline" disabled={busy} onClick={event => { trigger.current = event.currentTarget; setSelectedId(row.member!.id); setDirty(false); }}>Member details<span className="sr-only"> · {row.name}</span></Button> : row.invitation && row.invitation.status === "PENDING" && canManageOrganizationInvitation(data.actor, row.invitation) && <div className="flex flex-wrap gap-2">
          {row.status === "Invited" && <><a className="inline-flex min-h-9 items-center underline underline-offset-4" href={`/invitations/${row.id}`}>Invitation link</a><Button size="sm" variant="outline" disabled={busy || row.invitation.deliveries.some(delivery => ["QUEUED", "SENDING"].includes(delivery.status))} onClick={() => void run(() => manageOrganizationInvitation({ clubId, invitationId: row.id, action: "RESEND" }), "Resend queued. Email sending is not configured yet; share the invitation link for now.")}>Resend invitation</Button></>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Revoke the invitation for ${row.name}?`)) void run(() => manageOrganizationInvitation({ clubId, invitationId: row.id, action: "REVOKE" }), "Invitation revoked."); }}>Revoke invitation</Button>
        </div>}</td>
      </tr>)}</tbody></table></div>
      {!rows.length && <p role="status" className="text-sm text-muted-foreground">No members or invitations match.</p>}
      {pages > 1 && <nav aria-label="Members pagination" className="flex items-center gap-3"><Button variant="outline" disabled={visiblePage === 0 || busy} onClick={() => setPage(visiblePage - 1)}>Previous</Button><span className="text-sm">Page {visiblePage + 1} of {pages}</span><Button variant="outline" disabled={visiblePage === pages - 1 || busy} onClick={() => setPage(visiblePage + 1)}>Next</Button></nav>}
    </>}
    <Sheet open={!!active} onOpenChange={open => { if (!open && !busy && !document.querySelector('[data-saving="true"]')) { if (dirty && !window.confirm("Discard unsaved member changes?")) return; setSelectedId(null); setDirty(false); } }}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected) trigger.current.focus(); }}><SheetTitle>{active ? memberName(active) : "Member"}</SheetTitle><SheetDescription>{active?.user.email}</SheetDescription>{active && data && <div className="mt-6 space-y-6" onChangeCapture={event => { if ((event.target as HTMLElement).closest("form, fieldset")) setDirty(true); }}>
      <p className="text-sm">{organizationRoleLabels[active.isOwner ? "OWNER" : active.accessRole]} · {statusLabel(active.status)} · {active.user.studentProfile?.gradYear || "Year not provided"}</p>
      <p className="text-sm text-muted-foreground">{active.title || active.role.replaceAll("_", " ")} · Groups: {active.groups.join(", ") || "None"} · Cohort: {active.cohort || "Not set"}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {caps.canChangeRoles && active.status === "ACTIVE" && !active.user.disabledAt && <form className="space-y-3 border-t pt-4" key={`${active.id}:${active.accessRole}`} onSubmit={event => {
        event.preventDefault(); const role = String(new FormData(event.currentTarget).get("role"));
        if (!window.confirm(`Change ${memberName(active)} to ${organizationRoleLabels[role as Member["accessRole"]]}? This replaces their custom capabilities with the role’s defaults.`)) return;
        void run(() => changeOrganizationMemberRole({ clubId, memberId: active.id, role }), "Organization role updated.");
      }}><label className="block text-sm">Change role<select name="role" defaultValue={active.isOwner ? "OWNER" : active.accessRole} disabled={busy} className="mt-2 min-h-11 w-full rounded-md border bg-card px-3">{organizationRoles.filter(role => canChangeOrganizationRole(data.actor, active, role)).map(role => <option key={role} value={role}>{organizationRoleLabels[role]}</option>)}</select></label><Button disabled={busy || !organizationRoles.some(role => canChangeOrganizationRole(data.actor, active, role))}>Save role</Button></form>}
      {caps.canManageMembers && active.status === "ACTIVE" && <form className="space-y-3 border-t pt-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => updateTaskMember({ clubId, memberId: active.id, groups: String(form.get("groups")).split(",").map(value => value.trim()).filter(Boolean), cohort: String(form.get("cohort")).trim() || null }), "Groups and cohort updated."); }}><label className="block text-sm">Groups (comma-separated)<Input name="groups" defaultValue={active.groups.join(", ")} disabled={busy} /></label><label className="block text-sm">Cohort<Input name="cohort" defaultValue={active.cohort || ""} maxLength={80} disabled={busy} /></label><Button disabled={busy}>Save groups & cohort</Button></form>}
      {caps.canChangeRoles && active.status === "ACTIVE" && <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Advanced custom capabilities</summary><div className="mt-4"><ClubAccessEditor key={`${active.id}:${active.updatedAt}`} clubId={clubId} initial={data} selectedMemberId={active.id} onSaved={reload} /></div></details>}
      {caps.canTransferOwnership && active.status === "ACTIVE" && !active.user.disabledAt && !active.isOwner && active.id !== data.actor.id && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Transfer your ownership to ${memberName(active)}? They become Owner and you become Admin. Other owners remain unchanged.`)) void run(() => transferOrganizationOwnership({ clubId, memberId: active.id, confirm: true }), "Ownership transferred. You are now an Admin."); }}>Transfer my ownership</Button>}
      {canRemoveOrganizationMember(data.actor, active) && <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Removal revokes membership access and retains audit, interview, and evaluation history. The last active owner cannot be removed.</p><Button variant="destructive" disabled={busy} onClick={() => { if (window.confirm(`Remove ${memberName(active)} from this organization?`)) void run(() => removeOrganizationMember({ clubId, memberId: active.id }), "Membership removed; history retained."); }}>Remove member</Button></div>}
    </div>}</SheetContent></Sheet>
  </div>;
}
