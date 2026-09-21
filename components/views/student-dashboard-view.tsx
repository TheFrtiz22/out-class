"use client"

import { CalendarDays, FileText, Clock3, Plus, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ClubLogo } from "@/components/club-logo"
import { applications as seedApplications, currentStudent, type Application as DataApplication, type TrackedApplication, type ClubEvent } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import { eventStart } from "@/lib/calendar"
import type { ViewId } from "@/lib/views"
import { useAuth, type ExtendedApplication } from "@/contexts/auth-context"

const primaryButton = "bg-[#ea580c] font-semibold text-white shadow-none hover:bg-[#c2410c]"

export type DashboardApp = {
  id: string;
  clubId: string;
  clubName: string;
  logoText: string;
  color: string;
  stage: string;
  essaysTotal?: number;
  essaysWritten?: number;
  deadline?: string;
  submitted: string;
  status?: string;
  outcome?: string;
  nextStep?: string;
  logoUrl?: string | null;
};

function applicationStatus(app: { status?: string; outcome?: string; stage?: string }) {
  if (app.status === "ACCEPTED") return { label: "Accepted", style: "bg-emerald-50 text-emerald-800" }
  if (app.status === "REJECTED") return { label: "Rejected", style: "bg-red-50 text-red-800" }
  if (app.status === "INTERVIEWING") return { label: "Interview", style: "bg-violet-50 text-violet-800" }
  if (app.status === "IN_REVIEW") return { label: "In review", style: "bg-amber-50 text-amber-800" }
  if (app.status === "WAITLISTED") return { label: "Waitlisted", style: "bg-sky-50 text-sky-800" }
  if (app.outcome) return { label: app.outcome, style: app.outcome === "Accepted" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800" }
  if (app.stage === "Round 1" || app.stage === "Round 2") return { label: "Interview", style: "bg-violet-50 text-violet-800" }
  if (app.stage === "Decision") return { label: "Awaiting decision", style: "bg-sky-50 text-sky-800" }
  return { label: app.status || "In review", style: "bg-amber-50 text-amber-800" }
}

function ApplicationProgressCell({ app }: { app: { status?: string; outcome?: string; stage?: string } }) {
  const fallback = applicationStatus(app)
  const label = fallback.label
  return <td className="px-5 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${fallback.style}`}>{label}</span></td>
}

export function StudentDashboardView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { focusApplication, events, focusEvent, trackedApps } = useApplicationState()
  const { user } = useAuth()
  
  // Fallback to mock data if not logged in (demo mode)
  const applications: DashboardApp[] = user?.applications ? user.applications.map((app: ExtendedApplication) => ({
    id: app.id,
    clubId: app.clubId,
    clubName: app.club.name,
    logoText: app.club.name.substring(0, 2),
    color: app.club.color || "#000",
    stage: app.status === "DRAFTING" ? "Draft" : "Applied",
    essaysTotal: 100, 
    essaysWritten: app.status === "DRAFTING" ? 50 : 100, 
    deadline: "Deadline not announced",
    submitted: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—",
    status: app.status
  })) : trackedApps.map((app: TrackedApplication) => {
    const seed = seedApplications.find((item: DataApplication) => item.clubId === app.clubId)
    const deadline = events.find((event: ClubEvent) => event.clubId === app.clubId && event.type === "Deadline")
    return { 
      id: app.id, clubId: app.clubId, clubName: app.clubName, logoText: app.logoText, color: app.color,
      stage: app.status === "Drafting" ? "Draft" : app.status === "1st Round Interview" ? "Round 1" : "Applied",
      essaysTotal: app.questionsTotal, essaysWritten: app.questionsCompleted,
      deadline: deadline ? `Due ${deadline.date}` : "Deadline not announced", nextStep: app.nextDeadline, submitted: seed?.submitted ?? "—",
      status: app.status, outcome: seed?.outcome, logoUrl: seed?.logoUrl
    }
  })

  const upcomingInterviews = user?.applications 
    ? [] // Real interview bookings would be mapped here in the future
    : events.filter((event) => event.type === "Interview" && event.response !== "declined" && eventStart(event) >= new Date()).sort((a,b) => eventStart(a).getTime() - eventStart(b).getTime())
  
  const drafts = applications.filter((app: DashboardApp) => app.stage === "Draft")
  const submitted = applications.filter((app: DashboardApp) => app.stage !== "Draft")
  const metrics = [
    { label: "Applications", count: submitted.length, description: "Submitted applications", icon: FileText },
    { label: "In review", count: user?.applications ? submitted.filter((app: DashboardApp) => app.status === "IN_REVIEW").length : submitted.filter((app: DashboardApp) => !app.outcome).length, description: "Awaiting a final decision", icon: Clock3 },
    { label: "Upcoming interviews", count: upcomingInterviews.length, description: "Applications in interview rounds", icon: CalendarDays },
  ]
  function openApplication(app: DashboardApp) {
    focusApplication(app.clubId)
    onNavigate("tracker")
  }

  const firstName = user?.profile?.firstName || currentStudent.name.split(" ")[0]

  return (
    <div className="space-y-8 font-sans text-neutral-900">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Your next chapter starts here, {firstName}.</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500 sm:text-base">Big ambitions. One application. Let&apos;s find your people.</p>
        </div>
        <Button onClick={() => onNavigate("discover")} className={`${primaryButton} shrink-0 self-start sm:self-auto`}>Explore clubs <Plus className="size-4" /></Button>
      </section>

      <section aria-label="Application overview" className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, count, description, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-neutral-600">{label}<Icon className="size-4 text-neutral-400" aria-hidden="true" /></div>
            <p className="mt-5 text-4xl font-semibold tracking-tight tabular-nums">{String(count).padStart(2, "0")}</p>
            <p className="mt-2 text-xs text-neutral-500">{description}</p>
          </div>
        ))}
      </section>

      {upcomingInterviews.length > 0 && <section className="space-y-3" aria-label="Upcoming interviews">
        <h2 className="text-xl font-semibold">Upcoming interviews</h2>
        {upcomingInterviews.slice(0, 3).map((event) => <button key={event.id} type="button" className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-4 text-left hover:bg-neutral-50" onClick={() => { focusEvent(event.id); onNavigate("calendar") }}><span className="font-medium">{event.title}</span><span className="text-sm text-neutral-500">{event.date} · {event.time}</span></button>)}
      </section>}

      <section aria-labelledby="drafts-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 id="drafts-heading" className="text-xl font-semibold tracking-tight">Drafts in Progress</h2><p className="mt-1 text-sm text-neutral-500">Pick up where you left off.</p></div>
          <Button variant="ghost" onClick={() => onNavigate("discover")}>Browse clubs <ArrowUpRight className="size-4" /></Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((app) => {
            const total = app.essaysTotal ?? 0
            const completed = Math.min(total, Math.max(0, app.essaysWritten ?? 0))
            const percent = total > 0 ? Math.floor(completed / total * 100) : 0
            return (
              <article key={app.id} className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <ClubLogo clubId={app.clubId} logoUrl={app.logoUrl ?? (app.clubId === "vvf" ? "/logos/vvf.webp" : undefined)} text={app.logoText} color={app.color} />
                  <div className="min-w-0"><h3 className="text-sm font-semibold tracking-tight">{app.clubName}</h3>{app.deadline && <p className="mt-1 text-xs font-medium text-red-600">{app.deadline}</p>}</div>
                </div>
                <div className="mt-auto space-y-2">
                  <Progress value={percent} aria-label={`${app.clubName} completion`} className="h-2 bg-neutral-100 [&_[data-slot=progress-indicator]]:bg-[#ea580c]" />
                  <p className="text-xs text-neutral-500">{percent}% Complete · {completed} of {total} essays written</p>
                </div>
                <Button className={`${primaryButton} w-full`} onClick={() => openApplication(app)}>Continue Application</Button>
              </article>
            )
          })}
        </div>
        {drafts.length === 0 && <p className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500">No drafts in progress. Explore clubs to start an application.</p>}
      </section>

      <section aria-labelledby="applications-heading" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <h2 id="applications-heading" className="text-xl font-semibold tracking-tight">My applications <span className="ml-2 text-sm font-medium text-neutral-400">{submitted.length}</span></h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("tracker")}>View all <ArrowUpRight className="size-4" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500"><tr><th scope="col" className="px-5 py-3 font-medium">Club Name</th><th scope="col" className="px-5 py-3 font-medium">Status</th><th scope="col" className="px-5 py-3 font-medium">Last Updated</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {submitted.map((app) => {
                return <tr key={app.id} className="hover:bg-neutral-50"><td className="px-5 py-4"><button onClick={() => openApplication(app)} className="flex items-center gap-3 text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" aria-label={`View application to ${app.clubName}`}><ClubLogo clubId={app.clubId} logoUrl={app.logoUrl} text={app.logoText} color={app.color} size="sm" />{app.clubName}</button></td><ApplicationProgressCell app={app} /><td className="px-5 py-4 text-neutral-500"><span title="Submission date; no later update recorded">{app.submitted}</span></td></tr>
              })}
              {submitted.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-neutral-500">Your submitted applications will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
