import { taskNotifications } from "@/lib/task-notifications"
import { seedTasks } from "./task-seed"
import { sampleInterviewKit } from "@/lib/interview-kits"
import { clubPermissions, hasWorkspace } from "@/lib/permissions"
import { demoSnapshotSchema } from "./validate"
import { createDemoSeed, type DemoState } from "./seed"
export const DEMO_KEY = "outclass.presentation.v1"
let state: DemoState | null = null
let enabled = false
let template: DemoState | undefined
const listeners = new Set<() => void>()
function ensureSemesterWork(value: DemoState) {
  for (const [index, member] of value.memberships.entries()) {
    member.groups ??= index % 2 ? ["Market research"] : ["Equity research", "Presentations"]
    if (member.cohort === undefined) member.cohort = index % 3 ? "Fall 2026" : "Spring 2026"
  }
  value.tasks ??= seedTasks(value.clubs[0].id, value.memberships.filter(m=>m.clubId===value.clubs[0].id).map(m=>{
    const user=value.students.find(u=>u.id===m.userId)!
    return {...m,user:{id:user.id,email:user.email,studentProfile:{firstName:user.profile.firstName,lastName:user.profile.lastName,gradYear:user.profile.gradYear}}}
  }),value.anchor)
}
function ensureCurrentWorkflows(value: DemoState) {
  for (const task of value.tasks ?? []) for (const assignment of task.assignments) { assignment.groupLabel ??= null; assignment.revisionRequestedAt ??= null }
  value.tutorials ??= { student: { status: "SKIPPED", step: 0, version: 1 }, leader: { status: "SKIPPED", step: 0, version: 1 } }
  value.interviewRooms ??= []
  value.roomBookings ??= []
  value.applicantDisplay ??= {}
  value.corkboard ??= value.clubs.slice(1, 3).map(club => ({ clubId: club.id, savedAt: new Date(`${value.anchor}T12:00:00Z`) }))
  value.votingSessions ??= []
  value.votingAudit ??= []
  value.observations ??= []
  value.recruitingRules ??= []
  value.recruitingFlags ??= []
  value.recruitingRuleAudit ??= []
  value.interviews ??= []
  value.recruitmentOffers ??= value.applications.filter(a=>a.status==="ACCEPTED").map(a=>({applicationId:a.id,status:"PENDING",createdAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)}))
  value.offerAudit ??= []
}
function ensurePresentation(value: DemoState) {
  ensureCurrentWorkflows(value)
  if(!value.meetings){const additions=createDemoSeed(value.anchor);value.meetings=additions.meetings;value.meetingAttendances=additions.meetingAttendances}
  value.meetingTokens ??= []
  for (const application of value.applications) application.anonymousReviewText ??= null
  for (const club of value.clubs) {
    club.claimed ??= true
    club.earlyAdopter ??= value.clubs.indexOf(club) < 3
    club.testRequirement ??= "OPTIONAL"
    for (const round of club.rounds) { round.anonymousReview ??= false; round.interviewKit ??= sampleInterviewKit(); for (const q of round.interviewKit) q.guidance ??= ""; round.kitVersion ??= 0 }
  }
  for (const student of value.students) {
    if (student.profile.resumeUrl === "/demo/sample-resume.txt") student.profile.resumeUrl = "/demo/sample-resume.pdf"
    if (student.profile.firstName === "Jordan" && student.profile.lastName === "Avery" && student.profile.headshotUrl === "/demo/sample-headshot.svg") {
      student.profile.headshotUrl = "/images/landing/jordan-avery.jpg"
    }
    student.profile.actScore ??= null
    student.profile.actEnglish ??= null; student.profile.actMath ??= null; student.profile.actReading ??= null; student.profile.actScience ??= null
  }
  for(const session of value.votingSessions??[]){
    session.displayConfig??={version:1,fields:["photo","name","major","graduationYear","gpa","resume","linkedin"]}
    session.joinOpenedAt??=session.startedAt??null
    if(session.activeApplicationId===undefined)session.activeApplicationId=session.passes.find(p=>p.number===session.currentPass)?.candidates[0]?.applicationId??null
    for(const participant of session.participants)participant.joinedAt??=null
  }
  const mii = value.clubs[0]
  const manager = value.memberships.find(m => m.clubId === mii.id && m.role === "PRESIDENT")
  if (manager) manager.userId = value.students[0].id
  // Old fictional memberships predate explicit access fields. Restore only missing
  // fields from the canonical demo fixtures; explicit denials/revocations survive.
  const legacyManager = manager && manager.status === undefined && manager.isOwner === undefined && manager.permissions === undefined
  if (value.memberships.some(m => m.status === undefined || m.isOwner === undefined || m.permissions === undefined)) {
    const defaults = new Map(createDemoSeed(value.anchor).memberships.map(m => [m.id, m]))
    for (const member of value.memberships) {
      const original = defaults.get(member.id)
      if (!original || original.clubId !== member.clubId || original.userId !== member.userId) continue
      member.status ??= original.status
      member.isOwner ??= original.isOwner
      member.permissions ??= [...original.permissions]
      member.interviewOffices ??= [...original.interviewOffices]
    }
  }
  // Upgrade saved presentations without resetting applications or evaluations.
  value.interviewFoundation ??= { assignments: [], documents: [], annotations: [], history: [], audit: [] };
  // Missing guidance is a safe legacy default, never the student's current kit.
  for (const record of value.interviews) for (const q of record.questions || []) q.guidance ??= "";
  if (legacyManager && manager.isOwner && manager.status === "ACTIVE") {
    for (const app of value.applications.filter(a => a.clubId === mii.id && a.studentId !== manager.userId && a.status !== "DRAFTING" && mii.rounds.some(r => r.id === a.roundId && !r.anonymousReview))) {
      if (!value.interviewFoundation.assignments.some(a => a.applicationId === app.id && a.roundId === app.roundId && a.memberId === manager.id))
        value.interviewFoundation.assignments.push({ applicationId: app.id, roundId: app.roundId, memberId: manager.id, revokedAt: null })
    }
  }
  for (const m of value.memberships) m.interviewOffices ??= [];
  // Historical seeded evaluations have deterministic IDs. Resolve only those
  // identities, never an arbitrary review by its round display name alone.
  if (value.applications.some(a => a.evaluations.some(e => e.roundId === undefined))) {
    const defaults = new Map(createDemoSeed(value.anchor).applications.map(a => [a.id, a]))
    for (const application of value.applications) {
      const original = defaults.get(application.id)
      if (!original || original.clubId !== application.clubId || original.studentId !== application.studentId) continue
      for (const evaluation of application.evaluations) {
        if (evaluation.roundId !== undefined) continue
        const seeded = original.evaluations.find(e => e.id === evaluation.id && e.interviewerId === evaluation.interviewerId && e.round === evaluation.round)
        if (seeded?.roundId && value.clubs.find(c => c.id === application.clubId)?.rounds.some(r => r.id === seeded.roundId)) evaluation.roundId = seeded.roundId
      }
    }
  }
  for (const s of value.students) { s.profile.scholarStatus ??= null; s.profile.highSchool ??= null; s.profile.gender ??= null; s.profile.pronouns ??= null; s.profile.transferStudent ??= false; }
  if (value.perspective.clubId !== mii.id) value.perspective = { role: "student", clubId: mii.id }
  ensureSemesterWork(value)
}
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
  start: (seed?: DemoState) => {
    template = seed
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
    state = demoSnapshotSchema.safeParse(saved).success ? saved! : seed ? structuredClone(seed) : createDemoSeed()
    ensurePresentation(state!)
    enabled = true
    demoStore.save()
  },
  stop: () => {
    enabled = false
    state = null
    listeners.forEach((fn) => fn())
  },
  refresh: () => {
    if (!enabled) return
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) return
    const saved = JSON.parse(raw, (_, v) => typeof v === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(v) ? new Date(v) : v)
    if (!demoSnapshotSchema.safeParse(saved).success) throw new Error("Demo snapshot unavailable.")
    state = saved
    ensurePresentation(state!)
    listeners.forEach(fn => fn())
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
    state = template ? structuredClone(template) : createDemoSeed(previous.anchor)
    ensurePresentation(state)
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
  if (s.perspective.clubId !== s.clubs[0].id) throw new Error("Demo management is limited to MII.")
  return s.memberships.find((m) => m.clubId === s.clubs[0].id && m.userId === s.students[0].id)!
}
function presentProfile(profile: DemoState["students"][number]["profile"]) {
  return {
    ...profile,
    headshotUrl: profile.headshotUrl,
    resumeUrl:
      profile.resumeUrl && typeof window !== "undefined"
        ? new URL(profile.resumeUrl, window.location.origin).href
        : profile.resumeUrl,
  }
}
export function demoUser() {
  const s = demoStore.get(), person = s.students[0]
  const memberships = s.memberships.filter(m => m.userId === person.id).map(m => ({
    ...m, club: s.clubs.find(c => c.id === m.clubId)!,
    isOwner: m.clubId === s.clubs[0].id,
    permissions: m.clubId === s.clubs[0].id ? [...clubPermissions] : [],
  }))
  return {
    ...person,
    profile: presentProfile(person.profile),
    memberships,
    adminRoles: memberships.filter(hasWorkspace),
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
    .map((a) => {
      const application = joinedApplication(a.id)
      return {
        ...application,
        recruitmentOffer: demoStore.get().recruitmentOffers.find(o=>o.applicationId===a.id) ?? null,
        club: { ...application.club, applicationOpen: application.club.claimed, applicationDeadline: application.club.deadline, pipelineRounds: application.club.rounds.map(({ id, name, order }) => ({ id, name, order })) },
        bookings: application.bookings.map(booking => ({
          ...booking,
          roundId: demoStore.get().roomBookings?.find(record => record.id === booking.slot.id)?.roundId ?? null,
        })),
      }
    })
}
export function presentDemoMeeting(meeting: DemoState["meetings"][number]) {
  return { ...meeting, resources: meeting.resources.map(resource => ({
    ...resource,
    url: resource.url.startsWith("/demo/") ? new URL(resource.url, typeof window !== "undefined" ? window.location.origin : "https://demo.invalid").href : resource.url,
  })) }
}
export function demoDashboard() {
  const s = demoStore.get()
  return {
    meetings: s.meetings.filter(m => m.audience === "RECRUITMENT" || s.memberships.some(member => member.clubId === m.clubId && member.userId === demoUser().id)).map(presentDemoMeeting),
    applications: studentApplications(),
    attendances: s.meetingAttendances.filter(a=>a.studentId===s.students[0].id).flatMap(a=>{const event=s.meetings.find(m=>m.id===a.eventId);return event&&(event.audience==="RECRUITMENT"||s.memberships.some(m=>m.clubId===event.clubId&&m.userId===s.students[0].id))?[{...a,event}]:[]}),
  }
}
export function demoNotifications() {
  const s = demoStore.get()
  const recruiting = studentApplications()
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
      title: `${a.club.name}: ${a.status === "INTERVIEWING" ? a.bookings.length ? "Your interview is scheduled" : "Choose an interview time" : a.status === "ACCEPTED" ? "Your decision is ready" : "Application update"}`,
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
  const work=taskNotifications(s.tasks.flatMap(task=>task.assignments.filter(assignment=>assignment.userId===s.students[0].id && s.memberships.some(member=>member.id===assignment.memberId)).map(assignment=>({...assignment,task:{...task,club:s.clubs.find(club=>club.id===task.clubId)!}})))).map(notification=>({...notification,read:s.readNotifications.includes(notification.id)})).filter(notification=>!s.deletedNotifications.includes(notification.id))
  return [...recruiting,...work]
}
export function demoDirectory() {
  const s = demoStore.get()
  return s.clubs.map((club, i) => ({
    ...club,
    source: "database" as const,
    recommended: i < 3,
    pitch: club.tagline || `Sample ${club.theme} recruitment · fictional season`,
    tags: ["Demo / sample", ...(club.earlyAdopter ? ["Early adopter (sample)"] : []), club.theme],
    description: club.description,
    applicationAvailable: club.claimed,
    applicationDeadline: club.claimed ? club.deadline.toISOString() : null,
    acceptanceRate: club.marketing?.showAcceptance === false ? null : club.acceptanceRate === undefined ? 15 + (i % 7) * 3 : club.acceptanceRate,
    aumValue: club.marketing?.showAum === false ? null : club.aumValue ?? null,
    timeCommitment: "3-5" as const,
    requirements: club.questions.map((q) => q.prompt),
    publicEvents: [
      ...s.meetings.filter(m => m.clubId === club.id && m.isPublic).map(m => ({ id: m.id, title: m.title, date: m.date.toISOString(), location: m.location, description: m.description })),
      ...(club.claimed ? [{
        id: `deadline-${club.id}`,
        title: "Sample application deadline",
        date: club.deadline.toISOString(),
        location: "OutClass demo",
        description: "Fictional deadline, not an actual club announcement.",
      }] : []),
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
