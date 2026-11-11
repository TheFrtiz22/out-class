"use client";
import { userMessage } from "@/lib/user-message"
import { LoadingState } from "@/components/ui/loading-state"
import { getOrganizationMemberManagement } from "@/lib/workspace-read";
import { MemberGroupBuilder } from "@/components/member-group-builder";
import { DataTable, DataTableSecondary, type DataTableColumn } from "@/components/ui/data-table";
import { joinFacts } from "@/lib/join-facts";
import { SortControl } from "@/components/ui/sort-control";
import { useListSort } from "@/hooks/use-list-sort";
import { compareAcademicYears } from "@/lib/recruitment-profile";
import { InterviewerEligibilityControls } from "@/components/availability/interviewer-eligibility";

import { ActionWorkflow } from "@/components/product/action-workflow";
import { addClubMember as addClubMemberAction } from "@/actions/club-access";
import {InvitationScheduleComposer} from "@/components/invitation-schedules";
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
import { MoreHorizontal, Copy, Plus, ChevronDown } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { useRevalidate } from "@/hooks/use-revalidate";
import { useAuth } from "@/contexts/auth-context";
import {
  changeOrganizationMemberRole as changeOrganizationMemberRoleAction,
  removeOrganizationMember as removeOrganizationMemberAction,
  transferOrganizationOwnership as transferOrganizationOwnershipAction,
  inviteOrganizationMember as inviteOrganizationMemberAction,
  manageOrganizationInvitation as manageOrganizationInvitationAction,
  bulkOrganizationMembers as bulkOrganizationMembersAction,
  bulkOrganizationInvitations as bulkOrganizationInvitationsAction,
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
import { ClubExportLink } from "@/components/club-export-link";
import { onboardingFocus } from "@/lib/onboarding-presentation";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { NativeSelect } from "@/components/ui/native-select"
import { academicYear } from "@/lib/recruitment-profile"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { FilterPopover } from "@/components/ui/filter-popover"
import { SearchField } from "@/components/ui/search-field"
import { PillSelect } from "@/components/ui/pill-select"
import { Toggle } from "@/components/ui/toggle"
import { useConfirmOnce } from "@/components/ui/confirm-dialog"
import { unwrapped } from "@/lib/action-result"
const changeOrganizationMemberRole = unwrapped(changeOrganizationMemberRoleAction)
const removeOrganizationMember = unwrapped(removeOrganizationMemberAction)
const transferOrganizationOwnership = unwrapped(transferOrganizationOwnershipAction)
const inviteOrganizationMember = unwrapped(inviteOrganizationMemberAction)
const manageOrganizationInvitation = unwrapped(manageOrganizationInvitationAction)
const bulkOrganizationMembers = unwrapped(bulkOrganizationMembersAction)
const bulkOrganizationInvitations = unwrapped(bulkOrganizationInvitationsAction)
const addClubMember = unwrapped(addClubMemberAction)

type Directory = Awaited<ReturnType<typeof getOrganizationMemberManagement>>;
type Member = Directory["members"][number];
const memberName = (member: Member) =>
  member.user.studentProfile
    ? `${member.user.studentProfile.firstName} ${member.user.studentProfile.lastName}`
    : member.user.email;
const memberSortKeys = ["name", "year", "role", "status"] as const;
type MemberSort = (typeof memberSortKeys)[number];
const memberSortOptions: { key: MemberSort; label: string }[] = [{ key: "name", label: "Name" }, { key: "year", label: "Year" }, { key: "role", label: "Role" }, { key: "status", label: "Status" }];
/** Class year reads newest first; the rest alphabetically. */
const memberSortsDescending = (key: MemberSort) => key === "year";
const statusLabel = (status: string) =>
  status === "LEFT"
    ? "Removed"
    : status.charAt(0) + status.slice(1).toLowerCase();

/** Extends the existing club Members route; all authorization comes from the shared layer. */
export function OrganizationMemberManagement({ clubId, initialData = null, onData, validatedInitialData = false }: { clubId: string; validatedInitialData?: boolean; initialData?: Directory | null; onData?: (data: Directory | null) => void }) {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<Directory | null>(initialData);
  // One confirm at a time here: a second click while one is open does nothing.
  const confirm = useConfirmOnce();
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!initialData),
    [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(""),
    [history, setHistory] = useState(false),
    [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false), [inviteTab, setInviteTab] = useState("pending");
  const [roleFilter, setRoleFilter] = useState(""), [yearFilter, setYearFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false), [importOpen, setImportOpen] = useState(false), [groupsOpen, setGroupsOpen] = useState(false);
  // Headers and the toolbar Sort share one state, kept in the URL (?sort=&order=).
  const listSort = useListSort(memberSortKeys, "name", memberSortsDescending);
  const { key: sort, descending } = listSort;
  const [groupFilter, setGroupFilter] = useState("");
  const sortBy = (key: string) => { listSort.toggle(key as MemberSort); setPage(0); };
  const setSort = (key: MemberSort, descending: boolean) => { listSort.set(key, descending); setPage(0); };
  const [scheduledInviteId,setScheduledInviteId] = useState<string|null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]),
    [bulkRole, setBulkRole] = useState<Member["accessRole"]>("MEMBER"),
    [permissionsOpen, setPermissionsOpen] = useState(false),
    [bulkPermissions, setBulkPermissions] = useState<string[]>([]);
  const working = useRef(false),
    trigger = useRef<HTMLElement | null>(null);
  const firstRead = useRef(validatedInitialData && !!initialData);
  const retained = useRef(data), publish = useRef(onData);
  retained.current = data;
  publish.current = onData;
  useEffect(() => { publish.current?.(data); }, [data]);
  useEffect(() => {
    if (firstRead.current) { firstRead.current = false; return; }
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
  // No Refresh button: actions reload the directory; returning to the tab reloads it when nothing is in progress.
  useRevalidate(() => setAttempt((value) => value + 1), { enabled: !!data && !busy && !dirty && !selection.length, scopes: ["members"] });
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
          "The change was saved, but the directory could not be refreshed. Try again to check your current access.",
        );
      }
      return true;
    } catch (e) {
      if (optimistic) setData(previous);
      setError(userMessage(e, "Could not save. Try again."));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const needle = query.trim().toLowerCase();
  // Class year is a profile field: members' years follow the club setting (cleared by the server when hidden).
  // Invitations carry an admin-entered year, so that tab keeps the column.
  const showYear = invitesOpen || data?.profileFields?.academicYear !== false;
  const rows = data
    ? [
        ...data.members.map((member) => ({
          id: member.id,
          name: memberName(member),
          year: member.user.studentProfile?.academicYear,
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
            // Invitations record a graduation year; show it as the same class-year label members have.
            year: invitation.invitedYear && /^\d{4}$/.test(invitation.invitedYear) ? academicYear({ gradYear: Number(invitation.invitedYear) }) : invitation.invitedYear,
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
      ].filter(row => Boolean(row.invitation) === invitesOpen && (!groupFilter || row.member?.groups.includes(groupFilter)) && (!roleFilter || row.role === roleFilter) && (!yearFilter || row.year === yearFilter)).filter((row) =>
        `${row.name} ${row.detail} ${row.year || ""} ${organizationRoleLabels[row.role]} ${row.status} ${row.member?.groups.join(" ") || ""}`
          .toLowerCase()
          .includes(needle),
      ).sort((a, b) => {
        let compared = 0;
        if (sort === "year") {
          if (!a.year || !b.year) return a.year === b.year ? a.name.localeCompare(b.name) : !a.year ? 1 : -1;
          compared = compareAcademicYears(a.year, b.year);
        } else if (sort === "role") compared = organizationRoleLabels[a.role].localeCompare(organizationRoleLabels[b.role]);
        else if (sort === "status") compared = a.status.localeCompare(b.status);
        else compared = a.name.localeCompare(b.name);
        return (descending ? -compared : compared) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      })
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
  async function bulkMembers(action: "ROLE" | "PERMISSIONS" | "REMOVE") {
    if (!data || !selectedMembers.length) return;
    // Act on exactly what the dialog shows: the selection, role and permissions at click time.
    const targets = selectedMembers.map((m) => ({ id: m.id, updatedAt: m.updatedAt }));
    const role = bulkRole, permissions = bulkPermissions, base = data;
    const count = targets.length;
    const prompt =
      action === "REMOVE"
        ? { title: `Remove ${count} selected ${count === 1 ? "member" : "members"}?`, description: "Access is revoked; history is retained.", confirmLabel: "Remove members" }
        : action === "ROLE"
          ? { title: `Change ${count} ${count === 1 ? "member" : "members"} to ${organizationRoleLabels[role]}?`, description: "This replaces custom capabilities with role defaults.", confirmLabel: "Change role" }
          : { title: `Replace custom permissions for ${count} selected ${count === 1 ? "member" : "members"}?`, confirmLabel: "Replace permissions" };
    if (!(await confirm({ ...prompt, tone: "danger" }))) return;
    const ids = new Set(targets.map((t) => t.id));
    const optimistic =
      action === "REMOVE"
        ? undefined
        : {
            ...base,
            members: base.members.map((m) =>
              !ids.has(m.id)
                ? m
                : action === "ROLE"
                  ? {
                      ...m,
                      accessRole: role,
                      isOwner: role === "OWNER",
                      permissions: organizationRolePermissions[role],
                    }
                  : { ...m, permissions },
            ),
          };
    void run(
      () =>
        bulkOrganizationMembers({
          clubId,
          targets,
          action,
          ...(action === "ROLE"
            ? { role }
            : action === "PERMISSIONS"
              ? { permissions }
              : {}),
        }),
      `${count} memberships updated.`,
      optimistic,
      ids.has(base.actor.id),
    );
  }
  async function bulkInvites(action: "RESEND" | "REVOKE") {
    // Act on exactly the invitations counted in the dialog.
    const invitationIds = selectedInvites.map((i) => i.id);
    if (
      action === "REVOKE" &&
      !(await confirm({
        title: `Revoke ${invitationIds.length} selected ${invitationIds.length === 1 ? "invitation" : "invitations"}?`,
        confirmLabel: "Revoke invitations",
        tone: "danger",
      }))
    )
      return;
    void run(
      () =>
        bulkOrganizationInvitations({
          clubId,
          invitationIds,
          action,
        }),
      action === "RESEND"
        ? "Invitation emails queued. Delivery continues in the background."
        : "Invitations revoked.",
      undefined,
      false,
    );
  }
  const resetPaging = () => { setPage(0); setSelection([]) }
  const memberYears = data ? [...new Set([...data.members.map(m => m.user.studentProfile?.academicYear), ...data.invitations.map(i => i.invitedYear && /^\d{4}$/.test(i.invitedYear) ? academicYear({ gradYear: Number(i.invitedYear) }) : i.invitedYear)].filter((year): year is string => !!year))].sort(compareAcademicYears) : []
  const memberGroups = data ? [...new Set(data.members.flatMap(member => member.groups))].sort() : []
  const invitationDelivery = (invitation: NonNullable<(typeof rows)[number]["invitation"]>) => invitation.deliveries[0]
    ? invitation.deliveries[0].failureCode === "DELIVERY_UNCERTAIN" ? "Email delivery needs review" : `Email ${statusLabel(invitation.deliveries[0].status).toLowerCase()}`
    : "Email not requested";
  const invitationActions = (row: (typeof rows)[number]) => data && (row.invitation &&
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
                                <Copy size={16} />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Invitation actions for ${row.name}`}
                                    disabled={busy}
                                  >
                                    <MoreHorizontal size={20} />
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
                                  <DropdownMenuItem disabled={busy||row.status!=="Invited"||row.invitation.deliveries.some(d=>["QUEUED","SENDING"].includes(d.status))} onSelect={()=>setScheduledInviteId(row.id)}>Schedule invitation email</DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    disabled={busy}
                                    onSelect={async () => {
                                      if (
                                        await confirm({
                                          title: `Revoke the invitation for ${row.name}?`,
                                          confirmLabel: "Revoke invitation",
                                          tone: "danger",
                                        })
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
                          ));
  const directory = data && <div className="space-y-5">
            {/* One line of pill filters; it scrolls sideways on narrow screens instead of wrapping. */}
            <div className="oc-list-toolbar">
            <div className="oc-filter-bar min-w-0 flex-1" role="toolbar" aria-label="Member filters">
              <SearchField
                aria-label="Search members and invitations"
                placeholder={invitesOpen ? "Search invitations…" : "Search members…"}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetPaging();
                }}
                onClear={() => { setQuery(""); resetPaging() }}
              />
              <FilterPopover label="Filter" title="Member filters" align="start" count={[roleFilter, showYear && yearFilter, !invitesOpen && groupFilter].filter(Boolean).length}
                footer={<Button variant="ghost" size="sm" disabled={!roleFilter && !yearFilter && !groupFilter} onClick={() => { setRoleFilter(""); setYearFilter(""); setGroupFilter(""); resetPaging() }}>Clear filters</Button>}>
                <div className="oc-filter-field"><span className="oc-filter-field-label">Role</span>
                  <PillSelect label="Filter members by role" size="compact" allLabel="All roles" value={roleFilter} onChange={value => { setRoleFilter(value); resetPaging() }} options={organizationRoles.map(role => ({ value: role, label: organizationRoleLabels[role] }))} />
                </div>
                {showYear && <div className="oc-filter-field"><span className="oc-filter-field-label">Year</span>
                  <PillSelect label="Filter members by year" size="compact" allLabel="All years" value={yearFilter} onChange={value => { setYearFilter(value); resetPaging() }} options={memberYears.map(year => ({ value: year, label: year }))} />
                </div>}
                {!invitesOpen && caps.canManageMembers && <div className="oc-filter-field"><span className="oc-filter-field-label">Group</span>
                  <PillSelect label="Filter members by group" size="compact" allLabel="All groups" value={groupFilter} onChange={value => { setGroupFilter(value); resetPaging() }} options={memberGroups.map(group => ({ value: group, label: group }))} />
                </div>}
              </FilterPopover>
              {invitesOpen && <Toggle label="Show invitation history" checked={history} onCheckedChange={value => { setHistory(value); setPage(0) }} />}
            </div>
            <SortControl label="Sort members" options={memberSortOptions} value={sort} descending={descending} descendingByDefault={memberSortsDescending} onChange={setSort} />
            </div>
            {!invitesOpen && caps.canManageMembers && <div className="flex flex-wrap items-center gap-3"><ClubExportLink clubId={clubId} kind="roster" membership={data.actor} label="Export roster" /><ClubExportLink clubId={clubId} kind="attendance" membership={data.actor} label="Export attendance" /></div>}
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
                        <NativeSelect
                          aria-label="Bulk organization role"
                          value={bulkRole}
                          disabled={busy}
                          className="min-h-11"
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
                        </NativeSelect>
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
                          onClick={() => void bulkMembers("ROLE")}
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
                    {caps.canManageMembers && <ActionWorkflow title="Interviewers" description="Update the selected members for this club or a specific round." trigger="Interviewers"><InterviewerEligibilityControls clubId={clubId} selectedIds={selectedMembers.map(m => m.id)} individual onSaved={() => reload()} /></ActionWorkflow>}
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
                        onClick={() => void bulkMembers("REMOVE")}
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
                      onClick={() => void bulkInvites("RESEND")}
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
                      onClick={() => void bulkInvites("REVOKE")}
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
            {rows.length > 0 && <DataTable
              caption={invitesOpen ? "Club invitations" : "Club members"}
              rows={pageRows}
              rowKey={row => row.id}
              rowState={row => selection.includes(row.id) ? "selected" : undefined}
              disabled={busy}
              sort={{ key: sort, descending, toggle: sortBy }}
              isOpenable={row => !!row.member}
              openLabel={row => `Member details · ${row.name}`}
              onOpen={(row, origin) => { if (!row.member) return; trigger.current = origin; setSelectedId(row.member.id); setDirty(false) }}
              selection={{
                label: "Select",
                rowLabel: row => `Select ${row.name}`,
                isSelected: row => selection.includes(row.id),
                toggle: row => toggle(row.id, !selection.includes(row.id)),
                disabled: row => !selectable(row) || (selection.length >= 100 && !selection.includes(row.id)),
                header: <label className="oc-dt-check"><input
                  type="checkbox" className="oc-checkbox"
                  aria-label="Select all members and invitations on this page"
                  disabled={busy || !selectablePage.length}
                  checked={selectablePage.length > 0 && selectablePage.every((row) => selection.includes(row.id))}
                  ref={(node) => { if (node) node.indeterminate = selectablePage.some((row) => selection.includes(row.id)) && !selectablePage.every((row) => selection.includes(row.id)) }}
                  onChange={(e) => setSelection((ids) => e.target.checked ? [...new Set([...ids, ...selectablePage.map((row) => row.id)])].slice(0, 100) : ids.filter((id) => !selectablePage.some((row) => row.id === id)))}
                /></label>,
              }}
              columns={[
                { id: "name", header: "Member", sortKey: "name", primary: true, cell: row => <span className="oc-dt-name">{row.name}</span>, secondary: row => <DataTableSecondary from="lg" title={row.member?.groups.length ? `Groups: ${row.member.groups.join(", ")}` : undefined}>{joinFacts(row.detail, row.member?.groups.join(" · "))}</DataTableSecondary> },
                ...(showYear ? [{ id: "year", header: "Year", sortKey: "year", showFrom: "md" as const, cell: (row: (typeof rows)[number]) => row.year || "—" }] : []),
                { id: "role", header: "Role", sortKey: "role", cell: row => organizationRoleLabels[row.role] },
                { id: "status", header: "Status", sortKey: "status", cell: row => <>{row.status}{row.invitation && <span className="oc-dt-muted"> · {invitationDelivery(row.invitation)}</span>}</> },
                ...(invitesOpen ? [{ id: "actions", header: <span className="sr-only">Actions</span>, align: "end" as const, cell: (row: (typeof rows)[number]) => invitationActions(row) }] : []),
              ] satisfies DataTableColumn<(typeof rows)[number]>[]}
              card={{
                title: row => row.name,
                meta: row => joinFacts(row.year, organizationRoleLabels[row.role], row.invitation && invitationDelivery(row.invitation)),
                trailing: row => row.status === "Active" ? undefined : <span className="oc-dt-muted">{row.status}</span>,
                actions: invitesOpen ? row => invitationActions(row) : undefined,
              }}
            />}
            {!rows.length && (
              <p
                role="status"
                className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground"
              >
                {invitesOpen ? "No invitations match." : "No members match."}
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
</div>;
  return (
    <div
      className="oc-member-directory min-w-0 space-y-6"
      data-saving={busy}
      data-unsaved={dirty}
      aria-busy={busy}
    >
      <p className="text-sm text-muted-foreground">Manage your club’s members and access.</p>
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
            Try again
          </Button>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading member directory…" layout="table" rows={5} />
      ) : (
        data && (
          <>
            <div className="flex flex-wrap gap-2" aria-label="Member actions">
              {caps.canManageMembers && <div role="group" aria-label="Add members" className="inline-flex"><Button className="rounded-r-none" onClick={() => setAddOpen(true)}><Plus size={16} aria-hidden="true" />Add member</Button><DropdownMenu><DropdownMenuTrigger asChild><Button className="rounded-l-none border-l border-primary-foreground/30 px-2" aria-label="More ways to add members"><ChevronDown size={16} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" onSelect={() => setInvitesOpen(true)}>Invite members</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => setImportOpen(true)}>Import CSV</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => setGroupsOpen(true)}>Create groups</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>}
              {caps.canManageMembers && <ActionWorkflow showCloseAction={false} title="Add member" description="Add an existing OutClass account by UVA email. Use Invite members for someone who still needs to accept an invitation." open={addOpen} onOpenChange={setAddOpen}>{done => <form data-saving={busy} className="space-y-4" onSubmit={event => { event.preventDefault(); const email = String(new FormData(event.currentTarget).get("email")); void run(() => addClubMember(clubId, email), "Member added.").then(saved => { if (saved) done() }) }}><label className="block space-y-2 text-sm">UVA email<Input name="email" type="email" required disabled={busy} placeholder="name@virginia.edu" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={done}>Cancel</Button><Button disabled={busy} loading={busy}>Add member</Button></div></form>}</ActionWorkflow>}
              <ActionWorkflow title="Invite members" description="Create invitations, review pending access, and explicitly choose email delivery." trigger={caps.canManageMembers ? undefined : "Invite members"} presentation="sheet" open={invitesOpen} onOpenChange={open => { setInvitesOpen(open); setSelection([]); setPage(0); setQuery(""); setRoleFilter(""); setYearFilter("") }}>
                {invitesOpen && <div data-saving={busy} className="space-y-5">
                  <SegmentedControl label="Invitation workspace" value={inviteTab} onChange={async id => { if (dirty && !(await confirm({ title: "Discard invitation changes?", description: "Your unsaved invitation changes will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return; setDirty(false); setInviteTab(id) }} options={[{ value: "pending", label: "Pending invitations" }, { value: "new", label: "New invitation" }, { value: "delivery", label: "Delivery & schedules" }]} />
                  {notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  {inviteTab === "pending" && <>{directory}{scheduledInviteId && <InvitationScheduleComposer key={scheduledInviteId} clubId={clubId} invitationId={scheduledInviteId} />}</>}
                  {inviteTab === "new" && <div data-unsaved={dirty} onChangeCapture={() => setDirty(true)}>              <p className="mt-3 text-sm text-muted-foreground">
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
                  onSubmit={async (event) => {
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
                      !(await confirm({
                        title: "Invite an additional owner?",
                        description: "Owners have full control of this organization.",
                        confirmLabel: "Invite owner",
                      }))
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
                      <NativeSelect
                        name="year"
                        className="mt-1 min-h-11 w-full"
                      >
                        <option value="">Not provided</option>
                        {[2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                          <option key={year}>{year}</option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      School identifier type
                      <NativeSelect
                        name="identifierType"
                        className="mt-1 min-h-11 w-full"
                      >
                        {data.identifierTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </NativeSelect>
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
                      <NativeSelect
                        name="role"
                        defaultValue="MEMBER"
                        className="mt-1 min-h-11 w-full"
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
                      </NativeSelect>
                    </label>
                    <Button className="self-end min-h-11">
                      Create invitation
                    </Button>
                  </fieldset>
                </form>
              )}
</div>}
                  {inviteTab === "delivery" && <InvitationEmailControls clubId={clubId} onSent={reload} />}
                </div>}
              </ActionWorkflow>
              {caps.canManageMembers && <ActionWorkflow title="Import CSV" description="Upload, validate, and confirm a roster. Emails are sent only when explicitly requested." open={importOpen} onOpenChange={setImportOpen} presentation="sheet"><RosterCsvImporter clubId={clubId} onImported={reload} /></ActionWorkflow>}
              {caps.canManageMembers && <MemberGroupBuilder clubId={clubId} members={data.members} onSaved={reload} open={groupsOpen} onOpenChange={setGroupsOpen} />}
            </div>
            {!invitesOpen && directory}
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
                void bulkMembers("PERMISSIONS");
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
        onOpenChange={async (open) => {
          if (
            !open &&
            !busy &&
            !document.querySelector('[data-saving="true"]')
          ) {
            if (
              dirty &&
              !(await confirm({
                title: "Discard member changes?",
                description: "Your unsaved member changes will be lost.",
                confirmLabel: "Discard changes",
                cancelLabel: "Keep editing",
                tone: "danger",
              }))
            )
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
                if ((event.target as HTMLElement).closest("[data-eligibility-controls]")) return;
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
                · {statusLabel(active.status)}
                {data?.profileFields?.academicYear !== false && <> · {active.user.studentProfile?.academicYear || "Year not provided"}</>}
              </p>
              <p className="text-sm text-muted-foreground">
                {active.title || active.role.replaceAll("_", " ")} · Groups:{" "}
                {active.groups.join(", ") || "None"} · Cohort:{" "}
                {active.cohort || "Not set"}
              </p>
              {caps.canManageMembers && active.status === "ACTIVE" && !active.user.disabledAt && <InterviewerEligibilityControls key={`${clubId}:${active.id}`} clubId={clubId} selectedIds={[active.id]} refreshKey={String(active.updatedAt)} individual onSaved={() => reload()} />}
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
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const role = String(
                        new FormData(event.currentTarget).get("role"),
                      );
                      if (
                        !(await confirm({
                          title: `Change ${memberName(active)} to ${organizationRoleLabels[role as Member["accessRole"]]}?`,
                          description: "This replaces their custom capabilities with the role’s defaults.",
                          confirmLabel: "Change role",
                        }))
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
                      <NativeSelect
                        name="role"
                        defaultValue={
                          active.isOwner ? "OWNER" : active.accessRole
                        }
                        disabled={busy}
                        className="mt-2 min-h-11 w-full"
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
                      </NativeSelect>
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
                <ActionWorkflow title="Management permissions" description="Edit capabilities for this member. Owner and grant restrictions still apply." trigger="Manage permissions"> <ClubAccessEditor key={`${active.id}:${active.updatedAt}`} clubId={clubId} initial={data} selectedMemberId={active.id} onSaved={() => reload(active.id === data.actor.id)} /> </ActionWorkflow>
              )}
              {caps.canTransferOwnership &&
                active.status === "ACTIVE" &&
                !active.user.disabledAt &&
                !active.isOwner &&
                active.id !== data.actor.id && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Transfer your ownership to ${memberName(active)}?`,
                          description: "They become Owner and you become Admin. Other owners remain unchanged.",
                          confirmLabel: "Transfer ownership",
                          tone: "danger",
                        })
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
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Remove ${memberName(active)} from this organization?`,
                          confirmLabel: "Remove member",
                          tone: "danger",
                        })
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
