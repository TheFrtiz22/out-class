"use client"
import * as clubOverview from "@/actions/club-overview"
import * as tasksApi from "@/actions/tasks"
import * as demoTasks from "@/lib/demo/tasks"
// The sole client data boundary: demo operations never invoke a server action.
import { anonymousApplication, validateAnonymousText, type ReviewApplication } from "@/lib/anonymous-review"
import { meetsTestRequirement, testRequirements } from "@/lib/test-scores"
import * as interviewKits from "@/actions/interview-kits"
import { kitSchema, interviewDraftSchema, emptyInterviewDraft, validateQuestionNotes } from "@/lib/interview-kits"
import * as meetingsApi from "@/actions/meetings"
import { meetingInputSchema, canReadMeeting, TOKEN_LIFETIME_MS } from "@/lib/meetings"
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
  if (s.perspective.role !== "leader" || s.perspective.clubId !== clubId || clubId !== s.clubs[0].id)
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
  if (s.perspective.role !== "leader" || clubId !== s.perspective.clubId || clubId !== s.clubs[0].id)
    throw new Error("Choose a club leader perspective.")
  return {
    rounds: s.clubs.find((c) => c.id === clubId)!.rounds,
    applications: s.applications
      .filter((a) => a.clubId === clubId && a.status !== "DRAFTING")
      .map((a) => { const app = joinedApplication(a.id); return s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === a.roundId)?.anonymousReview ? anonymousApplication(app as unknown as ReviewApplication) : app }),
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
      anonymousReviewText: null,
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
  if (submit && !meetsTestRequirement(club.testRequirement, demoUser().profile)) throw new Error("Update your profile to meet this club’s SAT/ACT requirement.")
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
    leader && s.perspective.role === "leader" && s.perspective.clubId === s.clubs[0].id
      ? s.applications
          .filter((a) => a.clubId === s.perspective.clubId && a.status !== "DRAFTING" && !s.clubs.find(c => c.id === a.clubId)?.rounds.find(r => r.id === a.roundId)?.anonymousReview)
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

export const setRoundAnonymousReview = adapt(crm.setRoundAnonymousReview, (clubId, roundId, enabled) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id) throw new Error("Access denied.")
  return demoStore.mutate(s => { const round = s.clubs[0].rounds.find(r => r.id === roundId); if (!round) throw new Error("Round unavailable."); round.anonymousReview = enabled; return { success: true } })
})
export const setClubTestRequirement = adapt(crm.setClubTestRequirement, (clubId, requirement) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id || !testRequirements.includes(requirement as typeof testRequirements[number])) throw new Error("Invalid requirement.")
  return demoStore.mutate(s => { s.clubs[0].testRequirement = requirement; return { success: true } })
})
export const revealApplicantIdentity = adapt(crm.revealApplicantIdentity, (clubId, applicationId, reason) => {
  scopedApplication(clubId, applicationId); if (reason.trim().length < 10) throw new Error("Add a reason.")
  return joinedApplication(applicationId)
})

export const saveAnonymousReviewContent = adapt(crm.saveAnonymousReviewContent, (clubId, applicationId, content, confirmed) => {
  scopedApplication(clubId, applicationId); if (!confirmed || content.length > 20000) throw new Error("Review and confirm the content first.")
  const app = joinedApplication(applicationId)
  validateAnonymousText(content, app.student)
  return demoStore.mutate(s => { s.applications.find(a => a.id === applicationId)!.anonymousReviewText = content.trim() || null; return { success: true } })
})

