"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, CalendarDays, Check, ClipboardList, Clock3, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export interface InterviewCandidate {
  id: string
  name: string
  year: string
  major: string
  photoUrl?: string
  gpa: string
  bio: string
  experience: string[]
  skills: string[]
}

export interface AssignedInterview {
  id: string
  startsAt: string
  endsAt: string
  location: string
  meetingUrl?: string
  round: string
  evaluationStatus: "not-started" | "draft" | "submitted"
  candidate: InterviewCandidate
}

export interface InterviewerAvailability {
  startsAt: string
  endsAt: string
}

/** Fixed demo clock makes the completed and overdue examples reproducible. */
export const mockInterviewerNow = "2026-09-20T13:00:00-04:00"
export const mockInterviewerSchedule: AssignedInterview[] = [
  {
    id: "slot-maya", startsAt: "2026-09-20T10:00:00-04:00", endsAt: "2026-09-20T10:30:00-04:00",
    location: "Rouss Hall 101", round: "Behavioral Round", evaluationStatus: "submitted",
    candidate: { id: "maya", name: "Maya Patel", year: "Second year", major: "Economics", gpa: "3.86", bio: "Interested in early-stage investing and community entrepreneurship.", experience: ["Analyst, student investment fund", "Volunteer, Charlottesville business incubator"], skills: ["Research", "Financial modeling"] },
  },
  {
    id: "slot-alex", startsAt: "2026-09-20T11:00:00-04:00", endsAt: "2026-09-20T11:30:00-04:00",
    location: "Rouss Hall 101", round: "Behavioral Round", evaluationStatus: "draft",
    candidate: { id: "alex", name: "Alex Johnson", year: "First year", major: "Commerce", gpa: "3.78", bio: "Enjoys working with small teams to turn research into practical business ideas.", experience: ["Founder, campus resale project", "Summer intern, local credit union"], skills: ["Market research", "Presentation"] },
  },
  {
    id: "slot-jordan", startsAt: "2026-09-20T14:00:00-04:00", endsAt: "2026-09-20T14:30:00-04:00",
    location: "Rouss Hall 101", round: "Behavioral Round", evaluationStatus: "not-started",
    candidate: { id: "jordan", name: "Jordan Lee", year: "Second year", major: "Computer Science", gpa: "3.92", bio: "Builds software tools and wants to explore the intersection of technology and venture capital.", experience: ["Developer, student product studio", "Teaching assistant, introductory programming"], skills: ["Python", "Product design"] },
  },
  {
    id: "slot-sofia", startsAt: "2026-09-20T15:00:00-04:00", endsAt: "2026-09-20T15:30:00-04:00",
    location: "Rouss Hall 102", round: "Behavioral Round", evaluationStatus: "not-started",
    candidate: { id: "sofia", name: "Sofia Martinez", year: "Third year", major: "Public Policy", gpa: "3.89", bio: "Studies how policy and capital can help grow sustainable businesses.", experience: ["Research assistant, sustainability lab", "Operations intern, social enterprise"], skills: ["Data analysis", "Public speaking"] },
  },
]
export const mockInterviewerAvailability: InterviewerAvailability[] = [
  { startsAt: "2026-09-21T14:00:00-04:00", endsAt: "2026-09-21T16:00:00-04:00" },
]

export interface InterviewerDashboardProps {
  interviewerName?: string
  schedule?: AssignedInterview[]
  availability?: InterviewerAvailability[]
  /** Omit for the live clock; pass mockInterviewerNow for the sample schedule. */
  now?: string
  timeZone?: string
  needsRoundTwoAvailability?: boolean
  onOpenWorkspace: (slot: AssignedInterview) => void
  onProvideAvailability: () => void
}

const primaryButton = "bg-black text-white shadow-none hover:bg-neutral-800"
const card = "rounded-xl border border-neutral-200 bg-white"

function CandidateAvatar({ candidate }: { candidate: InterviewCandidate }) {
  return <Avatar className="size-11 shrink-0 border border-neutral-200">
    {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} />}
    <AvatarFallback className="bg-neutral-100 font-sans text-sm font-semibold text-neutral-700">{candidate.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</AvatarFallback>
  </Avatar>
}

