"use client"
import { ClubMeetingsWorkspace } from "@/components/events/club-meetings-workspace";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/product/page-header"
import { OrganizationSetupChecklist } from "@/components/organization-setup-checklist";
import { organizationCapabilities } from "@/lib/organization-authorization";
import { useRouter, useSearchParams } from "next/navigation";
import { RecruitingOverview } from "@/components/recruiting-overview";
import { ManagerOverview } from "@/components/manager-overview";
import { RouteWorkspaceShell } from "@/components/shell/route-workspace-shell";
import { ProductShell } from "@/components/shell/product-shell";
import { managerNavigation, personalModes, personalDestination } from "@/lib/product-navigation";
const ScreeningDashboardView = dynamic(() => import("@/components/views/screening-dashboard-view").then(m => m.ScreeningDashboardView));
const ClubAnnouncements = dynamic(() => import("@/components/club-announcements").then(m => m.ClubAnnouncements));
import type { ViewId } from "@/lib/views";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { interviewListHref } from "@/lib/interview-entry";
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
import { ApplicationStateProvider, useApplicationState } from "@/lib/application-state";
const ClubMembers = dynamic(() => import("@/components/club-members").then(m => m.ClubMembers));
import { ClubSettingsWorkspace } from "@/components/club-settings-workspace";
const ClubTasks = dynamic(() => import("@/components/club-tasks").then(m => m.ClubTasks));
import { MeetingList } from "@/components/meeting-workspace";
const LiveLeaderWorkspace = dynamic(() => import("@/components/views/leader-dashboard/live-leader-workspace").then(m => m.LiveLeaderWorkspace));
const InterviewWorkspaceView = dynamic(() => import("@/components/views/interview-workspace-view").then(m => m.InterviewWorkspaceView));
const InterviewManagementTabs = dynamic(() => import("@/components/interview-management-tabs").then(m => m.InterviewManagementTabs));
const ApplicantInterviewReviews = dynamic(() => import("@/components/applicant-interview-reviews").then(m => m.ApplicantInterviewReviews));
import { DecisionSchedules } from "@/components/decision-schedules";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import { DashboardLoading } from "@/components/product/dashboard-presentation";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { SelectedClubWorkspace } from "@/components/selected-club-workspace";
import { clubWorkspaceEntryHref, clubWorkspacePreferenceKey, readClubWorkspacePreference, saveClubWorkspacePreference } from "@/lib/club-workspace-preference";
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>;
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
  // Keep cycle bookmarks while locating configuration in Settings.
  const legacyConfiguration = params.get("section") === "recruitment" && ["cycles", "letters"].includes(params.get("tool") ?? "");
  useEffect(() => {
    if (!legacyConfiguration) return;
    const next = new URLSearchParams(params.toString());
    next.set("section", "settings"); next.set("setting", params.get("tool") === "letters" ? "notifications" : "cycles"); next.delete("tool");
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href, true)) router.replace(href);
  }, [legacyConfiguration, clubId, params, router]);
  const legacyInterviewTool = params.get("section") === "settings" && params.get("setting") === "interviews" && ["rooms", "schedule", "availability"].includes(params.get("interviewTab") ?? "");
  useEffect(() => {
    if (!legacyInterviewTool) return;
    const next = new URLSearchParams(params.toString());
    next.set("section", "recruitment"); next.set("tool", "interviews"); next.delete("setting");
    if (next.get("interviewTab") === "availability") next.set("interviewTab", "schedule");
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href, true)) router.replace(href);
  }, [legacyInterviewTool, clubId, params, router]);
  const legacyEvents = params.get("section") === "events";
  const section = legacyEvents ? "meetings" : params.get("section") ?? "overview";
  const taskView = params.get("taskView") ?? undefined;
  const tool = params.get("tool") ?? undefined;
  const moved = legacyApplicantInterviewHref(clubId, params.toString());
  useEffect(() => { if (moved && !navigateWithinClub(moved, true)) router.replace(moved); }, [moved, router]);
  const interviewMode = section === "recruitment" && tool === "interviews" && params.get("interview") === "1";
  function setInterviewMode(open: boolean) {
    const next = new URLSearchParams(params.toString());
    if (open) { next.set("section", "recruitment"); next.set("tool", "interviews"); next.set("interview", "1") }
    else { const back = interviewListHref(clubId, params.toString()); if (!navigateWithinClub(back, true)) router.replace(back); return; }
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href, true)) router.replace(href);
  }
  const needsOverview = section === "overview" || section === "recruitment" && (tool === "overview" || tool === "rounds" || tool === "rules");
  const reviewTrigger = useRef<HTMLElement | null>(null);
  const [reviewTool, setReviewTool] = useState<string | null>(tool === "rounds" || tool === "rules" ? tool : null);
  const [privacyRevision, setPrivacyRevision] = useState(0);
  useEffect(() => { setReviewTool(tool === "rounds" || tool === "rules" ? tool : null) }, [tool, clubId]);
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
  const [data, setData] = useState<{ scope: string; value: Overview } | null>(null),
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
    getClubWorkspaceOverview(clubId)
      .then((value) => {
        if (current && owner.current === scope) setData({ scope, value });
      })
      .catch(() => {
        if (current) {
          setData(null);
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
  ]);
  const current = data?.scope === scope && data.value.club.id === clubId ? data.value : null;
  if (suspended) return <RouteWorkspaceShell><div className="max-w-2xl space-y-4"><h1 className="text-2xl font-semibold">This club is suspended</h1><p className="mt-3">Club operations are unavailable until an administrator restores it. Your membership and existing records are preserved.</p><Link href="/" className="mt-6 inline-block underline">Return to Personal</Link></div></RouteWorkspaceShell>;
  if (resolvingEntry || moved) return <WorkspaceLoading label="Opening club workspace…" />;
  const mode = section === "recruitment" || section === "announcements" && params.get("mode") === "recruiting" ? "recruiting" : "club";
  const active = section === "announcements" ? "announcements" : mode === "recruiting" ? (tool === "rounds" || tool === "rules" ? "overview" : tool || "applicants") : section;
  const nav = manager ? managerNavigation(membership, clubId, mode, params.toString()) : [
    { id: "overview", label: "Overview", href: clubWorkspaceHref(clubId, "overview") },
    { id: "meetings", label: "Meetings", href: clubWorkspaceHref(clubId, "meetings") },
    { id: "tasks", label: "Tasks", href: clubWorkspaceHref(clubId, "tasks") },
  ];
  const allowed = mode === "recruiting" ? manager && (active === "announcements" || recruitmentTools(membership!).length > 0) && nav.some(n => n.id === active) : nav.some(n => n.id === active);
  function navigate(view: ViewId) {
    if (view === "interview-workspace") { setInterviewMode(true); return }
    if (["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages"].includes(view)) {
      const href = view === "club-manager" ? clubWorkspaceHref(clubId, "settings") : view === "broadcast-messages" ? `/club/${clubId}/workspace?section=announcements${mode === "recruiting" ? "&mode=recruiting" : ""}` : `${clubWorkspaceHref(clubId, "recruitment")}&tool=${view === "interview-scheduler" ? "interviews" : "applicants"}`;
      if (!navigateWithinClub(href)) router.push(href); return;
    }
    router.push(view === "landing" ? "/" : `/?workspace=student&view=${view}${view === "calendar" ? "&section=clubs" : ""}`);
  }
  return <ApplicationStateProvider initialData={{ applications: [], attendances: [] }} persistLocalState={false}>
    <RecruitmentFocus />
    {interviewMode && membership && !loading && !needsSelection && hasPermission(membership, "applications.review") ? <InterviewWorkspaceView key={`${clubId}:${params.get("applicationId") || ""}:${params.get("roundId") || ""}:${params.get("bookingId") || ""}`} scoped onExit={() => setInterviewMode(false)} /> :
      <ProductShell manager={manager} clubId={clubId} clubName={current?.club.name || membership?.club.name} mode={manager ? mode : "clubs"}
        modes={manager ? [...(recruitmentTools(membership!).length ? [{ id: "recruiting", label: "Recruiting", href: `${clubWorkspaceHref(clubId, "recruitment")}&tool=overview` }] : []), { id: "club", label: "Club", href: clubWorkspaceHref(clubId, "overview") }] : personalModes.map(item => { const destination = personalDestination(item.id); const params = new URLSearchParams({ workspace: "student", view: destination.view }); if (destination.section) params.set("section", destination.section); return { ...item, href: `/?${params}` } })}
        onModeSelect={id => { if (manager && (id === "recruiting" || id === "club")) saveClubWorkspacePreference(preferenceKey, id) }}
        onReviewTool={id => { reviewTrigger.current = document.activeElement as HTMLElement; setReviewTool(id) }} items={nav} active={active} title={nav.find(n => n.id === active)?.label || "Club workspace"} onSelect={() => {}} onNavigate={navigate}>
        {loading || needsSelection ? <p role="status">Opening club workspace…</p> : !membership ? <div className="space-y-4"><h1 className="oc-page-title ">Club workspace unavailable</h1><p>Sign in with a current club membership to access this workspace.</p><Link href="/" className="underline">Return to OutClass</Link></div> : <>
          {!manager && <Link className="mb-5 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4" href="/?workspace=student&view=my-clubs">← All my clubs</Link>}
          <PageHeader eyebrow={membership.club.name} title={manager && mode === "recruiting" && active === "overview" ? "Recruitment" : nav.find(n => n.id === active)?.label || "Workspace"} />
          {needsOverview && error ? <div role="alert" className="oc-dashboard-error"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : needsOverview && !current ? <DashboardLoading mode={mode === "recruiting" ? "recruiting" : "club"} /> : !allowed ? <p role="alert">This section isn’t available with your current access.</p> : <section key={`${section === "settings" ? authorizationScope : scope}:${section}:${active}`} className="shell-content-enter" aria-label={nav.find(n => n.id === active)?.label}>
            {section === "overview" && current && (manager ? <><ManagerOverview data={current} refreshing={overviewPending} onChanged={() => setRetry(n => n + 1)} />{!demo.isDemoEnabled && organizationCapabilities(current.membership).canTransferOwnership && <OrganizationSetupChecklist key={`${clubId}:${retry}`} clubId={clubId} compact />}</> : <ManagerOverview data={current} refreshing={overviewPending} onChanged={() => setRetry(n => n + 1)} />)}
            {section === "tasks" && (demo.isDemoEnabled ? <ClubTasks clubId={clubId} embedded personalOnly={!manager} initialScope={taskView === "mine" ? "mine" : manager ? "team" : "mine"} /> : <SelectedClubWorkspace kind="tasks" clubId={clubId} privacyScope={scope} personalOnly={!manager} initialScope={taskView === "mine" ? "mine" : manager ? "team" : "mine"} />)}
            {section === "meetings" && (hasPermission(membership, "meetings.manage") ? <ClubMeetingsWorkspace key={clubId} clubId={clubId} clubName={membership.club.name} canSeeAttendees={hasPermission(membership, "meetings.attendance")} legacyEvents={legacyEvents} /> : <MeetingList clubId={clubId} embedded personalOnly={!manager} initialAudience="MEMBERS" />)}
            {section === "members" && (demo.isDemoEnabled ? <ClubMembers key={clubId} clubId={clubId} /> : <SelectedClubWorkspace kind="members" clubId={clubId} privacyScope={scope} />)}
            {section === "settings" && <ClubSettingsWorkspace key={clubId} clubId={clubId} onSaved={() => { setRetry(n => n + 1); setPrivacyRevision(n => n + 1) }} />}
            {section === "announcements" && (demo.isDemoEnabled ? <ClubAnnouncements key={clubId} clubId={clubId} /> : <SelectedClubWorkspace kind="announcements" clubId={clubId} privacyScope={scope} />)}
            {section === "recruitment" && (active === "resumes" || active === "reviews" ? <ApplicantInterviewReviews clubId={clubId} tool={active} /> : active === "scheduled-decisions" ? <DecisionSchedules clubId={clubId} /> : active === "overview" && current ? <RecruitingOverview data={current} refreshing={overviewPending} onChanged={() => setRetry(n => n + 1)} /> : active === "interviews" ? <div className="space-y-3">{(hasPermission(membership, "interviews.manage") || interviewCapabilities(membership).editKit || interviewCapabilities(membership).participate || interviewCapabilities(membership).readClosing) && <RecruitmentWorkspace clubId={clubId} member={membership} onInterview={() => setInterviewMode(true)} initialTool="kits" />}</div> : <>{(active === "decisions" || active === "rejected") && <p className="mb-5 text-sm text-muted-foreground">{active === "decisions" ? "Publish final decisions with a formal letter and inbox notification. Decision-availability email follows the student’s application-email preferences." : active === "rejected" ? "Review retained rejected applications and their history. Use explicit reconsideration to return an eligible application to review." : "Review submitted applications and move candidates through your club’s rounds."}</p>}{(demo.isDemoEnabled ? <LiveLeaderWorkspace key={privacyRevision} scoped rejectedOnly={active === "rejected"} decisionsOnly={active === "decisions"} /> : <SelectedClubWorkspace kind="pipeline" clubId={clubId} privacyScope={scope} rejectedOnly={active === "rejected"} decisionsOnly={active === "decisions"} />)}</>)}
          </section>}
        </>}
        <Sheet open={!!reviewTool && !!membership && mode === "recruiting" && nav.some(n => n.id === reviewTool && n.quiet)} onOpenChange={open => { if (!open) { if (document.querySelector('[data-saving="true"]')) return; if (document.querySelector('[data-rule-dirty="true"]') && !window.confirm("Discard unsaved rule changes?")) return; setReviewTool(null); if (tool === "rounds" || tool === "rules") { const next = new URLSearchParams(params.toString()); next.set("tool", "overview"); router.replace(`/club/${encodeURIComponent(clubId)}/workspace?${next}`) } } }}>
          <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-lg" onCloseAutoFocus={event => { event.preventDefault(); const target = reviewTrigger.current; if (target?.isConnected) target.focus(); else document.getElementById("workspace-content")?.focus() }}>
            <SheetTitle>{reviewTool === "rounds" ? "Anonymous Review" : "Auto-Reject Rules"}</SheetTitle>
            <SheetDescription>{reviewTool === "rounds" ? "Round privacy and requirements for future submissions." : "Saved round thresholds, applicant previews, and reversible review flags."}</SheetDescription>
            {reviewTool === "rounds" && membership && <RoundSettings key={clubId} clubId={clubId} embedded canIdentify={hasPermission(membership, "applicants.identify")} onChanged={() => setPrivacyRevision(n => n + 1)} />}
            {reviewTool === "rules" && <ScreeningDashboardView key={clubId} clubId={clubId} onReview={() => { setReviewTool(null); router.push(`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants`) }} />}
          </SheetContent>
        </Sheet>
      </ProductShell>}
  </ApplicationStateProvider>;
}
function RecruitmentFocus() {
  const params = useSearchParams(), { focusLeader } = useApplicationState();
  const { activeClubId } = useAuth();
  const applicantId = params.get("applicantId"), roundId = params.get("roundId");
  useEffect(() => { if (activeClubId && (applicantId || roundId)) focusLeader({ clubId: activeClubId, ...(applicantId ? { applicantId } : {}), ...(roundId ? { roundId } : {}) }) }, [activeClubId, applicantId, roundId, focusLeader]);
  return null;
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
          <p className="mt-2 text-sm text-muted-foreground">
            Applicants, rounds, and interviews in one workspace. Decisions
            remain in the applicant workflow.
          </p>
        </div>
        <label className="text-sm">
          Recruitment tool
          <select
            aria-label="Recruitment tool"
            className="mt-1 block min-h-11 max-w-full rounded-md border bg-background px-3"
            value={active}
            onChange={(e) =>
              e.target.value === "interviews"
                ? onInterview()
                : setTool(e.target.value as typeof tool)
            }
          >
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
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
  if (!rounds) return <p role="status">Loading rounds…</p>;
  return (
    <div className="max-w-3xl space-y-5">
      {!embedded && <ol className="divide-y">
        {rounds.map((r, i) => (
          <li className="py-3 text-sm" key={r.id}>
            {i + 1}. {r.name} ·{" "}
            {r.anonymousReview ? "Anonymous review" : "Identified review"}
          </li>
        ))}
      </ol>}
      {!rounds.length && (
        <p className="text-sm text-muted-foreground">
          No recruitment rounds are configured yet.
        </p>
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
