"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission, hasWorkspace } from "@/lib/permissions";
import {
  clubSectionLabels,
  clubWorkspaceHref,
  clubWorkspaceSections,
  recruitmentTools,
  type ClubSection,
} from "@/lib/club-workspace";
import {
  getClubWorkspaceOverview,
  getWorkspaceRounds,
} from "@/lib/workspace-api";
import { ApplicationStateProvider } from "@/lib/application-state";
import { ClubWorkspaceSwitcher } from "@/components/club-workspace-switcher";
import { ClubWorkspaceSettings } from "@/components/club-workspace-settings";
import { ClubTasks } from "@/components/club-tasks";
import { MeetingList } from "@/components/meeting-workspace";
import { LiveLeaderWorkspace } from "@/components/views/leader-dashboard/live-leader-workspace";
import { InterviewWorkspaceView } from "@/components/views/interview-workspace-view";
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { InterviewSchedulerView } from "@/components/views/interview-scheduler-view";
import { DemoInterviewSchedule } from "@/components/demo-workspace";
import { OutClassLogo } from "@/components/outclass-logo";
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
}: {
  clubId: string;
  section: string;
  taskView?: string;
}) {
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
  const sections = clubWorkspaceSections(data?.membership),
    allowed = sections.includes(section as ClubSection);
  return (
    <ApplicationStateProvider
      initialData={{ applications: [], attendances: [] }}
      persistLocalState={false}
    >
      {interviewMode &&
      data &&
      hasPermission(data.membership, "applications.review") ? (
        <InterviewWorkspaceView scoped onExit={() => setInterviewMode(false)} />
      ) : (
        <div className="min-h-svh bg-background">
          <header className="border-b bg-card">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <Link href="/" aria-label="OutClass home">
                <OutClassLogo variant="light" className="h-9 w-auto" />
              </Link>
              <div className="w-full max-w-sm sm:w-80">
                <ClubWorkspaceSwitcher clubId={clubId} />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 sm:py-10">
            {loading || needsSelection ? (
              <p role="status">Opening club workspace…</p>
            ) : !membership ? (
              <div className="space-y-4 py-12">
                <h1 className="font-display text-3xl">
                  Club workspace unavailable
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in with a current club membership to access this
                  workspace.
                </p>
                <Link className="underline" href="/">
                  Return to OutClass
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {hasWorkspace(membership)
                        ? "Club workspace"
                        : "Member workspace"}
                    </p>
                    <h1 className="mt-2 font-display text-3xl sm:text-4xl">
                      {data?.club.name ?? membership.club.name}
                    </h1>
                  </div>
                  <Link
                    className="text-sm underline underline-offset-4"
                    href={`/club/${clubId}`}
                  >
                    Public club profile ↗
                  </Link>
                </div>
                {error ? (
                  <div role="alert" className="space-y-3 border-y py-6">
                    <p>{error}</p>
                    <Button
                      variant="outline"
                      onClick={() => setRetry((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : !data ? (
                  <p role="status">Loading club activity…</p>
                ) : (
                  <>
                    <nav
                      aria-label="Club sections"
                      className="mb-8 flex flex-wrap gap-x-5 gap-y-1 border-b"
                    >
                      {sections.map((item) => (
                        <Link
                          key={item}
                          href={clubWorkspaceHref(clubId, item)}
                          aria-current={section === item ? "page" : undefined}
                          className={`min-h-11 border-b-2 px-1 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${section === item ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                        >
                          {clubSectionLabels[item]}
                        </Link>
                      ))}
                    </nav>
                    {!allowed ? (
                      <div className="space-y-3">
                        <h2 className="text-xl font-semibold">
                          This section isn&#39;t available with your current access.
                        </h2>
                        <Link
                          href={clubWorkspaceHref(clubId)}
                          className="underline"
                        >
                          Go to overview
                        </Link>
                      </div>
                    ) : (
                      <section
                        key={section}
                        className="shell-content-enter"
                        aria-label={clubSectionLabels[section as ClubSection]}
                      >
                        {section === "overview" && (
                          <WorkspaceOverview data={data} />
                        )}
                        {section === "tasks" && (
                          <ClubTasks
                            clubId={clubId}
                            embedded
                            initialScope={taskView === "team" ? "team" : "mine"}
                          />
                        )}
                        {section === "meetings" && (
                          <MeetingList
                            clubId={clubId}
                            embedded
                            initialAudience={
                              hasPermission(data.membership, "meetings.manage")
                                ? "ALL"
                                : "MEMBERS"
                            }
                          />
                        )}
                        {section === "members" &&
                          (demo.isDemoEnabled ? (
                            <DemoMembers clubId={clubId} />
                          ) : (
                            <ClubWorkspaceSettings section="members" />
                          ))}
                        {section === "settings" &&
                          (demo.isDemoEnabled ? (
                            <DemoProfile clubId={clubId} />
                          ) : (
                            <ClubWorkspaceSettings section="settings" />
                          ))}
                        {section === "recruitment" && (
                          <RecruitmentWorkspace
                            clubId={clubId}
                            member={data.membership}
                            onInterview={() => setInterviewMode(true)}
                          />
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </ApplicationStateProvider>
  );
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
}: {
  clubId: string;
  member: Overview["membership"];
  onInterview: () => void;
}) {
  const demo = useDemoMode(),
    tools = recruitmentTools(member),
    [tool, setTool] = useState(tools[0]?.id ?? "applicants");
  const active = tools.find((t) => t.id === tool)?.id ?? tools[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
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