function CandidateProfile({ candidate }: { candidate: InterviewCandidate }) {
  return <Dialog>
    <DialogTrigger asChild><button type="button" className="mt-2 rounded-sm text-xs font-medium underline underline-offset-4 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={`View profile for ${candidate.name}`}>View Profile</button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto border-neutral-200 bg-white font-sans text-neutral-900 shadow-none">
      <DialogHeader>
        <CandidateAvatar candidate={candidate} />
        <DialogTitle className="text-xl font-semibold tracking-tight">{candidate.name}</DialogTitle>
        <DialogDescription>{candidate.year} · {candidate.major} · GPA {candidate.gpa}</DialogDescription>
      </DialogHeader>
      <p className="text-sm leading-relaxed text-neutral-600">{candidate.bio}</p>
      <div><h3 className="text-sm font-semibold tracking-tight">Resume highlights</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-neutral-600">{candidate.experience.map(item => <li key={item}>{item}</li>)}</ul></div>
      <div><h3 className="text-sm font-semibold tracking-tight">Skills</h3><div className="mt-2 flex flex-wrap gap-2">{candidate.skills.map(skill => <span key={skill} className="rounded-full border border-neutral-200 px-3 py-1 text-xs">{skill}</span>)}</div></div>
    </DialogContent>
  </Dialog>
}

