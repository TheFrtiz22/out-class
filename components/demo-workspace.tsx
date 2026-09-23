"use client"
import { useState } from "react"
import { useDemoMode } from "@/contexts/demo-context"
import { demoStore } from "@/lib/demo/store"
import { useApplicationState } from "@/lib/application-state"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ViewId } from "@/lib/views"

export function DemoRoundTarget() {
  const { state, isDemoEnabled } = useDemoMode()
  if (!isDemoEnabled || !state || state.perspective.role !== "leader") return null
  const club = state.clubs.find((c) => c.id === state.perspective.clubId)!,
    accepted = state.applications.filter(
      (a) => a.clubId === club.id && a.status === "ACCEPTED",
    ).length
  return (
    <section
      className="max-w-lg space-y-2 border-b border-border pb-5"
      aria-label="Sample offer target"
    >
      <div className="flex justify-between text-sm">
        <span>Demo Mode · sample offer target · {club.name}</span>
        <span>
          {accepted} / {club.target}
        </span>
      </div>
      <Progress
        value={Math.min(100, (accepted / club.target) * 100)}
        aria-label="Progress toward sample offer target"
      />
      <p className="text-xs text-muted-foreground">
        Illustrative target; decisions are never automatic.
      </p>
    </section>
  )
}
export function DemoInterviewGuide() {
  const { state, isDemoEnabled } = useDemoMode()
  if (!isDemoEnabled || !state) return null
  const club = state.clubs.find((c) => c.id === state.perspective.clubId)!
  return (
    <details className="mx-5 my-4 rounded-md border border-border p-4 sm:mx-8">
      <summary className="cursor-pointer text-sm font-medium">
        Demo Mode · {club.name} interview guide
      </summary>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        {club.interviewQuestions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Sample rubric: reasoning, evidence, collaboration and reflection. Use the existing overall
        1–10 score: 1–3 developing, 4–6 promising, 7–8 strong, 9–10 exceptional. This guide does not
        claim a real club’s rubric.
      </p>
    </details>
  )
}
export function DemoClubSettings() {
  const { state } = useDemoMode()
  if (!state) return null
  const club = state.clubs.find((c) => c.id === state.perspective.clubId)!
  return (
    <div className="space-y-9">
      <div>
        <h2 className="font-display text-2xl">{club.name}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {club.description}
        </p>
      </div>
      <DemoRoundTarget />
      <section>
        <h3 className="mb-4 text-lg font-semibold">Application questions</h3>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {club.questions.map((q) => (
            <li key={q.id}>
              {q.prompt}
              <span className="ml-2 text-xs text-muted-foreground">
                {q.wordLimit} words · {q.required ? "Required" : "Optional"}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="mb-4 text-lg font-semibold">Recruitment rounds</h3>
        <p className="text-sm leading-7">{club.rounds.map((r) => r.name).join(" → ")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sample deadline: {club.deadline.toLocaleString()}
        </p>
      </section>
      <section>
        <h3 className="text-lg font-semibold">Fictional member directory</h3>
        <ul className="mt-4 divide-y divide-border">
          {state.memberships
            .filter((m) => m.clubId === club.id)
            .map((m) => {
              const p = state.students.find((s) => s.id === m.userId)!
              return (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                  <span>
                    {p.profile.firstName} {p.profile.lastName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.profile.major} · {p.profile.gradYear}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.role.replaceAll("_", " ")}
                  </span>
                </li>
              )
            })}
        </ul>
      </section>
    </div>
  )
}
export function DemoInterviewSchedule({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { state } = useDemoMode(),
    { focusLeader } = useApplicationState()
  const [error, setError] = useState("")
  if (!state) return null
  const clubId = state.perspective.clubId,
    club = state.clubs.find((c) => c.id === clubId)!
  const applications = state.applications.filter(
    (a) => a.clubId === clubId && !["DRAFTING", "ACCEPTED", "REJECTED"].includes(a.status),
  )
  function assign(slotId: string, applicationId: string) {
    try {
      demoStore.mutate((s) => {
        const slot = s.slots.find((i) => i.id === slotId && i.clubId === clubId)!
        if (applicationId && !applications.some((a) => a.id === applicationId))
          throw new Error("Applicant unavailable")
        if (
          applicationId &&
          s.slots.some((i) => i.id !== slotId && i.applicationId === applicationId)
        )
          throw new Error(
            "This applicant already has a scheduled interview. Release that slot first.",
          )
        slot.applicationId = applicationId || null
        if (applicationId) {
          const a = s.applications.find((a) => a.id === applicationId)!
          a.status = "INTERVIEWING"
          a.roundId = club.rounds.find((r) => r.name === "Interview")!.id
        }
      })
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save")
    }
  }
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">{club.name} interview agenda</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sample availability · assigning a slot updates the same application and student calendar.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border border-y border-border">
        {state.slots
          .filter((s) => s.clubId === clubId)
          .map((slot) => {
            const app = state.applications.find((a) => a.id === slot.applicationId),
              student = state.students.find((p) => p.id === app?.studentId),
              member = state.memberships.find((m) => m.id === slot.interviewerId),
              interviewer = state.students.find((p) => p.id === member?.userId)
            return (
              <li key={slot.id} className="grid gap-4 py-5 md:grid-cols-[1fr_1fr_auto]">
                <div className="text-sm">
                  <p className="font-medium">
                    {slot.startTime.toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{slot.location}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Interviewer: {interviewer?.profile.firstName} {interviewer?.profile.lastName}
                  </p>
                </div>
                <label className="text-xs text-muted-foreground">
                  {student ? "Scheduled candidate" : "Open slot"}
                  <select
                    aria-label={`Candidate for ${slot.id}`}
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
                    value={slot.applicationId || ""}
                    onChange={(e) => assign(slot.id, e.target.value)}
                  >
                    <option value="">Open / release slot</option>
                    {state.applications
                      .filter((a) => a.clubId === clubId && a.status !== "DRAFTING")
                      .map((a) => {
                        const p = state.students.find((p) => p.id === a.studentId)!
                        return (
                          <option
                            key={a.id}
                            value={a.id}
                            disabled={!applications.some((candidate) => candidate.id === a.id)}
                          >
                            {p.profile.firstName} {p.profile.lastName}
                          </option>
                        )
                      })}
                  </select>
                </label>
                <Button
                  variant="outline"
                  disabled={!app}
                  onClick={() => {
                    if (app) {
                      focusLeader({ clubId, applicantId: app.id })
                      onNavigate("interview-workspace")
                    }
                  }}
                >
                  Open interview
                </Button>
              </li>
            )
          })}
      </ul>
    </section>
  )
}
