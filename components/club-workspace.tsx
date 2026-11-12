"use client"
import { PillSelect } from "@/components/ui/pill-select"
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ClubCalendar } from "@/components/events/club-meetings-workspace";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header"
import { ClubOverviewHeader } from "@/components/product/welcome-header"
import { Card } from "@/components/ui/card"
import { DashboardHero } from "@/components/product/dashboard/dashboard"
import { useRouter, useSearchParams } from "next/navigation";
import { RecruitingHero, RecruitingOverview } from "@/components/recruiting-overview";
import { ManagerOverview } from "@/components/manager-overview";
import { ClubHomeActions } from "@/components/club-home/club-home-actions";
import { ShellState } from "@/components/shell/shell-state";
import { useShellBindings } from "@/components/shell/workspace-shell-context";
import { canLeaveWorkspace, managerNavigation, mobileDestinations } from "@/lib/product-navigation";
const ScreeningDashboardView = dynamic(() => import("@/components/views/screening-dashboard-view").then(m => m.ScreeningDashboardView), { loading: () => <WorkspaceLoading label="Loading recruiting rules…" layout="form" rows={3} /> });
import { HomeAnnouncements } from "@/components/club-home/home-announcements";
import type { ViewId } from "@/lib/views";
import { useEffect, useRef, useState } from "react";
import { useRevalidate } from "@/hooks/use-revalidate";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { clubInterviewHref, legacyInterviewRoomHref } from "@/lib/interview-entry";
import { applicantInterviewHref, legacyApplicantInterviewHref } from "@/lib/applicant-interview-navigation";
import { interviewCapabilities } from "@/lib/interview-access";
import { hasPermission, hasWorkspace } from "@/lib/permissions";
import {
  clubWorkspaceHref,
  recruitmentTools,
} from "@/lib/club-workspace";
import {
  getClubWorkspaceOverview,
  getWorkspaceRounds,
} from "@/lib/workspace-api";
const ClubMembers = dynamic(() => import("@/components/club-members").then(m => m.ClubMembers), { loading: () => <WorkspaceLoading label="Loading club members…" layout="table" rows={3} /> });
import { ClubSettingsWorkspace } from "@/components/club-settings-workspace";
const ClubTasks = dynamic(() => import("@/components/club-tasks").then(m => m.ClubTasks), { loading: () => <WorkspaceLoading label="Loading club tasks…" layout="rows" rows={3} /> });
import { MeetingList } from "@/components/meeting-workspace";
const LiveLeaderWorkspace = dynamic(() => import("@/components/views/leader-dashboard/live-leader-workspace").then(m => m.LiveLeaderWorkspace), { loading: () => <WorkspaceLoading label="Preparing your applicant pipeline…" layout="applicants" rows={3} /> });
const InterviewManagementTabs = dynamic(() => import("@/components/interview-management-tabs").then(m => m.InterviewManagementTabs), { loading: () => <WorkspaceLoading label="Loading interview scheduling…" layout="calendar" rows={3} /> });
const ApplicantInterviewReviews = dynamic(() => import("@/components/applicant-interview-reviews").then(m => m.ApplicantInterviewReviews), { loading: () => <WorkspaceLoading label="Loading submitted reviews…" layout="rows" rows={3} /> });
import { legacyDecisionTab } from "@/lib/voting-navigation";
import { canonicalClubWorkspaceHref } from "@/lib/workspace-routes";
import { decisionFilter } from "@/lib/application-decisions";
import { TERMS } from "@/lib/copy/terms";
import { DecidePage } from "@/components/live-voting/decide-page";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RECRUITING_SETTINGS_PARAM, canOpenRecruitingSettings, recruitingSettingsSection, recruitingSettingsSections, withRecruitingSettings, type RecruitingSettingsSection } from "@/lib/recruiting-settings";
import { handleClubLink, navigateWithinClub } from "@/lib/workspace-navigation";
import { DashboardLoading } from "@/components/product/dashboard-presentation";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { SelectedClubWorkspace } from "@/components/selected-club-workspace";
import { clubWorkspaceEntryHref, clubWorkspacePreferenceKey, readClubWorkspacePreference, saveClubWorkspacePreference } from "@/lib/club-workspace-preference";
import { studentPath } from "@/lib/navigation"
import { RecruitmentFocus } from "@/components/recruitment-focus"
import { SectionTabs } from "@/components/ui/section-tabs";
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>;
const OVERVIEW_EVENTS = ["outclass:tasks-changed", "outclass:panels-changed", "outclass:interview-rounds-changed", "outclass:staffing-changed", "outclass:decision-schedules"];
const OVERVIEW_SCOPES = ["overview", "tasks", "meetings", "recruiting"];

