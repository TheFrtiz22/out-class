"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagerOverview } from "@/components/manager-overview";
import { MemberOverview } from "@/components/member-overview";
import { ProductShell } from "@/components/shell/product-shell";
import { managerNavigation } from "@/lib/product-navigation";
import { ScreeningDashboardView } from "@/components/views/screening-dashboard-view";
import { BroadcastMessagesView } from "@/components/views/club-manager/broadcast-messages-view";
import type { ViewId } from "@/lib/views";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
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
import { ClubWorkspaceSettings } from "@/components/club-workspace-settings";
import { ClubTasks } from "@/components/club-tasks";
import { MeetingList } from "@/components/meeting-workspace";
import { LiveLeaderWorkspace } from "@/components/views/leader-dashboard/live-leader-workspace";
import { InterviewWorkspaceView } from "@/components/views/interview-workspace-view";
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { InterviewSchedulerView } from "@/components/views/interview-scheduler-view";
import { DemoInterviewSchedule } from "@/components/demo-workspace";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { demoStore } from "@/lib/demo/store";
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>;
export function ClubWorkspace({
  clubId,
  section,
  taskView,
  tool,
}: {
  clubId: string;
  section: string;
  taskView?: string;
  tool?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const reviewTrigger = useRef<HTMLElement | null>(null);
  const [reviewTool, setReviewTool] = useState<string | null>(tool === "rounds" || tool === "rules" ? tool : null);
  const [privacyRevision, setPrivacyRevision] = useState(0);
  useEffect(() => { setReviewTool(tool === "rounds" || tool === "rules" ? tool : null) }, [tool, clubId]);
  const { user, loading, activeClubId, selectClub } = useAuth(),
    demo = useDemoMode();
  const membership = user?.memberships.find((m) => m.clubId === clubId);
  const [data, setData] = useState<Overview | null>(null),
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
    if (!demo.ready || loading || !membership || needsSelection) return;
    let current = true;
    setError("");
    getClubWorkspaceOverview(clubId)
      .then((value) => {
        if (current) setData(value);
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
    section,
    retry,
    loading,
    demo.ready,
    needsSelection,
    membership?.id,
  ]);
  const current = data?.club.id === clubId ? data : null;
  const manager = !!membership && hasWorkspace(membership);
  const mode = section === "recruitment" ? "recruiting" : "club";
  const active = mode === "recruiting" ? (tool === "rounds" || tool === "rules" ? "overview" : tool || "applicants") : section;
  const nav = manager ? managerNavigation(current?.membership ?? membership, clubId, mode) : [
    { id: "overview", label: "Overview", href: clubWorkspaceHref(clubId) },
    { id: "meetings", label: "Meetings", href: clubWorkspaceHref(clubId, "meetings") },
    { id: "tasks", label: "Tasks", href: clubWorkspaceHref(clubId, "tasks") },
  ];
  const allowed = mode === "recruiting" ? manager && recruitmentTools(membership!).length > 0 && nav.some(n => n.id === active) : nav.some(n => n.id === active);
  function navigate(view: ViewId) {
    if (view === "interview-workspace") { setInterviewMode(true); return }
    if (["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages"].includes(view)) {
      router.push(view === "club-manager" ? clubWorkspaceHref(clubId, "settings") : view === "broadcast-messages" ? `/club/${clubId}/workspace?section=announcements` : `${clubWorkspaceHref(clubId, "recruitment")}&tool=${view === "interview-scheduler" ? "interviews" : "applicants"}`); return;
    }
    router.push(view === "landing" ? "/" : `/?workspace=student&view=${view}`);
  }
  return <ApplicationStateProvider initialData={{ applications: [], attendances: [] }} persistLocalState={false}>
    <RecruitmentFocus />
    {interviewMode && current && hasPermission(current.membership, "applications.review") ? <InterviewWorkspaceView scoped onExit={() => setInterviewMode(false)} /> :
      <ProductShell manager={manager} clubId={clubId} clubName={current?.club.name || membership?.club.name} mode={manager ? mode : "clubs"}
        modes={manager ? [{ id: "recruiting", label: "Recruiting", href: `${clubWorkspaceHref(clubId, "recruitment")}&tool=overview` }, { id: "club", label: "Club", href: clubWorkspaceHref(clubId) }] : [{ id: "explore", label: "Explore", href: "/?workspace=student&view=discover" }, { id: "applications", label: "Applications", href: "/?workspace=student&view=tracker" }, { id: "clubs", label: "My Clubs", href: "/?workspace=student&view=my-clubs" }]}
        onReviewTool={id => { reviewTrigger.current = document.activeElement as HTMLElement; setReviewTool(id) }} items={nav} active={active} title={nav.find(n => n.id === active)?.label || "Club workspace"} onSelect={() => {}} onNavigate={navigate}>
        {loading || needsSelection ? <p role="status">Opening club workspace…</p> : !membership ? <div className="space-y-4"><h1 className="font-display text-3xl">Club workspace unavailable</h1><p>Sign in with a current club membership to access this workspace.</p><Link href="/" className="underline">Return to OutClass</Link></div> : <>
          {!manager && <Link className="mb-5 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4" href="/?workspace=student&view=my-clubs">← All my clubs</Link>}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{membership.club.name}</p><h1 className="font-display text-3xl sm:text-4xl">{nav.find(n => n.id === active)?.label || "Workspace"}</h1></div><Link className="text-sm text-muted-foreground underline underline-offset-4" href={`/club/${clubId}`}>Public club profile ↗</Link></div>
          {error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : !current ? <p role="status">Loading club activity…</p> : !allowed ? <p role="alert">This section isn’t available with your current access.</p> : <section key={`${section}:${active}`} className="shell-content-enter" aria-label={nav.find(n => n.id === active)?.label}>
            {section === "overview" && (manager ? <ManagerOverview data={current} /> : <MemberOverview data={current} />)}
            {section === "tasks" && <ClubTasks clubId={clubId} embedded personalOnly={!manager} initialScope={taskView === "team" ? "team" : "mine"} />}
            {section === "meetings" && <MeetingList clubId={clubId} embedded personalOnly={!manager} initialAudience={hasPermission(current.membership, "meetings.manage") ? "ALL" : "MEMBERS"} />}
            {section === "members" && (demo.isDemoEnabled ? <DemoMembers clubId={clubId} /> : <ClubWorkspaceSettings section="members" />)}
            {section === "settings" && (demo.isDemoEnabled ? <DemoProfile clubId={clubId} /> : <ClubWorkspaceSettings section="settings" />)}
            {section === "announcements" && <><PreviewNotice /><BroadcastMessagesView /></>}
            {section === "recruitment" && (active === "overview" ? <div className="max-w-3xl"><p className="mb-6 text-muted-foreground">Review applications, prepare interviews, and record decisions.</p><ul className="divide-y border-y">{nav.filter(n => n.id !== "overview" && !n.quiet).map(n => <li key={n.id}><Link className="flex min-h-14 items-center justify-between py-4 text-sm" href={n.href!}>{n.label}<span className="text-muted-foreground">{n.preview ? "Local preview · " : ""}→</span></Link></li>)}</ul></div> : active === "interviews" ? <div className="space-y-8">{hasPermission(current.membership, "applications.review") && <div className="border-b pb-6"><p className="mb-4 text-sm text-muted-foreground">Open your round’s candidate queue to take notes and complete reviews.</p><Button onClick={() => setInterviewMode(true)}>Enter interview mode</Button></div>}{hasPermission(current.membership, "interviews.manage") && <RecruitmentWorkspace clubId={clubId} member={current.membership} onInterview={() => setInterviewMode(true)} initialTool="kits" />}</div> : <><p className="mb-5 text-sm text-muted-foreground">{active === "decisions" ? "Review applications and record decisions. Changes are saved to the application; no automatic email is sent." : "Review submitted applications and move candidates through your club’s rounds."}</p><LiveLeaderWorkspace key={privacyRevision} scoped decisionsOnly={active === "decisions"} /></>)}
          </section>}
        </>}
        <Sheet open={!!reviewTool && !!current && mode === "recruiting" && nav.some(n => n.id === reviewTool && n.quiet)} onOpenChange={open => { if (!open) { if (document.querySelector('[data-saving="true"]')) return; setReviewTool(null); if (tool === "rounds" || tool === "rules") { const next = new URLSearchParams(params.toString()); next.set("tool", "overview"); router.replace(`/club/${encodeURIComponent(clubId)}/workspace?${next}`) } } }}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg" onCloseAutoFocus={event => { event.preventDefault(); const target = reviewTrigger.current; if (target?.isConnected) target.focus(); else document.getElementById("workspace-content")?.focus() }}>
            <SheetTitle>{reviewTool === "rounds" ? "Anonymous Review" : "Auto-Reject Rules"}</SheetTitle>
            <SheetDescription>{reviewTool === "rounds" ? "Round privacy and requirements for future submissions." : "Preview thresholds using sample data. No automated decisions."}</SheetDescription>
            {reviewTool === "rounds" && current && <RoundSettings key={clubId} clubId={clubId} embedded canIdentify={hasPermission(current.membership, "applicants.identify")} onChanged={() => setPrivacyRevision(n => n + 1)} />}
            {reviewTool === "rules" && <ScreeningDashboardView />}
          </SheetContent>
        </Sheet>
      </ProductShell>}
  </ApplicationStateProvider>;
}
function PreviewNotice() { return <p role="note" className="mb-6 border-l-2 border-brand-orange pl-4 text-sm text-muted-foreground">Local preview · sample data only. These controls do not update live applicants, publish announcements, or send messages.</p> }
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
  const demo = useDemoMode(),
    tools = recruitmentTools(member),
    [tool, setTool] = useState(initialTool ?? tools[0]?.id ?? "applicants");
  const active = tools.find((t) => t.id === tool)?.id ?? tools[0]?.id;

  return (
    <div className="space-y-6">
      <div className={initialTool ? "hidden" : "flex flex-wrap items-end justify-between gap-4"}>
        <div>
          <h2 className="font-display text-2xl">Recruitment</h2>
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
      {active === "kits" && (
        <div className="space-y-8">
          <ClubInterviewKitSettings clubId={clubId} />
          {demo.isDemoEnabled ? (
            <DemoInterviewSchedule onNavigate={onInterview} />
          ) : (
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm">
                Existing scheduling preview tools
              </summary>
              <p className="my-3 text-sm text-muted-foreground">
                These local scheduling tools do not publish real slots.
                Interview kits above are persisted.
              </p>
              <InterviewSchedulerView
                onNavigate={() => {
                  if (hasPermission(member, "applications.review"))
                    onInterview();
                }}
              />
            </details>
          )}
        </div>
      )}
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
function DemoMembers({ clubId }: { clubId: string }) {
  const demo = useDemoMode(),
    members = demo.state?.memberships.filter((m) => m.clubId === clubId) ?? [];
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-2xl">Members</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Fictional demo directory. Real invitations and access changes are
        available outside Demo Mode.
      </p>
      <ul className="divide-y">
        {members.map((m) => {
          const u = demo.state!.students.find((u) => u.id === m.userId)!;
          return (
            <li className="py-4" key={m.id}>
              <p className="font-medium">
                {u.profile.firstName} {u.profile.lastName}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.groups.join(" · ")}
                {m.cohort ? ` · ${m.cohort}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function DemoProfile({ clubId }: { clubId: string }) {
  const demo = useDemoMode(),
    club = demo.state!.clubs.find((c) => c.id === clubId)!,
    [saved, setSaved] = useState(false);
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        demoStore.mutate((s) => {
          if (clubId !== s.clubs[0].id)
            throw new Error("Demo management is limited to MII.");
          const c = s.clubs[0];
          c.description = String(form.get("description"));
        });
        setSaved(true);
      }}
    >
      <h2 className="font-display text-2xl">Club profile</h2>
      <p className="text-sm text-muted-foreground">
        Sample changes stay on this device.
      </p>
      <label className="block text-sm">
        Description
        <textarea
          name="description"
          className="mt-1 min-h-40 w-full rounded border bg-card p-3"
          maxLength={10000}
          defaultValue={club.description}
        />
      </label>
      <Button>Save demo profile</Button>
      {saved && (
        <p role="status" className="text-sm">
          Saved on this device.
        </p>
      )}
    </form>
  );
}
