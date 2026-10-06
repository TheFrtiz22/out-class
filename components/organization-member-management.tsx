"use client";
import { getOrganizationMemberManagement } from "@/lib/workspace-read";

import { InvitationEmailControls } from "@/components/invitation-email-controls";
import {
  clubPermissions,
  permissionLabels,
  hasPermission,
} from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  changeOrganizationMemberRole,
  removeOrganizationMember,
  transferOrganizationOwnership,
  inviteOrganizationMember,
  manageOrganizationInvitation,
  bulkOrganizationMembers,
  bulkOrganizationInvitations,
} from "@/actions/organization-members";
import {
  canChangeOrganizationRole,
  canRemoveOrganizationMember,
  canManageOrganizationInvitation,
  organizationCapabilities,
  organizationRoles,
  organizationRoleLabels,
  organizationRolePermissions,
} from "@/lib/organization-authorization";
import { canGrantOnboardingRole } from "@/lib/club-onboarding";
import { updateTaskMember } from "@/lib/workspace-api";
import { ClubAccessEditor } from "@/components/club-access-editor";
import { RosterCsvImporter } from "@/components/roster-csv-importer";
import { Button } from "@/components/ui/button";
import {
  onboardingTable,
  onboardingFocus,
} from "@/lib/onboarding-presentation";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type Directory = Awaited<ReturnType<typeof getOrganizationMemberManagement>>;
type Member = Directory["members"][number];
const memberName = (member: Member) =>
  member.user.studentProfile
    ? `${member.user.studentProfile.firstName} ${member.user.studentProfile.lastName}`
    : member.user.email;
const statusLabel = (status: string) =>
  status === "LEFT"
    ? "Removed"
    : status.charAt(0) + status.slice(1).toLowerCase();

