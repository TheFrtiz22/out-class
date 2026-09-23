"use client"
// The sole client data boundary: demo operations never invoke a server action.
import * as apps from "@/actions/applications"
import * as crm from "@/actions/crm"
import * as evaluation from "@/actions/evaluations"
import * as profile from "@/actions/profile"
import * as directory from "@/actions/club-directory"
import * as storage from "@/actions/storage"
import * as search from "@/actions/workspace-search"
import {
  demoStore,
  demoMember,
  demoUser,
  joinedApplication,
  studentApplications,
  demoDirectory,
  demoDashboard,
} from "@/lib/demo/store"
import { applicationInputSchema, answerErrors } from "@/lib/student-applications"
import { profileSectionSchema } from "@/lib/student-profile"
export type { WorkspaceSearchResult } from "@/actions/workspace-search"
function adapt<F extends (...args: never[]) => Promise<unknown>>(
  real: F,
  demo: (...args: Parameters<F>) => unknown,
): F {
  return (async (...args: Parameters<F>) =>
    demoStore.active() ? demo(...args) : real(...args)) as F
}
function scopedApplication(clubId: string, id: string) {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || s.perspective.clubId !== clubId)
    throw new Error("Choose this club's leader perspective first.")
  const app = s.applications.find(
    (a) => a.id === id && a.clubId === clubId && a.status !== "DRAFTING",
  )
  if (!app) throw new Error("Application unavailable.")
  return app
}
export const getStudentApplications = adapt(apps.getStudentApplications, () =>
  studentApplications(),
)
export const getStudentDashboardData = adapt(apps.getStudentDashboardData, () => demoDashboard())
export const getClubDirectory = adapt(directory.getClubDirectory, () => ({
  clubs: demoDirectory(),
}))
export const getPublicClub = adapt(directory.getPublicClub, (id) => ({
  club: demoDirectory().find((c) => c.id === id || c.slug === id) || null,
}))
export const getClubPipeline = adapt(crm.getClubPipeline, (clubId) => {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || clubId !== s.perspective.clubId)
    throw new Error("Choose a club leader perspective.")
  return {
    rounds: s.clubs.find((c) => c.id === clubId)!.rounds,
    applications: s.applications
      .filter((a) => a.clubId === clubId && a.status !== "DRAFTING")
      .map((a) => joinedApplication(a.id)),
  }
})
export const moveApplicantRound = adapt(crm.moveApplicantRound, (input) => {
  scopedApplication(input.clubId, input.applicationId)
  if (
    !demoStore
      .get()
      .clubs.find((c) => c.id === input.clubId)
      ?.rounds.some((r) => r.id === input.newRoundId)
  )
    throw new Error("Round unavailable.")
  return demoStore.mutate((s) => {
    const app = s.applications.find((a) => a.id === input.applicationId)!
    app.roundId = input.newRoundId
    return { success: true, application: app }
  })
})
export const setApplicationStatus = adapt(crm.setApplicationStatus, (input) => {
  const app = scopedApplication(input.clubId, input.applicationId)
  if (input.expectedStatus && app.status !== input.expectedStatus)
    throw new Error("This candidate changed. Refresh before deciding.")
  return demoStore.mutate((s) => {
    const app = s.applications.find((a) => a.id === input.applicationId)!
    app.status = input.status
    return { success: true, application: app }
  })
})
export const submitEvaluation = adapt(evaluation.submitEvaluation, (input) => {
  scopedApplication(input.clubId, input.applicationId)
  if (!Number.isFinite(input.score) || input.score < 1 || input.score > 10)
    throw new Error("Choose a score from 1 to 10.")
  if (
    !demoStore
      .get()
      .clubs.find((c) => c.id === input.clubId)
      ?.rounds.some((r) => r.name === input.roundName)
  )
    throw new Error("Round unavailable.")
  const member = demoMember()
  return demoStore.mutate((s) => {
    const app = s.applications.find((a) => a.id === input.applicationId)!
    const old = app.evaluations.find(
      (e) => e.interviewerId === member.id && e.round === input.roundName,
    )
    const value = {
      id: old?.id || `demo-eval-${app.id}-${input.roundName}`,
      applicationId: app.id,
      interviewerId: member.id,
      round: input.roundName,
      score: input.score,
      notes: input.notes || "",
      createdAt: old?.createdAt || new Date(),
    }
    app.evaluations = [...app.evaluations.filter((e) => e.id !== value.id), value]
    return { success: true, evaluation: value }
  })
})
export const startClubApplication = adapt(directory.startClubApplication, (clubId) => {
  const s = demoStore.get(),
    old = s.applications.find((a) => a.studentId === s.students[0].id && a.clubId === clubId)
  if (old) return { applicationId: old.id }
  const club = s.clubs.find((c) => c.id === clubId)
  if (!club) throw new Error("Club unavailable.")
  return demoStore.mutate((next) => {
    const id = crypto.randomUUID()
    next.applications.push({
      id,
      clubId,
      studentId: next.students[0].id,
      roundId: club.rounds[0].id,
      status: "DRAFTING",
      submittedAt: null,
      answers: [],
      evaluations: [],
    })
    return { applicationId: id }
  })
})
async function persist(input: Parameters<typeof apps.saveApplicationDraft>[0], submit: boolean) {
  const parsed = applicationInputSchema.parse(input),
    s = demoStore.get(),
    club = s.clubs.find((c) => c.id === parsed.clubId)
  if (s.perspective.role !== "student" || !club)
    throw new Error("Switch to the sample student first.")
  const errors = answerErrors(club.questions, parsed.answers, submit)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const { applicationId } = await startClubApplication(parsed.clubId)
  return demoStore.mutate((next) => {
    const app = next.applications.find((a) => a.id === applicationId)!
    if (app.status !== "DRAFTING") throw new Error("Application already submitted.")
    app.answers = parsed.answers.map((answer, i) => ({
      ...answer,
      id: `${app.id}-answer-${i}`,
      applicationId: app.id,
    }))
    if (submit) {
      app.status = "SUBMITTED"
      app.submittedAt = new Date()
    }
    return { success: true, applicationId }
  })
}
export const saveApplicationDraft = adapt(apps.saveApplicationDraft, (input) =>
  persist(input, false),
)
export const submitApplication = adapt(apps.submitApplication, (input) => persist(input, true))
export const getStudentProfile = adapt(profile.getStudentProfile, () => ({
  profile: demoUser().profile,
}))
export const updateStudentProfileSection = adapt(profile.updateStudentProfileSection, (input) => {
  const parsed = profileSectionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return demoStore.mutate((s) => {
    const user = s.students.find((p) => p.id === demoUser().id)!
    const { section, ...fields } = parsed.data
    if (section === "experience" && "experiences" in fields)
      user.profile.experiences = fields.experiences.map((e, i) => ({
        ...e,
        id: `${user.id}-experience-${i}`,
        studentProfileId: user.profile.id,
      }))
    else Object.assign(user.profile, fields)
    return { profile: user.profile }
  })
})
export const getSignedUploadUrl = adapt(storage.getSignedUploadUrl, () => {
  throw new Error(
    "Uploads are disabled in Demo Mode. Sample résumé links are provided; no files are sent to production.",
  )
})
export const searchWorkspace = adapt(search.searchWorkspace, (query, leader = false) => {
  const s = demoStore.get(),
    text = query.trim().toLowerCase()
  if (text.length < 2) return []
  const clubs = s.clubs
    .filter((c) => c.name.toLowerCase().includes(text))
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      clubId: c.id,
      kind: "club",
      title: c.name,
      detail: "Sample organization",
    }))
  const applications = studentApplications()
    .filter((a) => a.club.name.toLowerCase().includes(text))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      clubId: a.clubId,
      kind: "application",
      title: a.club.name,
      detail: a.status,
    }))
  const applicants =
    leader && s.perspective.role === "leader"
      ? s.applications
          .filter((a) => a.clubId === s.perspective.clubId && a.status !== "DRAFTING")
          .map((a) => {
            const student = s.students.find((p) => p.id === a.studentId)!
            return {
              id: a.id,
              clubId: a.clubId,
              kind: "applicant",
              title: `${student.profile.firstName} ${student.profile.lastName}`,
              detail: student.profile.major,
            }
          })
          .filter((a) => a.title.toLowerCase().includes(text))
          .slice(0, 8)
      : []
  return [...clubs, ...applications, ...applicants]
})
