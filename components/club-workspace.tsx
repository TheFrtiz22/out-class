"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductShell } from "@/components/shell/product-shell";
import { managerNavigation } from "@/lib/product-navigation";
import { ScreeningDashboardView } from "@/components/views/screening-dashboard-view";
import { BroadcastMessagesView } from "@/components/views/club-manager/broadcast-messages-view";
import type { ViewId } from "@/lib/views";
import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { demoStore } from "@/lib/demo/store";
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>;
const when = (date: Date) =>
  new Date(date).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const active = mode === "recruiting" ? tool || "applicants" : section;
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
        items={nav} active={active} title={nav.find(n => n.id === active)?.label || "Club workspace"} onSelect={() => {}} onNavigate={navigate}>
        {loading || needsSelection ? <p role="status">Opening club workspace…</p> : !membership ? <div className="space-y-4"><h1 className="font-display text-3xl">Club workspace unavailable</h1><p>Sign in with a current club membership to access this workspace.</p><Link href="/" className="underline">Return to OutClass</Link></div> : <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{membership.club.name}</p><h1 className="font-display text-3xl sm:text-4xl">{nav.find(n => n.id === active)?.label || "Workspace"}</h1></div><Link className="text-sm text-muted-foreground underline underline-offset-4" href={`/club/${clubId}`}>Public club profile ↗</Link></div>
          {error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : !current ? <p role="status">Loading club activity…</p> : !allowed ? <p role="alert">This section isn’t available with your current access.</p> : <section key={`${section}:${active}`} className="shell-content-enter" aria-label={nav.find(n => n.id === active)?.label}>
            {section === "overview" && <WorkspaceOverview data={current} />}
            {section === "tasks" && <ClubTasks clubId={clubId} embedded initialScope={taskView === "team" ? "team" : "mine"} />}
            {section === "meetings" && <MeetingList clubId={clubId} embedded initialAudience={hasPermission(current.membership, "meetings.manage") ? "ALL" : "MEMBERS"} />}
            {section === "members" && (demo.isDemoEnabled ? <DemoMembers clubId={clubId} /> : <ClubWorkspaceSettings section="members" />)}
            {section === "settings" && (demo.isDemoEnabled ? <DemoProfile clubId={clubId} /> : <ClubWorkspaceSettings section="settings" />)}
            {section === "announcements" && <><PreviewNotice /><BroadcastMessagesView /></>}
            {section === "recruitment" && (active === "overview" ? <div className="max-w-3xl"><p className="mb-6 text-muted-foreground">Review applications, prepare interviews, and record decisions.</p><ul className="divide-y border-y">{nav.filter(n => n.id !== "overview").map(n => <li key={n.id}><Link className="flex min-h-14 items-center justify-between py-4 text-sm" href={n.href!}>{n.label}<span className="text-muted-foreground">{n.preview ? "Local preview · " : ""}→</span></Link></li>)}</ul></div> : active === "rounds" ? <RoundSettings clubId={clubId} /> : active === "rules" ? <><PreviewNotice /><ScreeningDashboardView /></> : active === "interviews" ? <div className="space-y-8">{hasPermission(current.membership, "applications.review") && <div className="border-b pb-6"><p className="mb-4 text-sm text-muted-foreground">Open your round’s candidate queue to take notes and complete reviews.</p><Button onClick={() => setInterviewMode(true)}>Enter interview mode</Button></div>}{hasPermission(current.membership, "interviews.manage") && <RecruitmentWorkspace clubId={clubId} member={current.membership} onInterview={() => setInterviewMode(true)} initialTool="kits" />}</div> : <><p className="mb-5 text-sm text-muted-foreground">{active === "decisions" ? "Review candidates and record outcomes. Voting mode opens the existing board decision workflow; changes do not send email." : "Review submitted applications and move candidates through your club’s rounds."}</p><LiveLeaderWorkspace scoped /></>)}
          </section>}
        </>}
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

function WorkspaceOverview({ data }: { data: Overview }) {
  const { club, meeting, work, awaitingReview, recruitment } = data;
  const inReview =
    recruitment
      ?.filter((r) => ["SUBMITTED", "IN_REVIEW"].includes(r.status))
      .reduce((n, r) => n + r.count, 0) ?? 0;
  const interviews =
    recruitment?.find((r) => r.status === "INTERVIEWING")?.count ?? 0;
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="font-display text-2xl">What needs attention</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The next meeting, your outstanding work, and actions available to you.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Your next steps</h3>
            <Link
              className="text-sm underline"
              href={clubWorkspaceHref(club.id, "tasks")}
            >
              All tasks
            </Link>
          </div>
          {work.length ? (
            <ul className="divide-y border-y">
              {work.map((w) => (
                <li className="py-4" key={w.id}>
                  <Link
                    href={clubWorkspaceHref(club.id, "tasks")}
                    className="block rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <p className="font-medium">{w.task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {w.task.dueAt
                        ? `${+new Date(w.task.dueAt) < Date.now() ? "Overdue · " : "Due "}${when(w.task.dueAt)}`
                        : "No deadline"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t py-6 text-sm text-muted-foreground">
              No outstanding assignments. Submitted work is available in Tasks.
            </p>
          )}
          {awaitingReview !== null && awaitingReview > 0 && (
            <Link
              className="block border-t py-4 text-sm underline underline-offset-4"
              href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=team`}
            >
              {awaitingReview} submission{awaitingReview === 1 ? "" : "s"}{" "}
              waiting for review →
            </Link>
          )}
        </section>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Next meeting</h3>
            <Link
              className="text-sm underline"
              href={clubWorkspaceHref(club.id, "meetings")}
            >
              Meetings
            </Link>
          </div>
          {meeting ? (
            <Link
              className="block border-t py-5"
              href={`/meetings/${meeting.id}`}
            >
              <p className="text-xs text-muted-foreground">
                {meeting.audience === "MEMBERS"
                  ? "Members"
                  : "Recruitment / Interest"}
              </p>
              <h4 className="mt-2 text-lg font-medium">{meeting.title}</h4>
              <p className="mt-2 text-sm">{when(meeting.date)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {meeting.location}
              </p>
              <span className="mt-4 block text-sm underline">
                Agenda & resources →
              </span>
            </Link>
          ) : (
            <p className="border-t py-6 text-sm text-muted-foreground">
              No upcoming meetings. Past agendas and recaps remain available in
              Meetings.
            </p>
          )}
        </section>
      </div>
      {recruitment !== null && (
        <section className="border-t pt-6">
          <h3 className="font-semibold">Recruitment</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {inReview} applications awaiting review · {interviews} at interview
            stage
            {!hasPermission(data.membership, "applicants.identify")
              ? " · Anonymous rounds only"
              : ""}
          </p>
          <Link
            className="mt-4 inline-block text-sm underline underline-offset-4"
            href={clubWorkspaceHref(club.id, "recruitment")}
          >
            Open recruitment →
          </Link>
        </section>
      )}
    </div>
  );
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
function RoundSettings({ clubId }: { clubId: string }) {
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
      <ol className="divide-y">
        {rounds.map((r, i) => (
          <li className="py-3 text-sm" key={r.id}>
            {i + 1}. {r.name} ·{" "}
            {r.anonymousReview ? "Anonymous review" : "Identified review"}
          </li>
        ))}
      </ol>
      {!rounds.length && (
        <p className="text-sm text-muted-foreground">
          No recruitment rounds are configured yet.
        </p>
      )}
      <RecruitmentReviewSettings
        clubId={clubId}
        rounds={rounds}
        onChanged={() => setRevision((n) => n + 1)}
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