export function InterviewerDashboard({
  interviewerName = "Sarah", schedule = mockInterviewerSchedule,
  availability = mockInterviewerAvailability, now, timeZone = "America/New_York",
  needsRoundTwoAvailability = true, onOpenWorkspace, onProvideAvailability,
}: InterviewerDashboardProps) {
  const [liveNow, setLiveNow] = useState<Date | null>(null)
  useEffect(() => {
    if (now) return
    setLiveNow(new Date())
    const timer = setInterval(() => setLiveNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [now])
  const current = now ? new Date(now) : liveNow
  if (!current) return <p role="status" className="font-sans text-sm text-neutral-500">Loading your itinerary…</p>
  const day = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
  const time = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value))
  const date = (value: string | Date) => new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" }).format(new Date(value))
  const range = (slot: InterviewerAvailability) => `${time(slot.startsAt)} – ${time(slot.endsAt)}`
  const today = schedule.filter(slot => day(slot.startsAt) === day(current)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  // Include unfinished interviews from earlier days so overdue feedback is never hidden.
  const pending = schedule.filter(slot => Date.parse(slot.endsAt) <= current.getTime() && slot.evaluationStatus !== "submitted").sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
  const nextAvailability = availability.filter(block => Date.parse(block.startsAt) > current.getTime()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(current))
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return <div className="space-y-8 font-sans text-neutral-900">
    <header>
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Interviewer Hub</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}, {interviewerName.split(" ")[0]}.</h1>
      <p className="mt-3 text-sm text-neutral-500 sm:text-base">You have {today.length} {today.length === 1 ? "interview" : "interviews"} today. Here&apos;s your day at a glance.</p>
    </header>
    <section aria-label="Interview overview" className="grid gap-4 sm:grid-cols-3">
      <div className={`${card} p-6`}><div className="flex items-center justify-between text-sm font-medium text-neutral-600">Interviews Today<CalendarDays className="size-4 text-neutral-400" aria-hidden="true" /></div><p className="mt-5 text-4xl font-semibold tracking-tight tabular-nums">{today.length}</p><p className="mt-2 text-xs text-neutral-500">{date(current)}</p></div>
      <div className={`${card} p-6`}><div className="flex items-center justify-between text-sm font-medium text-neutral-600">Pending Evaluations<ClipboardList className="size-4 text-neutral-400" aria-hidden="true" /></div><p className={`mt-5 text-4xl font-semibold tracking-tight tabular-nums ${pending.length ? "text-amber-700" : ""}`}>{pending.length}</p><p className={`mt-2 text-xs ${pending.length ? "font-medium text-amber-700" : "text-neutral-500"}`}>{pending.length ? "Needs attention · feedback not submitted" : "All caught up on feedback"}</p></div>
      <div className={`${card} p-6`}><div className="flex items-center justify-between text-sm font-medium text-neutral-600">Upcoming Availability<Clock3 className="size-4 text-neutral-400" aria-hidden="true" /></div><p className="mt-5 text-xl font-semibold tracking-tight">{nextAvailability ? date(nextAvailability.startsAt) : "No upcoming blocks"}</p><p className="mt-2 text-xs text-neutral-500">{nextAvailability ? range(nextAvailability) : "Submit a free block to get scheduled"}</p></div>
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section aria-labelledby="itinerary-heading" className={card}>
        <div className="border-b border-neutral-200 p-5 sm:p-6"><h2 id="itinerary-heading" className="text-xl font-semibold tracking-tight">Today&apos;s itinerary</h2><p className="mt-1 text-xs text-neutral-500">{date(current)} · All times in {timeZone}</p></div>
        <ol className="divide-y divide-neutral-200">{today.map(slot => {
          const completed = Date.parse(slot.endsAt) <= current.getTime() && slot.evaluationStatus === "submitted"
          const overdue = pending.some(item => item.id === slot.id)
          return <li key={slot.id} className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2"><p className="text-sm font-semibold tabular-nums"><time dateTime={slot.startsAt}>{time(slot.startsAt)}</time> – <time dateTime={slot.endsAt}>{time(slot.endsAt)}</time></p><span className="flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="size-3.5" aria-hidden="true" />{slot.meetingUrl ? <a href={slot.meetingUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{slot.location}</a> : slot.location}</span></div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3"><CandidateAvatar candidate={slot.candidate} /><div><h3 className="text-sm font-semibold tracking-tight">{slot.candidate.name}</h3><p className="mt-1 text-xs text-neutral-500">{slot.candidate.year} · {slot.candidate.major}</p><CandidateProfile candidate={slot.candidate} /></div></div>
              <Button disabled={completed} onClick={() => onOpenWorkspace(slot)} className={`${completed ? "border border-neutral-200 bg-white text-neutral-500 shadow-none disabled:opacity-100" : primaryButton} shrink-0`} aria-label={completed ? `${slot.candidate.name}: completed` : `Open Live Workspace for ${slot.candidate.name}`}>
                {completed ? <><Check className="size-4" />Completed</> : <>Open Live Workspace<ArrowUpRight className="size-4" /></>}
              </Button>
            </div><p className="mt-4 text-xs text-neutral-500">{slot.round}{overdue && <span className="ml-2 font-medium text-amber-700">· Evaluation due</span>}</p>
          </li>
        })}</ol>
        {today.length === 0 && <p className="p-6 text-sm text-neutral-500">No interviews assigned today. You&apos;re all clear.</p>}
      </section>
      <section aria-labelledby="tasks-heading" className={card}>
        <div className="border-b border-neutral-200 p-5"><h2 id="tasks-heading" className="text-xl font-semibold tracking-tight">Action items <span className="ml-1 text-sm text-neutral-400">{pending.length + Number(needsRoundTwoAvailability)}</span></h2><p className="mt-1 text-xs text-neutral-500">A few things to keep recruitment moving.</p></div>
        <ul className="divide-y divide-neutral-200">{pending.map(slot => <li key={slot.id} className="p-5"><p className="text-sm font-medium">Submit feedback for {slot.candidate.name}</p><p className="mt-1 text-xs text-neutral-500">{slot.round} · {date(slot.startsAt)}</p><Button variant="outline" className="mt-4 border-neutral-200 bg-white shadow-none" onClick={() => onOpenWorkspace(slot)}>Finish evaluation<ArrowUpRight className="size-4" /></Button></li>)}
          {needsRoundTwoAvailability && <li className="p-5"><p className="text-sm font-medium">Provide availability for Round 2</p><p className="mt-1 text-xs leading-relaxed text-neutral-500">Share your free blocks so the team can assign your next interviews.</p><Button variant="outline" className="mt-4 border-neutral-200 bg-white shadow-none" onClick={onProvideAvailability}>Add availability<ArrowUpRight className="size-4" /></Button></li>}
        </ul>{pending.length === 0 && !needsRoundTwoAvailability && <p className="p-5 text-sm text-neutral-500">You&apos;re all caught up. No action needed.</p>}
      </section>
    </div>
  </div>
}