/** Extends the existing club Members route; all authorization comes from the shared layer. */
export function OrganizationMemberManagement({ clubId, initialData = null, onData }: { clubId: string; initialData?: Directory | null; onData?: (data: Directory | null) => void }) {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<Directory | null>(initialData);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!initialData),
    [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(""),
    [history, setHistory] = useState(false),
    [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]),
    [bulkRole, setBulkRole] = useState<Member["accessRole"]>("MEMBER"),
    [permissionsOpen, setPermissionsOpen] = useState(false),
    [bulkPermissions, setBulkPermissions] = useState<string[]>([]);
  const working = useRef(false),
    trigger = useRef<HTMLElement | null>(null);
  const retained = useRef(data), publish = useRef(onData);
  retained.current = data;
  publish.current = onData;
  useEffect(() => { publish.current?.(data); }, [data]);
  useEffect(() => {
    let current = true;
    setLoading(!retained.current);
    setError("");
    setSelection([]);
    getOrganizationMemberManagement(clubId)
      .then((value) => {
        if (current) setData(value);
      })
      .catch(() => {
        if (current) {
          setData(null);
          setError("Could not load members. Your access may have changed.");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [clubId, attempt]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const caps = organizationCapabilities(data?.actor);
  const active = data?.members.find((member) => member.id === selectedId);
  async function reload(refreshIdentity = false) {
    try {
    const [directory] = await Promise.all([
      getOrganizationMemberManagement(clubId),
      refreshIdentity ? refreshUser() : Promise.resolve(),
    ]);
    setData(directory);
    setDirty(false);
    } catch (error) { setData(null); throw error; }
  }
  async function run(
    action: () => Promise<unknown>,
    message: string,
    optimistic?: Directory,
    refreshIdentity = false,
  ) {
    if (working.current) return;
    const previous = data;
    if (optimistic) setData(optimistic);
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setDirty(false);
      setNotice(message);
      setSelection([]);
      setPermissionsOpen(false);
      try {
        await reload(refreshIdentity);
      } catch {
        setData(null);
        setError(
          "The change was saved, but the directory could not be refreshed. Reload members to check your current access.",
        );
      }
    } catch (e) {
      if (optimistic) setData(previous);
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const needle = query.trim().toLowerCase();
  const rows = data
    ? [
        ...data.members.map((member) => ({
          id: member.id,
          name: memberName(member),
          year: member.user.studentProfile?.gradYear,
          role: member.isOwner ? ("OWNER" as const) : member.accessRole,
          status: member.user.disabledAt
            ? "Account disabled"
            : statusLabel(member.status),
          detail: member.user.email,
          member,
          invitation: null,
        })),
        ...data.invitations
          .filter((invitation) => history || invitation.status === "PENDING")
          .map((invitation) => ({
            id: invitation.id,
            name: invitation.invitedName || invitation.email,
            year: invitation.invitedYear,
            role: invitation.requestedRole,
            status:
              invitation.status === "PENDING"
                ? invitation.expiresAt <= new Date()
                  ? "Expired"
                  : "Invited"
                : statusLabel(invitation.status),
            detail:
              invitation.schoolIdentity?.normalizedIdentifier ||
              invitation.email,
            member: null,
            invitation,
          })),
      ].filter((row) =>
        `${row.name} ${row.detail} ${row.year || ""} ${organizationRoleLabels[row.role]} ${row.status}`
          .toLowerCase()
          .includes(needle),
      )
    : [];
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const visiblePage = Math.min(page, pages - 1);
  const selectedRows = rows.filter((row) => selection.includes(row.id));
  const selectedMembers = selectedRows.flatMap((row) =>
    row.member ? [row.member] : [],
  );
  const selectedInvites = selectedRows.flatMap((row) =>
    row.invitation ? [row.invitation] : [],
  );
  const pageRows = rows.slice(visiblePage * 50, (visiblePage + 1) * 50);
  const selectable = (row: (typeof rows)[number]) =>
    row.member
      ? row.member.status === "ACTIVE" && !row.member.user.disabledAt
      : row.invitation?.status === "PENDING";
  const selectablePage = pageRows.filter(selectable);
  function toggle(id: string, checked: boolean) {
    setSelection((ids) =>
      checked
        ? [...new Set([...ids, id])].slice(0, 100)
        : ids.filter((x) => x !== id),
    );
  }
  function bulkMembers(action: "ROLE" | "PERMISSIONS" | "REMOVE") {
    if (!data || !selectedMembers.length) return;
    if (
      action === "REMOVE" &&
      !window.confirm(
        `Remove ${selectedMembers.length} selected members? Access is revoked; history is retained.`,
      )
    )
      return;
    if (
      action === "ROLE" &&
      !window.confirm(
        `Change ${selectedMembers.length} members to ${organizationRoleLabels[bulkRole]}? This replaces custom capabilities with role defaults.`,
      )
    )
      return;
    const ids = new Set(selectedMembers.map((m) => m.id));
    const optimistic =
      action === "REMOVE"
        ? undefined
        : {
            ...data,
            members: data.members.map((m) =>
              !ids.has(m.id)
                ? m
                : action === "ROLE"
                  ? {
                      ...m,
                      accessRole: bulkRole,
                      isOwner: bulkRole === "OWNER",
                      permissions: organizationRolePermissions[bulkRole],
                    }
                  : { ...m, permissions: bulkPermissions },
            ),
          };
    void run(
      () =>
        bulkOrganizationMembers({
          clubId,
          targets: selectedMembers.map((m) => ({
            id: m.id,
            updatedAt: m.updatedAt,
          })),
          action,
          ...(action === "ROLE"
            ? { role: bulkRole }
            : action === "PERMISSIONS"
              ? { permissions: bulkPermissions }
              : {}),
        }),
      `${selectedMembers.length} memberships updated.`,
      optimistic,
      ids.has(data.actor.id),
    );
  }
  function bulkInvites(action: "RESEND" | "REVOKE") {
    if (
      action === "REVOKE" &&
      !window.confirm(`Revoke ${selectedInvites.length} selected invitations?`)
    )
      return;
    void run(
      () =>
        bulkOrganizationInvitations({
          clubId,
          invitationIds: selectedInvites.map((i) => i.id),
          action,
        }),
      action === "RESEND"
        ? "Invitation emails queued. Delivery continues in the background."
        : "Invitations revoked.",
      undefined,
      false,
    );
  }
  return (
    <div
      className="oc-member-directory min-w-0 max-w-5xl space-y-6"
      data-saving={busy}
      data-unsaved={dirty}
      aria-busy={busy}
    >
      <p className="text-sm leading-7 text-muted-foreground">
        Manage memberships and invitations for this organization. Roles grant
        organization-specific capabilities; groups, cohorts, and custom access
        remain available in member details.
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        Invitation emails are sent only when requested. Resends have a 15-minute
        cooldown.
      </p>
      {notice && (
        <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reload members
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading members…</p>
      ) : (
        data && (
          <>
            <InvitationEmailControls clubId={clubId} onSent={reload} />
            {caps.canManageMembers && (
              <details className="rounded-xl border p-4">
                <summary
                  className={`min-h-11 cursor-pointer py-2 font-medium ${onboardingFocus}`}
                >
                  Upload additional CSV
                </summary>
                <div className="mt-4">
                  <RosterCsvImporter clubId={clubId} onImported={reload} />
                </div>
              </details>
            )}
            <details className="rounded-xl border p-4">
              <summary
                className={`min-h-11 cursor-pointer py-2 font-medium ${onboardingFocus}`}
              >
                Add member manually
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">
                Create an invitation using the member’s school identity. They
                must accept before becoming a member. No account or email is
                created.
              </p>
              {!data.identifierTypes.length ? (
                <p className="mt-3 text-sm">
                  This school has no configured email identity mapping. Contact
                  OutClass support.
                </p>
              ) : (
                <form
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const input = {
                      clubId,
                      invitedName: String(form.get("name")),
                      invitedYear: String(form.get("year")) || null,
                      identifierTypeId: String(form.get("identifierType")),
                      identifier: String(form.get("identifier")),
                      requestedRole: String(form.get("role")),
                    };
                    if (
                      input.requestedRole === "OWNER" &&
                      !window.confirm(
                        "Invite an additional owner with full control of this organization?",
                      )
                    )
                      return;
                    void run(
                      () => inviteOrganizationMember(input),
                      "Invitation is pending. No email has been sent.",
                    );
                  }}
                >
                  <fieldset disabled={busy} className="contents">
                    <label className="space-y-2 text-sm font-medium">
                      Name
                      <Input name="name" required maxLength={200} />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Year (optional)
                      <select
                        name="year"
                        className="mt-1 min-h-11 w-full rounded-md border border-input bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Not provided</option>
                        {[2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                          <option key={year}>{year}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      School identifier type
                      <select
                        name="identifierType"
                        className="mt-1 min-h-11 w-full rounded-md border border-input bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {data.identifierTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      School identifier
                      <Input
                        name="identifier"
                        required
                        maxLength={128}
                        autoCapitalize="none"
                        autoComplete="off"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Organization role
                      <select
                        name="role"
                        defaultValue="MEMBER"
                        className="mt-1 min-h-11 w-full rounded-md border border-input bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {organizationRoles
                          .filter((role) =>
                            canGrantOnboardingRole(data.actor, role),
                          )
                          .map((role) => (
                            <option key={role} value={role}>
                              {organizationRoleLabels[role]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button className="self-end min-h-11">
                      Create member invitation
                    </Button>
                  </fieldset>
                </form>
              )}
            </details>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                aria-label="Search members and invitations"
                placeholder="Search name, year, role, or status"
                className="max-w-md"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={history}
                  onChange={(event) => {
                    setHistory(event.target.checked);
                    setPage(0);
                  }}
                />
                Show invitation history
              </label>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Refresh members
              </Button>
            </div>
            {selection.length > 0 && (
              <div
                role="toolbar"
                aria-label="Bulk member actions"
                className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3"
              >
                <span className="text-sm font-medium">
                  {selection.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setSelection([])}
                >
                  Clear selection
                </Button>
                {selectedMembers.length > 0 && (
                  <>
                    {caps.canChangeRoles && (
                      <>
                        <select
                          aria-label="Bulk organization role"
                          value={bulkRole}
                          disabled={busy}
                          className="min-h-11 rounded-md border bg-background px-3 text-sm"
                          onChange={(e) =>
                            setBulkRole(e.target.value as Member["accessRole"])
                          }
                        >
                          {organizationRoles
                            .filter((role) =>
                              selectedMembers.every((m) =>
                                canChangeOrganizationRole(data.actor, m, role),
                              ),
                            )
                            .map((role) => (
                              <option value={role} key={role}>
                                {organizationRoleLabels[role]}
                              </option>
                            ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            busy ||
                            !selectedMembers.every((m) =>
                              canChangeOrganizationRole(
                                data.actor,
                                m,
                                bulkRole,
                              ),
                            )
                          }
                          onClick={() => bulkMembers("ROLE")}
                        >
                          Change role
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            busy || selectedMembers.some((m) => m.isOwner)
                          }
                          onClick={() => {
                            setBulkPermissions([]);
                            setPermissionsOpen(true);
                          }}
                        >
                          Modify permissions
                        </Button>
                      </>
                    )}
                    {caps.canManageMembers && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busy ||
                          !selectedMembers.every((m) =>
                            canRemoveOrganizationMember(data.actor, m),
                          )
                        }
                        onClick={() => bulkMembers("REMOVE")}
                      >
                        Remove members
                      </Button>
                    )}
                  </>
                )}
                {selectedInvites.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy ||
                        !selectedInvites.every(
                          (i) =>
                            i.expiresAt > new Date() &&
                            canManageOrganizationInvitation(data.actor, i),
                        )
                      }
                      onClick={() => bulkInvites("RESEND")}
                    >
                      Resend invitations
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy ||
                        !selectedInvites.every((i) =>
                          canManageOrganizationInvitation(data.actor, i),
                        )
                      }
                      onClick={() => bulkInvites("REVOKE")}
                    >
                      Revoke invitations
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  Select up to 100. Actions apply to selected members or
                  invitations.
                </span>
              </div>
            )}
            <div className="min-w-0 overflow-x-auto rounded-md border">
              <table className={onboardingTable.table}>
                <caption className="sr-only">
                  Organization members and invitations
                </caption>
                <thead className={onboardingTable.head}>
                  <tr>
                    <th className="p-3" scope="col">
                      <input
                        type="checkbox"
                        aria-label="Select all members and invitations on this page"
                        disabled={busy || !selectablePage.length}
                        checked={
                          selectablePage.length > 0 &&
                          selectablePage.every((row) =>
                            selection.includes(row.id),
                          )
                        }
                        ref={(node) => {
                          if (node)
                            node.indeterminate =
                              selectablePage.some((row) =>
                                selection.includes(row.id),
                              ) &&
                              !selectablePage.every((row) =>
                                selection.includes(row.id),
                              );
                        }}
                        onChange={(e) =>
                          setSelection((ids) =>
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...ids,
                                    ...selectablePage.map((row) => row.id),
                                  ]),
                                ].slice(0, 100)
                              : ids.filter(
                                  (id) =>
                                    !selectablePage.some(
                                      (row) => row.id === id,
                                    ),
                                ),
                          )
                        }
                      />
                    </th>
                    {["Member", "Year", "Role", "Status", "Actions"].map(
                      (label) => (
                        <th key={label} scope="col" className="p-3">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className={onboardingTable.body}>
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className={onboardingTable.row}
                      data-selected={selection.includes(row.id)}
                    >
                      <td data-label="Select" className={onboardingTable.cell}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selection.includes(row.id)}
                          disabled={
                            busy ||
                            !selectable(row) ||
                            (selection.length >= 100 &&
                              !selection.includes(row.id))
                          }
                          onChange={(e) => toggle(row.id, e.target.checked)}
                        />
                      </td>
                      <td
                        data-label="Member"
                        className={`${onboardingTable.cell} ${onboardingTable.wideCell}`}
                      >
                        {row.member ? (
                          <button
                            type="button"
                            className="text-left font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                            aria-label={`Member details · ${row.name}`}
                            disabled={busy}
                            onClick={(event) => {
                              trigger.current = event.currentTarget;
                              setSelectedId(row.member!.id);
                              setDirty(false);
                            }}
                          >
                            {row.name}
                          </button>
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {row.detail}
                        </p>
                      </td>
                      <td data-label="Year" className={onboardingTable.cell}>
                        {row.year || "—"}
                      </td>
                      <td data-label="Role" className={onboardingTable.cell}>
                        {organizationRoleLabels[row.role]}
                      </td>
                      <td
                        data-label="Status"
                        className={`${onboardingTable.cell} ${onboardingTable.wideCell}`}
                      >
                        {row.status}
                        {row.invitation && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.invitation.deliveries[0]
                              ? row.invitation.deliveries[0].failureCode ===
                                "DELIVERY_UNCERTAIN"
                                ? "Email delivery needs review"
                                : `Email ${statusLabel(row.invitation.deliveries[0].status).toLowerCase()}`
                              : "Email not requested"}
                          </p>
                        )}
                      </td>
                      <td
                        data-label="Actions"
                        className={`${onboardingTable.cell} ${onboardingTable.wideCell}`}
                      >
                        {row.invitation &&
                          row.invitation.status === "PENDING" &&
                          canManageOrganizationInvitation(
                            data.actor,
                            row.invitation,
                          ) && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Copy invitation link for ${row.name}`}
                                disabled={busy}
                                onClick={() =>
                                  void navigator.clipboard
                                    .writeText(
                                      `${window.location.origin}/invitations/${row.id}`,
                                    )
                                    .then(() =>
                                      setNotice("Invitation link copied."),
                                    )
                                    .catch(() =>
                                      setError(
                                        "Could not copy the invitation link.",
                                      ),
                                    )
                                }
                              >
                                <Copy size={15} />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Invitation actions for ${row.name}`}
                                    disabled={busy}
                                  >
                                    <MoreHorizontal size={18} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    disabled={
                                      busy ||
                                      row.status !== "Invited" ||
                                      row.invitation.deliveries.some((d) =>
                                        ["QUEUED", "SENDING"].includes(
                                          d.status,
                                        ),
                                      )
                                    }
                                    onSelect={() =>
                                      void run(
                                        () =>
                                          manageOrganizationInvitation({
                                            clubId,
                                            invitationId: row.id,
                                            action: "RESEND",
                                          }),
                                        "Invitation email queued. Delivery continues in the background.",
                                        undefined,
                                        false,
                                      )
                                    }
                                  >
                                    Resend invitation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    disabled={busy}
                                    onSelect={() => {
                                      if (
                                        window.confirm(
                                          `Revoke the invitation for ${row.name}?`,
                                        )
                                      )
                                        void run(
                                          () =>
                                            manageOrganizationInvitation({
                                              clubId,
                                              invitationId: row.id,
                                              action: "REVOKE",
                                            }),
                                          "Invitation revoked.",
                                          undefined,
                                          false,
                                        );
                                    }}
                                  >
                                    Revoke invitation
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p
                role="status"
                className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground"
              >
                No members or invitations match.
              </p>
            )}
            {pages > 1 && (
              <nav
                aria-label="Members pagination"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <Button
                  variant="outline"
                  disabled={visiblePage === 0 || busy}
                  onClick={() => setPage(visiblePage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {visiblePage + 1} of {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={visiblePage === pages - 1 || busy}
                  onClick={() => setPage(visiblePage + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )
      )}
      <Sheet
        open={permissionsOpen}
        onOpenChange={(open) => {
          if (!busy) setPermissionsOpen(open);
        }}
      >
        <SheetContent className="oc-workspace-drawer overflow-y-auto">
          <SheetTitle>Bulk permissions</SheetTitle>
          <SheetDescription>
            Replace the selected members’ capabilities. Roles are labels; saved
            capabilities enforce access. Owners always have full control.
          </SheetDescription>
          <fieldset disabled={busy} className="mt-6 space-y-3">
            {clubPermissions
              .filter((p) => hasPermission(data?.actor, p))
              .map((p) => (
                <label
                  className="flex min-h-11 items-center gap-3 text-sm"
                  key={p}
                >
                  <input
                    type="checkbox"
                    checked={bulkPermissions.includes(p)}
                    onChange={(e) =>
                      setBulkPermissions((items) =>
                        e.target.checked
                          ? [...items, p]
                          : items.filter((x) => x !== p),
                      )
                    }
                  />
                  {permissionLabels[p]}
                </label>
              ))}
            <Button
              disabled={busy || !selectedMembers.length}
              onClick={() => {
                if (
                  window.confirm(
                    `Replace custom permissions for ${selectedMembers.length} selected members?`,
                  )
                )
                  bulkMembers("PERMISSIONS");
              }}
            >
              Save permissions
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!active}
        onOpenChange={(open) => {
          if (
            !open &&
            !busy &&
            !document.querySelector('[data-saving="true"]')
          ) {
            if (dirty && !window.confirm("Discard unsaved member changes?"))
              return;
            setSelectedId(null);
            setDirty(false);
          }
        }}
      >
        <SheetContent
          className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
          }}
        >
          <SheetTitle className="oc-modal-title break-words">
            {active ? memberName(active) : "Member"}
          </SheetTitle>
          <SheetDescription className="break-all">
            {active?.user.email}
          </SheetDescription>
          {active && data && (
            <div
              className="mt-6 space-y-6"
              onChangeCapture={(event) => {
                if ((event.target as HTMLElement).closest("form, fieldset"))
                  setDirty(true);
              }}
            >
              <p className="text-xs text-muted-foreground">
                Joined {new Date(active.joinedAt).toLocaleDateString()} · Last
                updated {new Date(active.updatedAt).toLocaleDateString()}
              </p>
              <p className="text-sm">
                {
                  organizationRoleLabels[
                    active.isOwner ? "OWNER" : active.accessRole
                  ]
                }{" "}
                · {statusLabel(active.status)} ·{" "}
                {active.user.studentProfile?.gradYear || "Year not provided"}
              </p>
              <p className="text-sm text-muted-foreground">
                {active.title || active.role.replaceAll("_", " ")} · Groups:{" "}
                {active.groups.join(", ") || "None"} · Cohort:{" "}
                {active.cohort || "Not set"}
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {caps.canChangeRoles &&
                active.status === "ACTIVE" &&
                !active.user.disabledAt && (
                  <form
                    className="space-y-3 border-t pt-4"
                    key={`${active.id}:${active.accessRole}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const role = String(
                        new FormData(event.currentTarget).get("role"),
                      );
                      if (
                        !window.confirm(
                          `Change ${memberName(active)} to ${organizationRoleLabels[role as Member["accessRole"]]}? This replaces their custom capabilities with the role’s defaults.`,
                        )
                      )
                        return;
                      void run(
                        () =>
                          changeOrganizationMemberRole({
                            clubId,
                            memberId: active.id,
                            role,
                          }),
                        "Organization role updated.",
                        active.id !== data.actor.id && !active.isOwner && role !== "OWNER" ? {
                          ...data,
                          members: data.members.map(member => member.id === active.id ? {
                            ...member,
                            accessRole: role as Member["accessRole"],
                            permissions: organizationRolePermissions[role as Member["accessRole"]],
                          } : member),
                        } : undefined,
                        active.id === data.actor.id,
                      );
                    }}
                  >
                    <label className="block text-sm">
                      Change role
                      <select
                        name="role"
                        defaultValue={
                          active.isOwner ? "OWNER" : active.accessRole
                        }
                        disabled={busy}
                        className="mt-2 min-h-11 w-full rounded-md border border-input bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {organizationRoles
                          .filter((role) =>
                            canChangeOrganizationRole(data.actor, active, role),
                          )
                          .map((role) => (
                            <option key={role} value={role}>
                              {organizationRoleLabels[role]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button
                      disabled={
                        busy ||
                        !organizationRoles.some((role) =>
                          canChangeOrganizationRole(data.actor, active, role),
                        )
                      }
                    >
                      Save role
                    </Button>
                  </form>
                )}
              {caps.canManageMembers && active.status === "ACTIVE" && (
                <form
                  className="space-y-3 border-t pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void run(
                      () =>
                        updateTaskMember({
                          clubId,
                          memberId: active.id,
                          groups: String(form.get("groups"))
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                          cohort: String(form.get("cohort")).trim() || null,
                        }),
                      "Groups and cohort updated.",
                    );
                  }}
                >
                  <label className="block text-sm">
                    Groups (comma-separated)
                    <Input
                      name="groups"
                      defaultValue={active.groups.join(", ")}
                      disabled={busy}
                    />
                  </label>
                  <label className="block text-sm">
                    Cohort
                    <Input
                      name="cohort"
                      defaultValue={active.cohort || ""}
                      maxLength={80}
                      disabled={busy}
                    />
                  </label>
                  <Button disabled={busy}>Save groups & cohort</Button>
                </form>
              )}
              {caps.canChangeRoles && active.status === "ACTIVE" && (
                <details className="border-t pt-4">
                  <summary
                    className={`min-h-11 cursor-pointer py-2 text-sm font-medium ${onboardingFocus}`}
                  >
                    Advanced custom capabilities
                  </summary>
                  <div className="mt-4">
                    <ClubAccessEditor
                      key={`${active.id}:${active.updatedAt}`}
                      clubId={clubId}
                      initial={data}
                      selectedMemberId={active.id}
                      onSaved={() => reload(active.id === data.actor.id)}
                    />
                  </div>
                </details>
              )}
              {caps.canTransferOwnership &&
                active.status === "ACTIVE" &&
                !active.user.disabledAt &&
                !active.isOwner &&
                active.id !== data.actor.id && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Transfer your ownership to ${memberName(active)}? They become Owner and you become Admin. Other owners remain unchanged.`,
                        )
                      )
                        void run(
                          () =>
                            transferOrganizationOwnership({
                              clubId,
                              memberId: active.id,
                              confirm: true,
                            }),
                          "Ownership transferred. You are now an Admin.",
                          undefined,
                          true,
                        );
                    }}
                  >
                    Transfer my ownership
                  </Button>
                )}
              {canRemoveOrganizationMember(data.actor, active) && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Removal revokes membership access and retains audit,
                    interview, and evaluation history. The last active owner
                    cannot be removed.
                  </p>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${memberName(active)} from this organization?`,
                        )
                      )
                        void run(
                          () =>
                            removeOrganizationMember({
                              clubId,
                              memberId: active.id,
                            }),
                          "Membership removed; history retained.",
                          undefined,
                          active.id === data.actor.id,
                        );
                    }}
                  >
                    Remove member
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