export function ClubWorkspace({
  clubId,
}: {
  clubId: string;
  section: string;
  taskView?: string;
  tool?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const confirm = useConfirm();
  // Old section/tool/tab values (bookmarks, notifications, email) move to their current home.
  const canonical = canonicalClubWorkspaceHref(clubId, params);
  useEffect(() => { if (canonical && !navigateWithinClub(canonical, true)) router.replace(canonical); }, [canonical, router]);
  const oldDecisionTab = params.get("section") === "recruitment" && !!legacyDecisionTab(params.get("tool"));
  const section = params.get("section") ?? "overview";
  const taskView = params.get("taskView") ?? undefined;
  const tool = oldDecisionTab ? "decisions" : params.get("tool") ?? undefined;
  const moved = legacyApplicantInterviewHref(clubId, params.toString());
  useEffect(() => { if (moved && !navigateWithinClub(moved, true)) router.replace(moved); }, [moved, router]);
  // The interview room has its own route; old in-workspace room URLs move there.
  const legacyRoom = legacyInterviewRoomHref(clubId, params.toString());
  useEffect(() => { if (legacyRoom) router.replace(legacyRoom); }, [legacyRoom, router]);
  function openInterviewRoom() { router.push(clubInterviewHref(clubId, params.toString())); }
  const needsOverview = section === "overview" || section === "recruitment" && tool === "overview";
  // Recruiting settings drawer: URL-driven (`recruitingSettings=anonymous|rules`) on Applicants and Settings.
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const settingsSection = recruitingSettingsSection(params.get(RECRUITING_SETTINGS_PARAM));
  const [privacyRevision, setPrivacyRevision] = useState(0);
  // Opened by a link elsewhere (club Settings, an old Auto-Reject link): return focus to whatever opened it.
  const settingsWasOpen = useRef(false), settingsExplicitTrigger = useRef(false);
  useEffect(() => {
    if (settingsSection && !settingsWasOpen.current && !settingsExplicitTrigger.current) settingsTrigger.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    if (settingsSection) settingsExplicitTrigger.current = false;
    settingsWasOpen.current = !!settingsSection;
  }, [settingsSection]);
  const { user, loading, activeClubId, selectClub } = useAuth(),
    demo = useDemoMode();
  const membership = user?.memberships.find((m) => m.clubId === clubId);
  const manager = !!membership && hasWorkspace(membership);
  const preferenceKey = user ? clubWorkspacePreferenceKey(user.id, clubId, demo.isDemoEnabled ? "demo" : user.impersonating ? "preview" : "live") : "";
  const suspended = !demo.isDemoEnabled && !!membership?.club.suspendedAt;
  // Resolve only general entries. Explicit page URLs always retain their destination.
  const resolvingEntry = params.size === 0 && (!demo.ready || loading || manager);
  useEffect(() => {
    if (!resolvingEntry || !demo.ready || loading || !membership || !manager || suspended) return;
    const href = clubWorkspaceEntryHref(clubId, membership, readClubWorkspacePreference(preferenceKey));
    if (!navigateWithinClub(href, true)) router.replace(href);
  }, [resolvingEntry, demo.ready, loading, membership, manager, suspended, clubId, preferenceKey, router]);
  const authorizationKey = membership ? `${membership.id}:${membership.status}:${membership.accessRole}:${membership.isOwner}:${membership.permissions.join(",")}:${membership.interviewOffices?.join(",") ?? ""}:${membership.club.suspendedAt ?? ""}` : "";
  const membershipKey = `${authorizationKey}:${membership?.club.pipelineVersion}:${membership?.club.applicationVersion}`;
  const canLoadWorkspace = !!membership && !suspended && !resolvingEntry;
  // Resource state belongs to this mounted workspace, never a module/global cache.
  // Account, grant or privacy changes immediately hide prior resources.
  const authorizationScope = `${demo.isDemoEnabled ? "demo" : "live"}:${user?.id}:${clubId}:${authorizationKey}`;
  const scope = `${authorizationScope}:${membershipKey}:${privacyRevision}`;
  const owner = useRef(scope); owner.current = scope;
  // Each dashboard reads only what it shows: Club home the club view, the Recruiting Overview the recruiting view.
  // Both stay cached for this mounted workspace, so switching back shows the last read while it refreshes.
  const overviewView = section === "overview" ? "club" : "recruiting";
  const [cache, setData] = useState<Record<string, { scope: string; value: Overview }>>({}),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [overviewPending, setOverviewPending] = useState(false);
  // Legacy recruitment components share a selected club. Synchronize before mounting them.
  const needsSelection =
    !!membership &&
    hasWorkspace(membership) &&
    (activeClubId !== clubId ||
      (demo.isDemoEnabled && demo.state?.perspective.role !== "leader"));
  useEffect(() => {
    if (needsSelection) selectClub(clubId);
  }, [clubId, needsSelection]);
  useEffect(() => {
    if (!needsOverview || !demo.ready || loading || !canLoadWorkspace || needsSelection) return;
    let current = true;
    setError("");
    setOverviewPending(true);
    getClubWorkspaceOverview(clubId, overviewView)
      .then((value) => {
        if (current && owner.current === scope) setData(previous => ({ ...previous, [overviewView]: { scope, value } }));
      })
      .catch(() => {
        if (current) {
          setData(previous => { const next = { ...previous }; delete next[overviewView]; return next });
          setError(
            "Could not load this workspace. Your membership may have changed. Try again.",
          );
        }
      }).finally(() => { if (current) setOverviewPending(false) });
    return () => {
      current = false;
    };
  }, [
    clubId,
    retry,
    loading,
    demo.ready,
    needsSelection,
    canLoadWorkspace,
    membershipKey,
    needsOverview,
    scope,
    overviewView,
  ]);
  const data = cache[overviewView];
  const current = data?.scope === scope && data.value.club.id === clubId ? data.value : null;
  // Overview has no Refresh button: it reloads after mutations elsewhere and when the person returns.
  useRevalidate(() => setRetry(n => n + 1), { enabled: needsOverview && !!current, events: OVERVIEW_EVENTS, scopes: OVERVIEW_SCOPES });
  const mode = section === "recruitment" ? "recruiting" : "club";
  const active = mode === "recruiting" ? tool || "applicants" : section;
  const nav = manager ? managerNavigation(membership, clubId, mode, params.toString()) : [
    { id: "overview", label: "Overview", href: clubWorkspaceHref(clubId, "overview") },
    { id: "calendar", label: "Meetings", href: `${clubWorkspaceHref(clubId, "calendar")}&type=meetings` },
    { id: "tasks", label: "Tasks", href: clubWorkspaceHref(clubId, "tasks") },
  ];
  // The persistent shell (app/(workspace)/layout.tsx) draws the rail from the URL; this page adds its title and drawers.
  useShellBindings({ title: nav.find(n => n.id === active)?.label || "Club workspace", onSelect: () => {}, onNavigate: navigate,
    onModeSelect: id => { if (manager) saveClubWorkspacePreference(preferenceKey, id) } });
  const settingsOpen = !!settingsSection && manager && canOpenRecruitingSettings(membership);
  function openRecruitingSettings(next: RecruitingSettingsSection, trigger?: HTMLElement | null) {
    if (trigger) { settingsTrigger.current = trigger; settingsExplicitTrigger.current = true; }
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${withRecruitingSettings(params.toString(), next)}`;
    // Opening adds a history entry, so Back closes the drawer; switching sections replaces it.
    if (settingsSection) router.replace(href, { scroll: false }); else router.push(href, { scroll: false });
  }
  async function closeRecruitingSettings() {
    if (document.querySelector('[data-saving="true"]')) return;
    if (document.querySelector('[data-rule-dirty="true"]') && !(await confirm({ title: "Discard rule changes?", description: "Your unsaved rule changes will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return;
    router.replace(`/club/${encodeURIComponent(clubId)}/workspace?${withRecruitingSettings(params.toString(), null)}`, { scroll: false });
  }
  if (suspended) return <div className="max-w-[var(--oc-reading-width)] space-y-4"><PageHeader title="This club is suspended" /><p className="mt-3">Club operations are unavailable until an administrator restores it. Your membership and existing records are preserved.</p><Link href="/" className="mt-6 inline-block underline">Return to Personal</Link></div>;
  if (resolvingEntry || moved || legacyRoom) return <WorkspaceLoading label="Opening club workspace…" />;
  const allowed = mode === "recruiting" ? manager && recruitmentTools(membership!).length > 0 && nav.some(n => n.id === active) : nav.some(n => n.id === active);
  function navigate(view: ViewId) {
    if (view === "interview-workspace") { openInterviewRoom(); return }
    if (["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages"].includes(view)) {
      const href = view === "club-manager" ? clubWorkspaceHref(clubId, "settings") : view === "broadcast-messages" ? `${clubWorkspaceHref(clubId, "overview")}&focus=announcements` : `${clubWorkspaceHref(clubId, "recruitment")}&tool=${view === "interview-scheduler" ? "interviews" : "applicants"}`;
      if (!navigateWithinClub(href)) router.push(href); return;
    }
    router.push(view === "landing" ? "/" : studentPath(view, view === "calendar" ? "clubs" : null));
  }
  // Members reach their other clubs from the title row, never from a link above it.
  const allClubs = <Link className="text-sm text-muted-foreground underline underline-offset-4" href="/clubs">All my clubs</Link>;
  return <ShellState>
    <RecruitmentFocus />
        {loading || needsSelection ? <p role="status">Opening club workspace…</p> : !membership ? <div className="space-y-4"><PageHeader title="Club workspace unavailable" /><p>Sign in with a current club membership to access this workspace.</p><Link href="/" className="underline">Return to OutClass</Link></div> : <>
          {section === "overview" && allowed
            ? <DashboardHero className="oc-club-home-hero" ambientClassName="oc-club-home-ambient"><ClubOverviewHeader className="oc-club-home-greeting" density="expressive" clubName={current?.club.name || membership.club.name} context={{ mode: "club", clubId, membership, data: error ? null : current }} action={manager ? <ClubHomeActions clubId={clubId} membership={membership} /> : allClubs} /></DashboardHero>
            : active === "overview" && allowed
            ? <RecruitingHero clubId={clubId} clubName={current?.club.name || membership.club.name} membership={membership} data={error ? null : current} />
            : <PageHeader density={section === "overview" ? "expressive" : "compact"} eyebrow={membership.club.name} title={nav.find(n => n.id === active)?.label || "Workspace"} action={active === "applicants" ? <div id="workspace-page-actions" data-page-header-slot className="contents" /> : manager ? undefined : allClubs} />}
          {/* URL-driven tabs live outside the keyed section below, so changing a tab slides its indicator instead of remounting it. */}
          {allowed && !(needsOverview && (error || !current)) && <>
          {/* Phones reach recruiting through one bottom-bar item, so its pages show here as tabs. The rail covers wide screens. */}
          {section === "recruitment" && manager && <div className="mb-5 lg:hidden"><SectionTabs label="Recruiting sections" className="oc-recruiting-switch" current={nav.find(n => n.id === active)?.hidden ? "applicants" : active}
              items={mobileDestinations(nav.filter(n => n.id !== "settings")).map(n => ({ id: n.id, label: n.id === "overview" ? TERMS.recruiting : n.label, href: n.href! }))}
              onNavigate={(event, href) => { if (!canLeaveWorkspace()) { event.preventDefault(); return } handleClubLink(event, href) }} /></div>}
          </>}
          {needsOverview && error ? <Card variant="glass" role="alert" className="oc-dashboard-error"><div className="oc-dashboard-state px-[var(--oc-content-padding)]"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry</Button></div></Card> : needsOverview && !current ? <DashboardLoading mode={mode === "recruiting" ? "recruiting" : "club"} /> : !allowed ? <p role="alert">This section isn’t available with your current access.</p> : <section key={`${section === "settings" ? authorizationScope : scope}:${section}:${active}`} className="shell-content-enter" aria-label={nav.find(n => n.id === active)?.label}>
            {/* Club home: the same page for leaders and members, gated by the overview's permission-scoped data. */}
            {section === "overview" && current && <ManagerOverview data={current} refreshing={overviewPending} onChanged={() => setRetry(n => n + 1)} />}
            {section === "overview" && current && manager && hasPermission(membership, "meetings.manage") && <HomeAnnouncements clubId={clubId} privacyScope={scope} />}
            {section === "tasks" && (demo.isDemoEnabled ? <ClubTasks clubId={clubId} embedded personalOnly={!manager} initialScope={taskView === "mine" ? "mine" : manager ? "team" : "mine"} /> : <SelectedClubWorkspace kind="tasks" clubId={clubId} privacyScope={scope} personalOnly={!manager} initialScope={taskView === "mine" ? "mine" : manager ? "team" : "mine"} />)}
            {section === "calendar" && <ClubCalendar key={clubId} clubId={clubId} clubName={membership.club.name} canManage={hasPermission(membership, "meetings.manage")} canSeeAttendees={hasPermission(membership, "meetings.attendance")} membership={membership} personalOnly={!manager} />}
            {section === "members" && (demo.isDemoEnabled ? <ClubMembers key={clubId} clubId={clubId} /> : <SelectedClubWorkspace kind="members" clubId={clubId} privacyScope={scope} />)}
            {section === "settings" && <ClubSettingsWorkspace key={clubId} clubId={clubId} onSaved={() => { setRetry(n => n + 1); setPrivacyRevision(n => n + 1) }} />}
            {section === "recruitment" && (active === "decisions" ? <DecidePage clubId={clubId} member={membership} /> : active === "resumes" || active === "reviews" ? <ApplicantInterviewReviews clubId={clubId} tool={active} /> : active === "overview" && current ? <RecruitingOverview data={current} refreshing={overviewPending} onChanged={() => setRetry(n => n + 1)} /> : active === "interviews" ? <div className="space-y-3">{(hasPermission(membership, "interviews.manage") || interviewCapabilities(membership).editKit || interviewCapabilities(membership).participate || interviewCapabilities(membership).readClosing) && <RecruitmentWorkspace clubId={clubId} member={membership} onInterview={openInterviewRoom} initialTool="kits" />}</div> : <>{(demo.isDemoEnabled ? <LiveLeaderWorkspace key={privacyRevision} scoped initialDecision={decisionFilter(params.get("decision"))} /> : <SelectedClubWorkspace kind="pipeline" clubId={clubId} privacyScope={scope} decision={decisionFilter(params.get("decision"))} />)}</>)}
          </section>}
        </>}
        {membership && <RecruitingSettingsDrawer open={settingsOpen} section={settingsSection ?? "anonymous"} clubId={clubId} canIdentify={hasPermission(membership, "applicants.identify")}
          onSection={next => openRecruitingSettings(next)} onClose={closeRecruitingSettings} returnFocus={settingsTrigger}
          onPrivacyChanged={() => setPrivacyRevision(n => n + 1)}
          onReview={() => router.push(`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants`)} />}
  </ShellState>;
}
/**
 * Recruiting settings: the two drawers that used to be rail items (Anonymous Review, Auto-Reject Rules), now one
 * drawer with a section per tool. Contents are the same components as before; only the way in changed.
 * The sheet traps focus and closes on Escape; focus returns to the control that opened it.
 */
function RecruitingSettingsDrawer({ open, section, clubId, canIdentify, onSection, onClose, onPrivacyChanged, onReview, returnFocus }: {
  open: boolean; section: RecruitingSettingsSection; clubId: string; canIdentify: boolean
  onSection: (section: RecruitingSettingsSection) => void; onClose: () => void; onPrivacyChanged: () => void; onReview: () => void
  returnFocus: React.RefObject<HTMLElement | null>
}) {
  return <Sheet open={open} onOpenChange={next => { if (!next) onClose() }}>
    <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-lg" data-testid="recruiting-settings-drawer" onCloseAutoFocus={event => { event.preventDefault(); const target = returnFocus.current; if (target?.isConnected) target.focus(); else document.getElementById("workspace-content")?.focus() }}>
      <SheetTitle>Recruiting settings</SheetTitle>
      <SheetDescription>{recruitingSettingsSections.find(item => item.id === section)?.description}</SheetDescription>
      <Tabs value={section} onValueChange={value => onSection(value as RecruitingSettingsSection)} className="mt-4">
        <TabsList variant="segmented" aria-label="Recruiting settings sections">
          {recruitingSettingsSections.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="anonymous" className="mt-5">{open && section === "anonymous" && <RoundSettings key={clubId} clubId={clubId} embedded canIdentify={canIdentify} onChanged={onPrivacyChanged} />}</TabsContent>
        <TabsContent value="rules" className="mt-5">{open && section === "rules" && <ScreeningDashboardView key={clubId} clubId={clubId} onReview={onReview} />}</TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>;
}
function RecruitmentWorkspace({
  clubId,
  member,
  onInterview,
  initialTool,
}: {
  clubId: string;
  member: Overview["membership"];
  onInterview: () => void;
  initialTool?: "kits";
}) {
  const params = useSearchParams();
  const interviewTab = params.get("interviewTab") || "rooms";
  const interviewRoundId = params.get("roundId") || undefined;
  // Scheduling owns round/week navigation; resetting its parent during a round
  // change discards that state before the next interaction. Other tools keep
  // their existing round-scoped editor reset behavior.
  const tools = recruitmentTools(member),
    [tool, setTool] = useState(initialTool ?? tools[0]?.id ?? "applicants");
  const active = tools.find((t) => t.id === tool)?.id ?? tools[0]?.id;

  return (
    <div className="space-y-6">
      <div className={initialTool ? "hidden" : "flex flex-wrap items-end justify-between gap-4"}>
        <div>
          <h2 className="oc-section-heading ">Recruitment</h2>
        </div>
        <PillSelect label="Recruitment tool" prefix="Tool" active={false} value={active}
            onChange={(value) => value === "interviews" ? onInterview() : setTool(value as typeof tool)}
            options={tools.map((t) => ({ value: t.id, label: t.label }))} />
      </div>
      {active === "applicants" && <LiveLeaderWorkspace scoped />}
      {active === "rounds" && <RoundSettings clubId={clubId} />}
      {active === "kits" && <InterviewManagementTabs key={clubId} clubId={clubId} initialTab={interviewTab} initialRoundId={interviewRoundId} />}
    </div>
  );
}
function RoundSettings({ clubId, embedded = false, canIdentify = true, onChanged }: { clubId: string; embedded?: boolean; canIdentify?: boolean; onChanged?: () => void }) {
  const [rounds, setRounds] = useState<Awaited<
      ReturnType<typeof getWorkspaceRounds>
    > | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setError(false);
    getWorkspaceRounds(clubId)
      .then((r) => {
        if (current) setRounds(r);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [clubId, revision]);
  if (error)
    return (
      <div role="alert">
        Could not load rounds.{" "}
        <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
          Retry
        </Button>
      </div>
    );
  if (!rounds) return <WorkspaceLoading label="Loading recruitment rounds…" layout="rows" rows={3} />;
  return (
    <div className="max-w-[var(--oc-reading-width)] space-y-5">
      {!embedded && <ol className="divide-y">
        {rounds.map((r, i) => (
          <li className="py-3 text-sm" key={r.id}>
            {i + 1}. {r.name} ·{" "}
            {r.anonymousReview ? "Anonymous review" : "Identified review"}
          </li>
        ))}
      </ol>}
      {!rounds.length && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Recruiting has no rounds yet, so there is nothing to review or schedule.</p>
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/club/${encodeURIComponent(clubId)}/workspace?section=settings&setting=cycles`}>Set up recruitment rounds</Link>
        </div>
      )}
      <RecruitmentReviewSettings
        clubId={clubId}
        rounds={rounds}
        embedded={embedded}
        canIdentify={canIdentify}
        onChanged={() => { setRounds(null); setRevision((n) => n + 1); onChanged?.() }}
      />
    </div>
  );
}
