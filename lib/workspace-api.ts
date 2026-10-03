"use client"
import * as tutorials from "@/actions/tutorials"
import { tutorialExperience, tutorialInput } from "@/lib/tutorials"
import { corkboardInput } from "@/lib/corkboard"
import * as votingApi from "@/actions/voting"
import * as demoVoting from "@/lib/demo/voting"
import * as applicantIntelligence from "@/actions/applicant-intelligence"
import { defaultDisplayConfig, displayConfigSchema, projectApplicantDisplay } from "@/lib/applicant-display"
import { z } from "zod"
import * as roomApi from "@/actions/interview-rooms"
import * as demoRoomApi from "@/lib/demo/interview-rooms"
import * as recruitingRules from "@/actions/recruiting-rules"
import * as demoRecruitingRules from "@/lib/demo/recruiting-rules"
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
  demoNotifications,
  presentDemoMeeting,
} from "@/lib/demo/store"
import { applicationInputSchema, answerErrors, assertApplicationAttachmentOwnership } from "@/lib/student-applications"
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
    if (input.expectedRoundId && app.roundId !== input.expectedRoundId)
      throw new Error("Application changed. Refresh before moving rounds.")
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
  if (!club.claimed) throw new Error("Applications are not available for this unclaimed club.")
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
  assertApplicationAttachmentOwnership(club.questions, parsed.answers, demoUser().id)
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
    const canonical = record.completedAt ? app.evaluations.find(e => e.interviewerId === member.id && e.round === round.name) : null
    return { ...record, draft: canonical ? { ...record.draft, score: canonical.score, overallReview: canonical.notes || "" } : record.draft, feedbackSource: record.completedAt ? canonical ? "evaluation" : "historical-snapshot" : "draft" }
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
  return presentDemoMeeting(meeting)
}
function demoMeetingManager(clubId:string){demoMember();if(clubId!==demoStore.get().clubs[0].id)throw new Error("Access denied.")}
export const listMeetings = adapt(meetingsApi.listMeetings, clubId => {
  const s=demoStore.get(),user=demoUser()
  return s.meetings.filter(m=>(!clubId||m.clubId===clubId)&&canReadMeeting(m,s.memberships.some(member=>member.clubId===m.clubId&&member.userId===user.id)?{}:null)).sort((a,b)=>b.date.getTime()-a.date.getTime()).map(presentDemoMeeting)
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
export const getTaskNotifications = adapt(tasksApi.getTaskNotifications, () => demoNotifications().filter(notification => "taskHref" in notification && notification.taskHref))
export const getTaskWorkspace = adapt(tasksApi.getTaskWorkspace, demoTasks.getTaskWorkspace)
export const saveTask = adapt(tasksApi.saveTask, demoTasks.saveTask)
export const previewTaskAudience = adapt(tasksApi.previewTaskAudience, demoTasks.previewTaskAudience)
export const bulkUpdateTasks = adapt(tasksApi.bulkUpdateTasks, demoTasks.bulkUpdateTasks)
export const addTaskRecipients = adapt(tasksApi.addTaskRecipients, demoTasks.addTaskRecipients)
export const bulkApproveTaskSubmissions = adapt(tasksApi.bulkApproveTaskSubmissions, demoTasks.bulkApproveTaskSubmissions)
export const updateTaskMember = adapt(tasksApi.updateTaskMember, demoTasks.updateTaskMember)
export const viewTask = adapt(tasksApi.viewTask, demoTasks.viewTask)
export const submitTask = adapt(tasksApi.submitTask, demoTasks.submitTask)
export const reviewTask = adapt(tasksApi.reviewTask, demoTasks.reviewTask)
export const uploadTaskFile = adapt(tasksApi.uploadTaskFile, () => { throw new Error("Demo files stay fictional. Use a text or link submission; no files are uploaded.") })
export const downloadTaskFile = adapt(tasksApi.downloadTaskFile, id => {
  const s = demoStore.get()
  const task = s.tasks.find(t => t.assignments.some(a => a.files.some(f => f.id === id)))
  if (!task) throw new Error("File unavailable.")
  const workspace = demoTasks.getTaskWorkspace(task.clubId)
  if (!workspace.tasks.some(t => t.assignments.some(a => a.files.some(f => f.id === id)))) throw new Error("File unavailable.")
  return { url: "/demo/sample-research.txt" }
})

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

export const getRecruitingRules = adapt(recruitingRules.getRecruitingRules, demoRecruitingRules.getRecruitingRules)
export const saveRecruitingRule = adapt(recruitingRules.saveRecruitingRule, demoRecruitingRules.saveRecruitingRule)
export const previewRecruitingRule = adapt(recruitingRules.previewRecruitingRule, demoRecruitingRules.previewRecruitingRule)
export const applyRecruitingRuleFlags = adapt(recruitingRules.applyRecruitingRuleFlags, demoRecruitingRules.applyRecruitingRuleFlags)
export const getRecruitingRuleFlags = adapt(recruitingRules.getRecruitingRuleFlags, demoRecruitingRules.getRecruitingRuleFlags)
export const clearRecruitingRuleFlags = adapt(recruitingRules.clearRecruitingRuleFlags, demoRecruitingRules.clearRecruitingRuleFlags)

export const getRoomWorkspace = adapt(roomApi.getRoomWorkspace, demoRoomApi.getRoomWorkspace)
export const createInterviewRoom = adapt(roomApi.createInterviewRoom, demoRoomApi.createInterviewRoom)
export const setInterviewRoomOpen = adapt(roomApi.setInterviewRoomOpen, demoRoomApi.setInterviewRoomOpen)
export const getApplicantSchedule = adapt(roomApi.getApplicantSchedule, demoRoomApi.getApplicantSchedule)
export const reserveInterview = adapt(roomApi.reserveInterview, demoRoomApi.reserveInterview)
export const cancelRoomBooking = adapt(roomApi.cancelRoomBooking, demoRoomApi.cancelRoomBooking)
export const getBookingApplication = adapt(roomApi.getBookingApplication, demoRoomApi.getBookingApplication)


export const getApplicantDisplay = adapt(applicantIntelligence.getApplicantDisplay, input => {
  const app = scopedApplication(input.clubId, input.applicationId), s = demoStore.get();
  const round = s.clubs[0].rounds.find(r => r.id === app.roundId)!;
  const display = projectApplicantDisplay(joinedApplication(app.id) as unknown as ReviewApplication, round, s.applicantDisplay?.[round.id]?.config || defaultDisplayConfig, (s.observations || []).filter(o => o.applicationId === app.id));
  // The bundled fictional résumé is a demo asset, never a live private-download request.
  if (!display.anonymous && display.visible.includes("resume") && s.students.find(u => u.id === app.studentId)?.profile.resumeUrl === "/demo/sample-resume.txt") display.links.push({ field: "resume", label: "Sample résumé", href: "/demo/sample-resume.txt" });
  return display;
});
export const getApplicantDisplayConfiguration = adapt(applicantIntelligence.getApplicantDisplayConfiguration, (clubId, roundId) => {
  demoMeetingManager(clubId);
  if (!demoStore.get().clubs[0].rounds.some(r => r.id === roundId)) throw new Error("Round unavailable.");
  return demoStore.get().applicantDisplay?.[roundId] || { config: defaultDisplayConfig, version: 0 };
});
export const saveApplicantDisplayConfiguration = adapt(applicantIntelligence.saveApplicantDisplayConfiguration, input => {
  const data = z.object({ clubId: z.string(), roundId: z.string(), version: z.number(), config: displayConfigSchema }).parse(input);
  demoMeetingManager(data.clubId);
  if (!demoStore.get().clubs[0].rounds.some(r => r.id === data.roundId)) throw new Error("Round unavailable.");
  return demoStore.mutate(s => {
    s.applicantDisplay ??= {};
    if ((s.applicantDisplay[data.roundId]?.version || 0) !== data.version) throw new Error("Configuration changed. Reload.");
    return s.applicantDisplay[data.roundId] = { config: data.config, version: data.version + 1 };
  });
});
export const saveApplicantObservation = adapt(applicantIntelligence.saveApplicantObservation, input => {
  const data = z.object({ clubId: z.string(), applicationId: z.string(), id: z.string().optional(), kind: z.enum(["PRO", "CON"]), body: z.string().trim().min(1).max(3000) }).parse(input);
  const app = scopedApplication(data.clubId, data.applicationId);
  if (demoStore.get().clubs[0].rounds.find(r => r.id === app.roundId)?.anonymousReview) throw new Error("Pros and Cons are withheld during anonymous review.");
  return demoStore.mutate(s => {
    s.observations ??= [];
    const old = s.observations.find(o => o.id === data.id && o.applicationId === app.id && o.own);
    if (data.id && !old) throw new Error("Only the author can edit this observation.");
    if (old) Object.assign(old, { body: data.body, kind: data.kind, updatedAt: new Date().toISOString() });
    else s.observations.push({ id: crypto.randomUUID(), applicationId: app.id, kind: data.kind, body: data.body, author: "Demo reviewer", own: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { success: true };
  });
});
export const deleteApplicantObservation = adapt(applicantIntelligence.deleteApplicantObservation, input => {
  const data = z.object({ clubId: z.string(), applicationId: z.string(), id: z.string() }).parse(input);
  const app = scopedApplication(data.clubId, data.applicationId);
  if (demoStore.get().clubs[0].rounds.find(r => r.id === app.roundId)?.anonymousReview) throw new Error("Pros and Cons are withheld during anonymous review.");
  return demoStore.mutate(s => {
    if (!s.observations?.some(o => o.id === data.id && o.applicationId === app.id && o.own)) throw new Error("Only the author can delete this observation.");
    s.observations = s.observations.filter(o => o.id !== data.id);
    return { success: true };
  });
});

// Persisted voting follows the same Demo Mode boundary as recruitment and applicant display.
export const getVotingWorkspace = adapt(votingApi.getVotingWorkspace, demoVoting.getVotingWorkspace)
export const createVotingSession = adapt(votingApi.createVotingSession, demoVoting.createVotingSession)
export const submitVotingBallot = adapt(votingApi.submitVotingBallot, demoVoting.submitVotingBallot)
export const commandVotingSession = adapt(votingApi.commandVotingSession, demoVoting.commandVotingSession)
export async function seedVotingDemo(clubId: string) {
  if (!demoStore.active()) throw Error("Sample voting is available only in Demo Mode.")
  return demoVoting.seedVotingDemo(clubId)
}

// One saved-item boundary. Demo saves reference the same deterministic demo directory.
export const getCorkboard = adapt(directory.getCorkboard, () => {
  const s = demoStore.get()
  const clubs = demoDirectory()
  return { items: [...s.corkboard].sort((a,b) => b.savedAt.getTime()-a.savedAt.getTime() || a.clubId.localeCompare(b.clubId)).map(item => ({ club: clubs.find(c => c.id === item.clubId)!, savedAt: item.savedAt.toISOString() })) }
})
export const setCorkboardClub = adapt(directory.setCorkboardClub, input => {
  const data = corkboardInput.parse(input)
  return demoStore.mutate(s => {
    if (!s.clubs.some(c => c.id === data.clubId)) throw new Error("Club unavailable.")
    if (!data.saved) { s.corkboard = s.corkboard.filter(item => item.clubId !== data.clubId); return { saved: false, savedAt: null } }
    let item = s.corkboard.find(item => item.clubId === data.clubId)
    if (!item) { item = { clubId: data.clubId, savedAt: new Date(`${s.anchor}T12:00:00Z`) }; s.corkboard.push(item) }
    return { saved: true, savedAt: item.savedAt.toISOString() }
  })
})

function demoTutorialScope(experience: unknown, clubId?: string) {
  const kind = tutorialExperience.parse(experience), state = demoStore.get()
  if (kind === "leader" && (state.perspective.role !== "leader" || clubId !== state.clubs[0].id)) throw new Error("Choose the MII leader workspace.")
  return kind
}
export const getTutorial = adapt(tutorials.getTutorial, (experience, clubId) => {
  const kind = demoTutorialScope(experience, clubId)
  return demoStore.get().tutorials[kind]
})
export const saveTutorial = adapt(tutorials.saveTutorial, input => {
  const data = tutorialInput.parse(input), kind = demoTutorialScope(data.experience, data.clubId)
  return demoStore.mutate(s => {
    const previous = s.tutorials[kind]
    if (data.action !== "restart" && previous.status !== "IN_PROGRESS") return previous
    return s.tutorials[kind] = { status: data.action === "skip" ? "SKIPPED" : data.action === "complete" ? "COMPLETED" : "IN_PROGRESS", step: data.action === "restart" ? 0 : data.step, version: 1 }
  })
})