export const getInterviewKit = adapt(interviewKits.getInterviewKit, (clubId, roundId) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id) throw new Error("Access denied.")
  const round = demoStore.get().clubs[0].rounds.find(r => r.id === roundId)
  if (!round) throw new Error("Round unavailable.")
  return { questions: round.interviewKit, version: round.kitVersion }
})
export const saveInterviewKit = adapt(interviewKits.saveInterviewKit, (clubId, roundId, version, questions) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id) throw new Error("Access denied.")
  return demoStore.mutate(s => { const round = s.clubs[0].rounds.find(r => r.id === roundId); if (!round || round.kitVersion !== version) throw new Error("Kit changed. Reload before editing."); round.interviewKit = kitSchema.parse(questions); round.kitVersion++; return { questions: round.interviewKit, version: round.kitVersion } })
})
export const openInterviewSession = adapt(interviewKits.openInterviewSession, input => {
  const app = scopedApplication(input.clubId, input.applicationId), member = demoMember()
  if (app.roundId !== input.roundId) throw new Error("Applicant round changed.")
  return demoStore.mutate(s => {
    const round = s.clubs[0].rounds.find(r => r.id === input.roundId)!
    let record = s.interviews.find(r => r.applicationId === app.id && r.interviewerId === member.id && r.roundId === round.id)
    if (!record) { record = { id: crypto.randomUUID(), ...input, interviewerId: member.id, anonymousReview: round.anonymousReview, revision: 0, questions: structuredClone(round.interviewKit), draft: structuredClone(emptyInterviewDraft), completedAt: null }; s.interviews.push(record) }
    if (record.anonymousReview !== round.anonymousReview) throw new Error("Interview privacy settings changed.")
    return record
  })
})
export const saveInterviewSession = adapt(interviewKits.saveInterviewSession, input => {
  const app = scopedApplication(input.clubId, input.applicationId), member = demoMember()
  return demoStore.mutate(s => {
    const round = s.clubs[0].rounds.find(r => r.id === input.roundId)
    const record = s.interviews.find(r => r.applicationId === app.id && r.interviewerId === member.id && r.roundId === input.roundId)
    if (!round || app.roundId !== round.id || !record || record.completedAt || record.revision !== input.revision || record.anonymousReview !== round.anonymousReview) throw new Error("Interview changed. Reload before saving.")
    const draft = interviewDraftSchema.parse(input.draft); validateQuestionNotes(record.questions, draft)
    if (input.complete && draft.score === null) throw new Error("Choose an overall score.")
    record.draft = draft; record.revision++; record.completedAt = input.complete ? new Date().toISOString() : null
    let evaluation = null
    if (input.complete) {
      const target = s.applications.find(a => a.id === app.id)!
      const old = target.evaluations.find(e => e.interviewerId === member.id && e.round === round.name)
      evaluation = { id: old?.id || crypto.randomUUID(), applicationId: app.id, interviewerId: member.id, round: round.name, score: draft.score!, notes: draft.overallReview, createdAt: old?.createdAt || new Date() }
      target.evaluations = [...target.evaluations.filter(e => e.id !== evaluation!.id), evaluation]
    }
    return { session: record, evaluation: evaluation && round.anonymousReview ? { ...evaluation, notes: null, createdAt: new Date(0) } : evaluation }
  })
})
export const getInterviewRounds = adapt(interviewKits.getInterviewRounds, clubId => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id) throw new Error("Access denied.")
  return demoStore.get().clubs[0].rounds.map(r => ({ id: r.id, name: r.name }))
})

function demoMeetingAccess(id: string) {
  const s=demoStore.get(), meeting=s.meetings.find(m=>m.id===id), membership=s.memberships.find(m=>m.clubId===meeting?.clubId&&m.userId===demoUser().id)
  if(!meeting || !canReadMeeting(meeting,membership?{}:null))throw new Error("Meeting unavailable or access denied.")
  return meeting
}
function demoMeetingManager(clubId:string){demoMember();if(clubId!==demoStore.get().clubs[0].id)throw new Error("Access denied.")}
export const listMeetings = adapt(meetingsApi.listMeetings, clubId => {
  const s=demoStore.get(),user=demoUser()
  return s.meetings.filter(m=>(!clubId||m.clubId===clubId)&&canReadMeeting(m,s.memberships.some(member=>member.clubId===m.clubId&&member.userId===user.id)?{}:null)).sort((a,b)=>b.date.getTime()-a.date.getTime())
})
export const getMeeting=adapt(meetingsApi.getMeeting, id=>demoMeetingAccess(id))
export const saveMeeting=adapt(meetingsApi.saveMeeting, input=>{
  const data=meetingInputSchema.parse(input);demoMeetingManager(data.clubId)
  return demoStore.mutate(s=>{
    const old=data.id?s.meetings.find(m=>m.id===data.id&&m.clubId===data.clubId):undefined
    if(data.id&&(!old||old.revision!==data.revision))throw new Error("Meeting changed. Reload before editing.")
    const value={...data,id:old?.id||crypto.randomUUID(),revision:old?old.revision+1:0,isPublic:data.audience==="RECRUITMENT",club:{name:s.clubs[0].name}}
    if(old)Object.assign(old,value);else s.meetings.push(value)
    s.meetingTokens=s.meetingTokens.filter(t=>t.meetingId!==value.id)
    return value
  })
})
export const issueMeetingCheckIn=adapt(meetingsApi.issueMeetingCheckIn,(clubId,meetingId)=>{
  demoMeetingManager(clubId);const meeting=demoMeetingAccess(meetingId);if(meeting.clubId!==clubId)throw new Error("Meeting unavailable.")
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,"0")).join(""), expiresAt=new Date(Date.now()+TOKEN_LIFETIME_MS).toISOString()
  return demoStore.mutate(s=>{s.meetingTokens=s.meetingTokens.filter(t=>new Date(t.expiresAt).getTime()>Date.now());s.meetingTokens.push({meetingId,token,expiresAt,issuedBy:demoUser().id});return{token,expiresAt}})
})
export const closeMeetingCheckIn=adapt(meetingsApi.closeMeetingCheckIn,(clubId,meetingId)=>{
  demoMeetingManager(clubId);if(demoMeetingAccess(meetingId).clubId!==clubId)throw new Error("Meeting unavailable.")
  return demoStore.mutate(s=>{s.meetingTokens=s.meetingTokens.filter(t=>t.meetingId!==meetingId);return{success:true}})
})
export const checkInMeeting=adapt(meetingsApi.checkInMeeting,(meetingId,token)=>{
  demoMeetingAccess(meetingId)
  return demoStore.mutate(s=>{
    if(!s.meetingTokens.some(t=>t.meetingId===meetingId&&t.token===token&&new Date(t.expiresAt).getTime()>Date.now()))throw new Error("This code has expired or was closed. Scan the current QR code.")
    const studentId=demoUser().id,existing=s.meetingAttendances.find(a=>a.eventId===meetingId&&a.studentId===studentId)
    if(existing)return{status:"already-checked-in",checkedInAt:existing.checkedInAt.toISOString()}
    const attendance={id:crypto.randomUUID(),eventId:meetingId,studentId,checkedInAt:new Date()};s.meetingAttendances.push(attendance);return{status:"checked-in",checkedInAt:attendance.checkedInAt.toISOString()}
  })
})
export const meetingAttendance=adapt(meetingsApi.meetingAttendance,(clubId,meetingId)=>{
  demoMeetingManager(clubId);if(demoMeetingAccess(meetingId).clubId!==clubId)throw new Error("Meeting unavailable.")
  const s=demoStore.get();return s.meetingAttendances.filter(a=>a.eventId===meetingId).map(a=>{const student=s.students.find(p=>p.id===a.studentId)!;const anonymous=s.applications.some(app=>app.studentId===student.id&&app.clubId===clubId&&s.clubs.find(c=>c.id===clubId)?.rounds.find(r=>r.id===app.roundId)?.anonymousReview);return{id:a.id,checkedInAt:a.checkedInAt.toISOString(),name:anonymous?"Anonymous applicant":`${student.profile.firstName} ${student.profile.lastName}`,email:anonymous?null:student.email}})
})
export const recruitmentAttendanceSummary=adapt(meetingsApi.recruitmentAttendanceSummary,(clubId,applicationId)=>{
  const app=scopedApplication(clubId,applicationId),s=demoStore.get(),held=s.meetings.filter(m=>m.clubId===clubId&&m.audience==="RECRUITMENT"&&m.date<=new Date())
  return{held:held.length,attended:s.meetingAttendances.filter(a=>a.studentId===app.studentId&&held.some(m=>m.id===a.eventId)).length}
})

