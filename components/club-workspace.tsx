"use client"
import { ClubEvents } from "@/components/events/club-events";
import dynamic from "next/dynamic";
import { clubCampusIllustration } from "@/lib/campus-illustrations"
import { PageHeader } from "@/components/product/page-header"
import { OrganizationSetupChecklist } from "@/components/organization-setup-checklist";
import { organizationCapabilities } from "@/lib/organization-authorization";
import { useRouter, useSearchParams } from "next/navigation";
import { RecruitingOverview } from "@/components/recruiting-overview";
import { ManagerOverview } from "@/components/manager-overview";
import { MemberOverview } from "@/components/member-overview";
import { ProductShell } from "@/components/shell/product-shell";
import { managerNavigation, personalModes, personalDestination } from "@/lib/product-navigation";
const ScreeningDashboardView = dynamic(() => import("@/components/views/screening-dashboard-view").then(m => m.ScreeningDashboardView));
const ClubAnnouncements = dynamic(() => import("@/components/club-announcements").then(m => m.ClubAnnouncements));
import type { ViewId } from "@/lib/views";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
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
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { navigateWithinClub } from "@/lib/workspace-navigation";
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>;
type Directory = Awaited<ReturnType<typeof import("@/actions/organization-members").getOrganizationMemberManagement>>;
type Pipeline = Awaited<ReturnType<typeof import("@/lib/workspace-api").getClubPipeline>>;
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
  const section = params.get("section") ?? "overview";
  const taskView = params.get("taskView") ?? undefined;
  const tool = params.get("tool") ?? undefined;
  const needsOverview = section === "overview" || section === "recruitment" && (tool === "overview" || tool === "rounds" || tool === "rules");
  const reviewTrigger = useRef<HTMLElement | null>(null);
  const [reviewTool, setReviewTool] = useState<string | null>(tool === "rounds" || tool === "rules" ? tool : null);
  const [privacyRevision, setPrivacyRevision] = useState(0);
  useEffect(() => { setReviewTool(tool === "rounds" || tool === "rules" ? tool : null) }, [tool, clubId]);
  const { user, loading, activeClubId, selectClub } = useAuth(),
    demo = useDemoMode();
  const membership = user?.memberships.find((m) => m.clubId === clubId);
  const membershipKey = membership ? `${membership.id}:${membership.status}:${membership.accessRole}:${membership.isOwner}:${membership.permissions.join(",")}:${membership.interviewOffices?.join(",") ?? ""}:${membership.club.pipelineVersion}:${membership.club.applicationVersion}` : "";
  const canLoadWorkspace = !!membership;
  // Resource state belongs to this mounted workspace, never a module/global cache.
  // Account, grant or privacy changes immediately hide prior resources.
  const scope = `${demo.isDemoEnabled ? "demo" : "live"}:${user?.id}:${clubId}:${membershipKey}:${privacyRevision}`;
  const owner = useRef(scope); owner.current = scope;
  const [resources, setResources] = useState<{ scope: string; members: Directory | null; pipeline: Pipeline | null; membersAt: number; pipelineAt: number }>({ scope, members: null, pipeline: null, membersAt: 0, pipelineAt: 0 });
  const saved = resources.scope === scope ? { ...resources, members: Date.now() - resources.membersAt < 30000 ? resources.members : null, pipeline: Date.now() - resources.pipelineAt < 30000 ? resources.pipeline : null } : null;
  function publishMembers(members: Directory | null) {
    if (owner.current !== scope) return;
    setResources(previous => previous.scope === scope && previous.members === members ? previous : { scope, members, membersAt: Date.now(), pipeline: previous.scope === scope ? previous.pipeline : null, pipelineAt: previous.scope === scope ? previous.pipelineAt : 0 });
  }
  function publishPipeline(id: string, pipeline: Pipeline | null) {
    if (owner.current !== scope || id !== clubId) return;
    setResources(previous => previous.scope === scope && previous.pipeline === pipeline ? previous : { scope, pipeline, pipelineAt: Date.now(), members: previous.scope === scope ? previous.members : null, membersAt: previous.scope === scope ? previous.membersAt : 0 });
  }
  const [data, setData] = useState<{ scope: string; value: Overview } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [interviewMode, setInterviewMode] = useState(false);
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
      });
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
  const manager = !!membership && hasWorkspace(membership);
  const mode = section === "recruitment" ? "recruiting" : "club";
  const active = mode === "recruiting" ? (tool === "rounds" || tool === "rules" ? "overview" : tool || "applicants") : section;
  const nav = manager ? managerNavigation(membership, clubId, mode) : [
    { id: "overview", label: "Overview", href: clubWorkspaceHref(clubId) },
    { id: "meetings", label: "Meetings", href: clubWorkspaceHref(clubId, "meetings") },
    { id: "tasks", label: "Tasks", href: clubWorkspaceHref(clubId, "tasks") },
  ];
  const allowed = mode === "recruiting" ? manager && recruitmentTools(membership!).length > 0 && nav.some(n => n.id === active) : nav.some(n => n.id === active);
  function navigate(view: ViewId) {
    if (view === "interview-workspace") { setInterviewMode(true); return }
    if (["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages"].includes(view)) {
      const href = view === "club-manager" ? clubWorkspaceHref(clubId, "settings") : view === "broadcast-messages" ? `/club/${clubId}/workspace?section=announcements` : `${clubWorkspaceHref(clubId, "recruitment")}&tool=${view === "interview-scheduler" ? "interviews" : "applicants"}`;
      if (!navigateWithinClub(href)) router.push(href); return;
    }
    router.push(view === "landing" ? "/" : `/?workspace=student&view=${view}`);
  }
  return <ApplicationStateProvider initialData={{ applications: [], attendances: [] }} persistLocalState={false}>
    <RecruitmentFocus />
    {interviewMode && membership && hasPermission(membership, "applications.review") ? <InterviewWorkspaceView scoped onExit={() => setInterviewMode(false)} /> :
      <ProductShell manager={manager} clubId={clubId} clubName={current?.club.name || membership?.club.name} mode={manager ? mode : "clubs"}
        modes={manager ? [{ id: "recruiting", label: "Recruiting", href: `${clubWorkspaceHref(clubId, "recruitment")}&tool=overview` }, { id: "club", label: "Club", href: clubWorkspaceHref(clubId) }] : personalModes.map(item => { const destination = personalDestination(item.id); const params = new URLSearchParams({ workspace: "student", view: destination.view }); if (destination.section) params.set("section", destination.section); return { ...item, href: `/?${params}` } })}
        onReviewTool={id => { reviewTrigger.current = document.activeElement as HTMLElement; setReviewTool(id) }} items={nav} active={active} title={nav.find(n => n.id === active)?.label || "Club workspace"} onSelect={() => {}} onNavigate={navigate}>
        {loading || needsSelection ? <p role="status">Opening club workspace…</p> : !membership ? <div className="space-y-4"><h1 className="oc-page-title ">Club workspace unavailable</h1><p>Sign in with a current club membership to access this workspace.</p><Link href="/" className="underline">Return to OutClass</Link></div> : <>
          {!manager && <Link className="mb-5 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4" href="/?workspace=student&view=my-clubs">← All my clubs</Link>}
          <PageHeader eyebrow={membership.club.name} title={manager && mode === "recruiting" && active === "overview" ? "Recruitment" : nav.find(n => n.id === active)?.label || "Workspace"} description={manager && section === "overview" ? "Your club, in motion." : manager && mode === "recruiting" && active === "overview" ? "Build your next class." : undefined} illustration={manager ? { variant: clubCampusIllustration(active), treatment: "quiet" } : "monticello"} action={<Link className="oc-profile-link" href={`/club/${clubId}`}>Public club profile ↗</Link>} />
          {needsOverview && error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : needsOverview && !current ? <p role="status">Loading club activity…</p> : !allowed ? <p role="alert">This section isn’t available with your current access.</p> : <section key={`${scope}:${section}:${active}`} className="shell-content-enter" aria-label={nav.find(n => n.id === active)?.label}>
            {section === "overview" && current && (manager ? <><ManagerOverview data={current} />{!demo.isDemoEnabled && organizationCapabilities(current.membership).canTransferOwnership && <OrganizationSetupChecklist key={`${clubId}:${retry}`} clubId={clubId} compact />}</> : <MemberOverview data={current} />)}
            {section === "tasks" && <ClubTasks clubId={clubId} embedded personalOnly={!manager} initialScope={taskView === "mine" ? "mine" : manager ? "team" : "mine"} />}
            {section === "meetings" && <MeetingList clubId={clubId} embedded personalOnly={!manager} initialAudience={hasPermission(membership, "meetings.manage") ? "ALL" : "MEMBERS"} />}
            {section === "events" && hasPermission(membership, "meetings.manage") && <ClubEvents key={clubId} clubId={clubId} clubName={membership.club.name} canSeeAttendees={hasPermission(membership, "meetings.attendance")} />}
            {section === "members" && <ClubMembers key={clubId} clubId={clubId} initialDirectory={saved?.members} onDirectory={publishMembers} />}
            {section === "settings" && <ClubSettingsWorkspace key={clubId} clubId={clubId} onSaved={() => { setRetry(n => n + 1); setPrivacyRevision(n => n + 1) }} />}
            {section === "announcements" && <ClubAnnouncements key={clubId} />}
            {section === "recruitment" && (active === "overview" && current ? <RecruitingOverview data={current} /> : active === "interviews" ? <div className="space-y-8">{hasPermission(membership, "applications.review") && <div className="border-b pb-6"><p className="mb-4 text-sm text-muted-foreground">Open your round’s candidate queue to take notes and complete reviews.</p><Button onClick={() => setInterviewMode(true)}>Enter interview mode</Button></div>}{(interviewCapabilities(membership).editKit || interviewCapabilities(membership).participate) && <RecruitmentWorkspace clubId={clubId} member={membership} onInterview={() => setInterviewMode(true)} initialTool="kits" />}</div> : <><p className="mb-5 text-sm text-muted-foreground">{active === "decisions" ? "Review applications and record decisions. Changes are saved to the application; no automatic email is sent." : "Review submitted applications and move candidates through your club’s rounds."}</p><LiveLeaderWorkspace key={privacyRevision} scoped decisionsOnly={active === "decisions"} initialData={saved?.pipeline ? { clubId, pipeline: saved.pipeline } : undefined} onData={publishPipeline} /></>)}
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
      {active === "kits" && <InterviewManagementTabs key={clubId} clubId={clubId} />}
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
