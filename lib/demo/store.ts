import { demoSnapshotSchema } from "./validate"
import { createDemoSeed, type DemoState } from "./seed"
export const DEMO_KEY = "outclass.presentation.v1"
let state: DemoState | null = null
let enabled = false
const listeners = new Set<() => void>()
export const demoStore = {
  active: () => enabled,
  get: () => {
    if (!enabled || !state) throw new Error("Demo is not active.")
    return state
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  start: () => {
    let saved: DemoState | null = null
    try {
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw)
        saved = JSON.parse(raw, (_, v) =>
          typeof v === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(v) ? new Date(v) : v,
        )
    } catch {
      /* Reset damaged browser data. */
    }
    state = demoSnapshotSchema.safeParse(saved).success ? saved! : createDemoSeed()
    enabled = true
    demoStore.save()
  },
  stop: () => {
    enabled = false
    state = null
    listeners.forEach((fn) => fn())
  },
  save: () => {
    if (!state) return
    localStorage.setItem(DEMO_KEY, JSON.stringify(state))
    listeners.forEach((fn) => fn())
  },
  mutate: <T>(fn: (value: DemoState) => T): T => {
    const before = demoStore.get()
    state = structuredClone(before)
    try {
      const value = fn(state)
      demoStore.save()
      return value
    } catch (error) {
      state = before
      throw error
    }
  },
  reset: () => {
    const previous = demoStore.get()
    state = createDemoSeed(previous.anchor)
    try {
      demoStore.save()
    } catch (error) {
      state = previous
      throw error
    }
  },
}
export function demoMember() {
  const s = demoStore.get()
  return s.memberships.find((m) => m.clubId === s.perspective.clubId && m.role === "PRESIDENT")!
}
function presentProfile(profile: DemoState["students"][number]["profile"]) {
  return {
    ...profile,
    resumeUrl:
      profile.resumeUrl && typeof window !== "undefined"
        ? new URL(profile.resumeUrl, window.location.origin).href
        : profile.resumeUrl,
  }
}
export function demoUser() {
  const s = demoStore.get(),
    person = s.students.find(
      (p) => p.id === (s.perspective.role === "student" ? s.students[0].id : demoMember().userId),
    )!
  const memberships =
    s.perspective.role === "leader"
      ? [{ ...demoMember(), club: s.clubs.find((c) => c.id === s.perspective.clubId)! }]
      : s.memberships
          .filter((m) => m.userId === person.id)
          .map((m) => ({ ...m, club: s.clubs.find((c) => c.id === m.clubId)! }))
  return {
    ...person,
    profile: presentProfile(person.profile),
    memberships,
    adminRoles: memberships.filter((m) => m.role !== "GENERAL_MEMBER"),
    applications: studentApplications(person.id),
  }
}
export function joinedApplication(id: string) {
  const s = demoStore.get(),
    app = s.applications.find((a) => a.id === id)!
  const club = s.clubs.find((c) => c.id === app.clubId)!,
    student = s.students.find((p) => p.id === app.studentId)!
  return {
    ...app,
    club: { ...club, _count: { questions: club.questions.length } },
    student: { ...student, studentProfile: presentProfile(student.profile) },
    round: club.rounds.find((r) => r.id === app.roundId),
    answers: app.answers.map((a) => ({
      ...a,
      question: club.questions.find((q) => q.id === a.questionId)!,
    })),
    bookings: s.slots
      .filter((slot) => slot.applicationId === app.id)
      .map((slot) => ({ id: `booking-${slot.id}`, applicationId: app.id, slotId: slot.id, slot })),
  }
}
export function studentApplications(studentId = demoStore.get().students[0].id) {
  return demoStore
    .get()
    .applications.filter((a) => a.studentId === studentId)
    .map((a) => joinedApplication(a.id))
}
export function demoDashboard() {
  const s = demoStore.get()
  return {
    applications: studentApplications(),
    attendances: s.clubs
      .filter((c) => s.subscriptions.includes(c.id))
      .map((club, i) => ({
        id: `event-${club.id}`,
        event: {
          id: `event-${club.id}`,
          clubId: club.id,
          club,
          date: new Date(new Date(`${s.anchor}T21:00:00Z`).getTime() + (i + 1) * 86400000),
          title: `${club.name} · sample ${i === 1 ? "coffee chat" : "information session"}`,
          location: "Newcomb Hall · sample location",
          description: "Fictional event for the OutClass presentation.",
        },
      })),
  }
}
export function demoNotifications() {
  const s = demoStore.get()
  return studentApplications()
    .filter((a) => a.status !== "DRAFTING")
    .map((a) => ({
      id: `update-${a.id}-${a.status}`,
      clubId: a.clubId,
      applicationId: a.id,
      club: a.club.name,
      color: a.club.color,
      logoText: a.club.logoText,
      senderName: "Sample recruitment team",
      senderTitle: "Demo update",
      urgent: false,
      type: "Announcement" as const,
      title: `${a.club.name}: ${a.status === "INTERVIEWING" ? "Your interview is scheduled" : a.status === "ACCEPTED" ? "Your decision is ready" : "Application update"}`,
      preview: "Your sample recruiting record has been updated.",
      body: [
        `Demo application status: ${a.status}. Open Applications for your record and Calendar for scheduled meetings.`,
      ],
      timestamp: "This season",
      fullDate: s.anchor,
      createdAt: new Date(`${s.anchor}T12:00:00Z`).toISOString(),
      read: s.readNotifications.includes(`update-${a.id}-${a.status}`),
    }))
    .filter((n) => !s.deletedNotifications.includes(n.id))
}
export function demoDirectory() {
  const s = demoStore.get()
  return s.clubs.map((club, i) => ({
    ...club,
    source: "database" as const,
    recommended: i < 3,
    pitch: `Sample ${club.theme} recruitment · fictional season`,
    tags: ["Demo / sample", club.theme],
    description: club.description,
    applicationAvailable: true,
    acceptanceRate: 15 + (i % 7) * 3,
    aumValue: null,
    timeCommitment: "3-5" as const,
    requirements: club.questions.map((q) => q.prompt),
    publicEvents: [
      {
        id: `deadline-${club.id}`,
        title: "Sample application deadline",
        date: club.deadline.toISOString(),
        location: "OutClass demo",
        description: "Fictional deadline, not an actual club announcement.",
      },
    ],
  }))
}

export function demoDeadlines() {
  const s = demoStore.get()
  return s.clubs
    .filter((c) =>
      s.applications.some(
        (a) => a.studentId === s.students[0].id && a.clubId === c.id && a.status === "DRAFTING",
      ),
    )
    .map((c) => ({
      id: `deadline-${c.id}`,
      clubId: c.id,
      club: c.name,
      color: c.color,
      title: `${c.name} · sample application deadline`,
      type: "Deadline" as const,
      readOnly: true,
      date: `${c.deadline.getFullYear()}-${String(c.deadline.getMonth() + 1).padStart(2, "0")}-${String(c.deadline.getDate()).padStart(2, "0")}`,
      day: c.deadline.getDate(),
      time: `${String(c.deadline.getHours()).padStart(2, "0")}:${String(c.deadline.getMinutes()).padStart(2, "0")}`,
      location: "OutClass demo",
    }))
}