// Semester work follows the same isolated demo boundary as recruitment.
export const getTaskWorkspace = adapt(tasksApi.getTaskWorkspace, demoTasks.getTaskWorkspace)
export const saveTask = adapt(tasksApi.saveTask, demoTasks.saveTask)
export const updateTaskMember = adapt(tasksApi.updateTaskMember, demoTasks.updateTaskMember)
export const viewTask = adapt(tasksApi.viewTask, demoTasks.viewTask)
export const submitTask = adapt(tasksApi.submitTask, demoTasks.submitTask)
export const reviewTask = adapt(tasksApi.reviewTask, demoTasks.reviewTask)
export const uploadTaskFile = adapt(tasksApi.uploadTaskFile, () => { throw new Error("Demo files stay fictional. Use a text or link submission; no files are uploaded.") })
export const downloadTaskFile = adapt(tasksApi.downloadTaskFile, () => { throw new Error("This fictional demo file is not downloadable.") })

export const getClubWorkspaceOverview = adapt(clubOverview.getClubWorkspaceOverview, (clubId) => {
 const s=demoStore.get(),user=demoUser(),membership=user.memberships.find(m=>m.clubId===clubId),club=s.clubs.find(c=>c.id===clubId)
 if(!membership||!club)throw new Error("Club workspace access unavailable.")
 const manage=clubId===s.clubs[0].id,now=new Date()
 return {
  club:{id:club.id,name:club.name,tagline:""},membership:{id:membership.id,isOwner:membership.isOwner,permissions:membership.permissions},
  meeting:s.meetings.filter(m=>m.clubId===clubId&&m.date>=now).sort((a,b)=>+a.date-+b.date).map(m=>({id:m.id,title:m.title,date:m.date,location:m.location,audience:m.audience}))[0]??null,
  work:s.tasks.filter(t=>t.clubId===clubId&&t.status!=="DONE").flatMap(t=>t.assignments.filter(a=>a.memberId===membership.id&&!a.submittedAt&&!a.reviewedAt).map(a=>({id:a.id,task:{id:t.id,title:t.title,dueAt:t.dueAt,kind:t.kind}}))).sort((a,b)=>(a.task.dueAt?+a.task.dueAt:Infinity)-(b.task.dueAt?+b.task.dueAt:Infinity)).slice(0,5),
  awaitingReview:manage?s.tasks.filter(t=>t.clubId===clubId).flatMap(t=>t.assignments).filter(a=>a.submittedAt&&!a.reviewedAt).length:null,
  recruitment:manage?[...new Set(s.applications.filter(a=>a.clubId===clubId&&a.status!=="DRAFTING").map(a=>a.status))].map(status=>({status,count:s.applications.filter(a=>a.clubId===clubId&&a.status===status).length})):null,
 }
})
export const getWorkspaceRounds = adapt(clubOverview.getWorkspaceRounds, clubId=>{
 const s=demoStore.get();if(clubId!==s.clubs[0].id)throw new Error("Demo management is limited to MII.")
 return s.clubs[0].rounds.map(r=>({id:r.id,name:r.name,anonymousReview:r.anonymousReview}))
})
