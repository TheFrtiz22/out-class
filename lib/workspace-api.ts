"use client"
import * as offers from "@/actions/recruitment-offers";
import * as demoOffers from "@/lib/demo/recruitment-offers";
import { assertRecruitmentRoundMove } from "@/lib/recruitment-lifecycle";
import { interviewCapabilities } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
import { genderVisibility } from "@/lib/recruitment-profile";
import { readWorkspace } from "@/lib/workspace-read"
import * as campusEvents from "@/actions/campus-events"
import * as eventFlyers from "@/actions/event-flyers"
import * as resumeImport from "@/actions/resume-import"
import * as tutorials from "@/actions/tutorials"
import { tutorialExperience, tutorialInput } from "@/lib/tutorials"
import { corkboardInput } from "@/lib/corkboard"
import * as votingApi from "@/actions/voting"
import * as demoVoting from "@/lib/demo/voting"
import * as applicantIntelligence from "@/actions/applicant-intelligence"
import { defaultDisplayConfig, displayConfigSchema, projectApplicantDisplay } from "@/lib/applicant-display"
import { z } from "zod"
import * as accessSetup from "@/actions/interview-access-setup"
import * as demoAccessSetup from "@/lib/demo/interview-access-setup"
import * as roomApi from "@/actions/interview-rooms"
import * as demoRoomApi from "@/lib/demo/interview-rooms"
import * as recruitingRules from "@/actions/recruiting-rules"
import * as demoRecruitingRules from "@/lib/demo/recruiting-rules"
import * as clubOverview from "@/actions/club-overview"
import * as tasksApi from "@/actions/tasks"
import * as demoTasks from "@/lib/demo/tasks"
// The sole client data boundary: demo operations never invoke a server action.
import { anonymousApplication, identifiedApplication, validateAnonymousText, type ReviewApplication } from "@/lib/anonymous-review"
import { meetsTestRequirement, testRequirements } from "@/lib/test-scores"
import * as interviewResumes from "@/actions/interview-resumes"
import * as interviewGrants from "@/actions/organization-members"
import * as demoInterviews from "@/lib/demo/interview-foundation"
import * as interviewKits from "@/actions/interview-kits"
import * as collaboration from "@/actions/interview-collaboration"
import * as demoCollaboration from "@/lib/demo/interview-collaboration"
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
import { readVotingDisplay } from "@/lib/voting-presentation"
import { applicationInputSchema, answerErrors, normalizeApplicationAttachments, assertApplicationAttachmentOwnership } from "@/lib/student-applications"
import { genderValues, profileSectionSchema } from "@/lib/student-profile"
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
export const getStudentDashboardData = adapt(() => readWorkspace<Awaited<ReturnType<typeof apps.getStudentDashboardData>>>("studentDashboard"), () => demoDashboard())
export const getClubDirectory = adapt((...args: Parameters<typeof directory.getClubDirectory>) => readWorkspace<Awaited<ReturnType<typeof directory.getClubDirectory>>>("directory", args), () => ({
  clubs: demoDirectory(),
}))
export const getPublicClub = adapt((...args: Parameters<typeof directory.getPublicClub>) => readWorkspace<Awaited<ReturnType<typeof directory.getPublicClub>>>("publicClub", args), (id) => ({
  club: demoDirectory().find((c) => c.id === id || c.slug === id) || null,
}))
export const getClubPipeline = adapt((...args: Parameters<typeof crm.getClubPipeline>) => readWorkspace<Awaited<ReturnType<typeof crm.getClubPipeline>>>("pipeline", args), (clubId, filter = {}) => {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || clubId !== s.perspective.clubId || clubId !== s.clubs[0].id)
    throw new Error("Choose a club leader perspective.")
  const rounds = s.clubs.find(c => c.id === clubId)!.rounds;
  const selectedRound = rounds.find(r => r.id === filter.roundId);
  if ((filter.gender || filter.genderCounts) && (!selectedRound || !genderVisibility(s.applicantDisplay[selectedRound.id]?.config))) throw Error("Gender visibility must be explicitly enabled for this round.");
  const scoped = s.applications.filter(a => a.clubId === clubId && a.status !== "DRAFTING" && (!filter.roundId || a.roundId === filter.roundId));
  return {
    genderCounts: filter.genderCounts ? genderValues.map(gender => ({ gender, count: scoped.filter(a => s.students.find(u => u.id === a.studentId)?.profile.gender === gender).length })) : null,
    rounds: rounds.map(r => ({ ...r, type: /interview/i.test(r.name) ? "INTERVIEW" : "CUSTOM", genderVisible: genderVisibility(s.applicantDisplay[r.id]?.config) })),
    applications: s.applications
      .filter((a) => a.clubId === clubId && a.status !== "DRAFTING" && (!filter.roundId || a.roundId === filter.roundId) && (!filter.gender || s.students.find(u => u.id === a.studentId)?.profile.gender === filter.gender))
      .map((a) => { const app = joinedApplication(a.id); const projected = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === a.roundId)?.anonymousReview ? anonymousApplication(app as unknown as ReviewApplication, genderVisibility(s.applicantDisplay[a.roundId]?.config)) : identifiedApplication(app as unknown as ReviewApplication, genderVisibility(s.applicantDisplay[a.roundId]?.config)); return { ...projected, recruitmentOffer: s.recruitmentOffers.find(o=>o.applicationId===a.id) ?? null } }),
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
    assertRecruitmentRoundMove(app.status)
    const round = s.clubs.find(c=>c.id===input.clubId)!.rounds.find(r=>r.id===input.newRoundId)!
    if(app.status === "INTERVIEWING" && !/interview/i.test(round.name)) app.status = "IN_REVIEW"
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
    demoOffers.demoDecision(s, app.id, input.status)
    return { success: true, application: app }
  })
})
export const submitEvaluation = adapt(evaluation.submitEvaluation, demoInterviews.submitEvaluation)
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
  parsed.answers = normalizeApplicationAttachments(club.questions, parsed.answers)
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
  // Fictional bundled images are Demo presentation assets, never live attachments.
  const samplePhoto = input && typeof input === "object" && "section" in input && input.section === "identity" && "headshotUrl" in input && typeof input.headshotUrl === "string" && ["/images/landing/jordan-avery.jpg", "/demo/sample-headshot.svg"].includes(new URL(input.headshotUrl, "http://demo.invalid").pathname) ? input.headshotUrl : undefined;
  const parsed = profileSectionSchema.safeParse(samplePhoto ? { ...(input as Record<string, unknown>), headshotUrl: undefined } : input)
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
    else Object.assign(user.profile, fields, samplePhoto ? { headshotUrl: samplePhoto } : {})
    return { profile: user.profile }
  })
})
export const uploadProfileFile = adapt(storage.uploadProfileFile, () => {
  throw new Error("Uploads are disabled in Demo Mode. The sample PDF and photos stay isolated from production.")
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
  const app = joinedApplication(applicationId)
  return identifiedApplication(app as unknown as ReviewApplication, genderVisibility(demoStore.get().applicantDisplay[app.roundId]?.config))
})

export const saveAnonymousReviewContent = adapt(crm.saveAnonymousReviewContent, (clubId, applicationId, content, confirmed) => {
  scopedApplication(clubId, applicationId); if (!confirmed || content.length > 20000) throw new Error("Review and confirm the content first.")
  const app = joinedApplication(applicationId)
  validateAnonymousText(content, app.student)
  return demoStore.mutate(s => { s.applications.find(a => a.id === applicationId)!.anonymousReviewText = content.trim() || null; return { success: true } })
})

export const getInterviewKit = adapt(interviewKits.getInterviewKit, demoInterviews.getInterviewKit)
export const getInterviewWorkspace = adapt(interviewKits.getInterviewWorkspace, demoInterviews.getInterviewWorkspace)
export const getInterviewCollaboration = adapt(collaboration.getInterviewCollaboration, demoCollaboration.getInterviewCollaboration)
export const selectSharedInterviewQuestion = adapt(collaboration.selectSharedInterviewQuestion, demoCollaboration.selectSharedInterviewQuestion)
export const leaveInterviewCollaboration = adapt(collaboration.leaveInterviewCollaboration, demoCollaboration.leaveInterviewCollaboration)
export const dismissInterviewInvitation = adapt(collaboration.dismissInterviewInvitation, demoCollaboration.dismissInterviewInvitation)
export const prepareInterviewAdvance = adapt(collaboration.prepareInterviewAdvance, demoCollaboration.prepareInterviewAdvance)
export const confirmInterviewAdvance = adapt(collaboration.confirmInterviewAdvance, demoCollaboration.confirmInterviewAdvance)
export const saveInterviewKit = adapt(interviewKits.saveInterviewKit, demoInterviews.saveInterviewKit)
export const openInterviewSession = adapt(interviewKits.openInterviewSession, demoInterviews.openInterviewSession)
export const saveInterviewSession = adapt(interviewKits.saveInterviewSession, demoInterviews.saveInterviewSession)
export const getSubmittedInterviewReview = adapt(interviewKits.getSubmittedInterviewReview, demoInterviews.getSubmittedInterviewReview)
export const getSubmittedInterviewReviews = adapt(interviewKits.getSubmittedInterviewReviews, demoInterviews.getSubmittedInterviewReviews)
export const getPreviousInterviewScores = adapt(interviewKits.getPreviousInterviewScores, demoInterviews.getPreviousInterviewScores)
export const getInterviewApplicantPanel = adapt(interviewResumes.getInterviewApplicantPanel, demoInterviews.getInterviewApplicantPanel)
export const getInterviewResumeModerationQueue = adapt(interviewResumes.getInterviewResumeModerationQueue, demoInterviews.getInterviewResumeModerationQueue)
export const pinInterviewResume = adapt(interviewResumes.pinInterviewResume, demoInterviews.pinInterviewResume)
export const getInterviewResumeAnnotations = adapt(interviewResumes.getInterviewResumeAnnotations, demoInterviews.getInterviewResumeAnnotations)
export const saveInterviewResumeAnnotation = adapt(interviewResumes.saveInterviewResumeAnnotation, demoInterviews.saveInterviewResumeAnnotation)
export const deleteInterviewResumeAnnotation = adapt(interviewResumes.deleteInterviewResumeAnnotation, demoInterviews.deleteInterviewResumeAnnotation)
export const getInterviewAnnotationHistory = adapt(interviewResumes.getInterviewAnnotationHistory, demoInterviews.getInterviewAnnotationHistory)
export const setMemberInterviewOffices = adapt(interviewGrants.setMemberInterviewOffices, demoInterviews.setMemberInterviewOffices)
export const setInterviewPanelAssignment = adapt(interviewGrants.setInterviewPanelAssignment, demoInterviews.setInterviewPanelAssignment)
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
export const recruitmentAttendanceSummary=adapt((...args: Parameters<typeof meetingsApi.recruitmentAttendanceSummary>) => readWorkspace<Awaited<ReturnType<typeof meetingsApi.recruitmentAttendanceSummary>>>("attendance", args),(clubId,applicationId)=>{
  const app=scopedApplication(clubId,applicationId),s=demoStore.get(),held=s.meetings.filter(m=>m.clubId===clubId&&m.audience==="RECRUITMENT"&&m.date<=new Date())
  return{held:held.length,attended:s.meetingAttendances.filter(a=>a.studentId===app.studentId&&held.some(m=>m.id===a.eventId)).length}
})

// Semester work follows the same isolated demo boundary as recruitment.
export const getTaskNotifications = adapt((...args: Parameters<typeof tasksApi.getTaskNotifications>) => readWorkspace<Awaited<ReturnType<typeof tasksApi.getTaskNotifications>>>("taskNotifications", args), () => demoNotifications().filter(notification => "taskHref" in notification && notification.taskHref))
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

export const getClubWorkspaceOverview = adapt((...args: Parameters<typeof clubOverview.getClubWorkspaceOverview>) => readWorkspace<Awaited<ReturnType<typeof clubOverview.getClubWorkspaceOverview>>>("overview", args), (clubId) => {
 const s=demoStore.get(),user=demoUser(),membership=user.memberships.find(m=>m.clubId===clubId),club=s.clubs.find(c=>c.id===clubId)
 if(!membership||!club)throw new Error("Club workspace access unavailable.")
 const manage=clubId===s.clubs[0].id,now=new Date()
 return {
  club:{id:club.id,name:club.name,tagline:""},membership:{id:membership.id,isOwner:membership.isOwner,permissions:membership.permissions,interviewOffices:membership.interviewOffices,status:membership.status},
  meeting:s.meetings.filter(m=>m.clubId===clubId&&m.date>=now).sort((a,b)=>+a.date-+b.date).map(m=>({id:m.id,title:m.title,date:m.date,location:m.location,audience:m.audience}))[0]??null,
  work:s.tasks.filter(t=>t.clubId===clubId&&t.status!=="DONE").flatMap(t=>t.assignments.filter(a=>a.memberId===membership.id&&!a.submittedAt&&!a.reviewedAt).map(a=>({id:a.id,task:{id:t.id,title:t.title,dueAt:t.dueAt,kind:t.kind}}))).sort((a,b)=>(a.task.dueAt?+a.task.dueAt:Infinity)-(b.task.dueAt?+b.task.dueAt:Infinity)).slice(0,5),
  awaitingReview:manage?s.tasks.filter(t=>t.clubId===clubId).flatMap(t=>t.assignments).filter(a=>a.submittedAt&&!a.reviewedAt).length:null,
  recruitment:manage?[...new Set(s.applications.filter(a=>a.clubId===clubId&&a.status!=="DRAFTING").map(a=>a.status))].map(status=>({status,count:s.applications.filter(a=>a.clubId===clubId&&a.status===status).length})):null,
 }
})
export const getWorkspaceRounds = adapt((...args: Parameters<typeof clubOverview.getWorkspaceRounds>) => readWorkspace<Awaited<ReturnType<typeof clubOverview.getWorkspaceRounds>>>("rounds", args), clubId=>{
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


export const getApplicantDisplay = adapt((...args: Parameters<typeof applicantIntelligence.getApplicantDisplay>) => readWorkspace<Awaited<ReturnType<typeof applicantIntelligence.getApplicantDisplay>>>("applicantDisplay", args), input => {
  const s = demoStore.get();
  const joinedSession=input.sessionId?s.votingSessions?.find(v=>v.id===input.sessionId&&v.clubId===input.clubId&&v.candidates.some(c=>c.applicationId===input.applicationId)):undefined
  if(input.sessionId&&!joinedSession)throw Error("Voting presentation unavailable.")
  if(s.perspective.role!=="leader"&&joinedSession&&!joinedSession.participants.some(p=>p.joinedAt))throw Error("Join the Demo session first.")
  const app=joinedSession?s.applications.find(a=>a.id===input.applicationId&&a.clubId===s.clubs[0].id)!:scopedApplication(input.clubId,input.applicationId);
  if(!app)throw Error("Demo applicant unavailable.");
  const round = s.clubs[0].rounds.find(r => r.id === app.roundId)!;
  let config=s.applicantDisplay?.[round.id]?.config || defaultDisplayConfig
  if(input.previewConfig)config=input.previewConfig
  if(input.sessionId){const session=s.votingSessions?.find(v=>v.id===input.sessionId&&v.clubId===input.clubId&&v.candidates.some(c=>c.applicationId===app.id));if(!session)throw Error("Voting presentation unavailable.");config=readVotingDisplay(session.displayConfig)}
  // Match live disclosure: explicit leadership, final evidence, both anonymity contexts.
  const feedback: { items: string[]; withheld: boolean } = { items: [], withheld: true };
  const member = s.memberships.find(m => m.clubId === input.clubId && m.userId === s.students[0].id);
  if (config.fields.includes("feedback") && s.perspective.role === "leader" && member
    && app.studentId !== member.userId && !round.anonymousReview
    && hasPermission(member, "applications.review") && hasPermission(member, "applicants.identify") && interviewCapabilities(member).readClosing) {
    feedback.withheld = false;
    for (const evaluation of app.evaluations) {
      const historical = s.clubs[0].rounds.find(r => r.id === evaluation.roundId);
      if (!evaluation.submittedAt || !historical || historical.anonymousReview
        || s.interviews.some(r => r.applicationId === app.id && r.roundId === evaluation.roundId && r.interviewerId === evaluation.interviewerId && r.anonymousReview)) feedback.withheld = true;
      else if (evaluation.notes) feedback.items.push(`${evaluation.round} · Reviewer ${evaluation.interviewerId}\n${evaluation.notes}`);
    }
  }
  const display = projectApplicantDisplay(joinedApplication(app.id) as unknown as ReviewApplication, { ...round, applicantDisplay: s.applicantDisplay[round.id]?.config }, config, (s.observations || []).filter(o => o.applicationId === app.id), feedback);
  // The bundled fictional résumé is a demo asset, never a live private-download request.
  if (!display.anonymous && display.visible.includes("resume") && s.students.find(u => u.id === app.studentId)?.profile.resumeUrl === "/demo/sample-resume.pdf") {
    display.links = display.links.filter(link => link.field !== "resume")
    display.links.push({ field: "resume", label: "Sample résumé", href: "/demo/sample-resume.pdf" })
  }
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
export const getCorkboard = adapt((...args: Parameters<typeof directory.getCorkboard>) => readWorkspace<Awaited<ReturnType<typeof directory.getCorkboard>>>("corkboard", args), () => {
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
export const getTutorial = adapt((...args: Parameters<typeof tutorials.getTutorial>) => readWorkspace<Awaited<ReturnType<typeof tutorials.getTutorial>>>("tutorial", args), (experience, clubId) => {
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

export const getVotingJoinInfo = adapt(votingApi.getVotingJoinInfo, demoVoting.getVotingJoinInfo)
export async function joinVotingSession(sessionId:string,demoMemberId?:string){
  if(demoStore.active())return demoVoting.joinVotingSession(sessionId,demoMemberId)
  if(demoMemberId)throw Error("Demo identities are not valid in production.")
  return votingApi.joinVotingSession(sessionId)
}
export async function getJoinedVotingWorkspace(sessionId:string,demoMemberId?:string){
  if(demoStore.active())return demoVoting.getJoinedVotingWorkspace(sessionId,demoMemberId)
  if(demoMemberId)throw Error("Demo identities are not valid in production.")
  const info=await votingApi.getVotingJoinInfo(sessionId)
  if(!("clubId" in info)||!info.clubId)throw Error(`Session ${info.status.toLowerCase().replaceAll("_"," ")}.`)
  return votingApi.getVotingWorkspace(info.clubId,sessionId)
}

export const prepareResumeImport = adapt(resumeImport.prepareResumeImport, () => { throw new Error("PDF importing is disabled in Demo Mode.") })
export const confirmResumeImport = adapt(resumeImport.confirmResumeImport, () => { throw new Error("PDF importing is disabled in Demo Mode.") })

export const getInterviewAccessSetup = adapt(accessSetup.getInterviewAccessSetup, demoAccessSetup.getInterviewAccessSetup)
export const approveInterviewRoomPanel = adapt(accessSetup.approveInterviewRoomPanel, demoAccessSetup.approveInterviewRoomPanel)
export const changeInterviewRoomPanel = adapt(accessSetup.changeInterviewRoomPanel, demoAccessSetup.changeInterviewRoomPanel)
// Campus publication is never simulated as a live write in Demo Mode.
export const getPublicCorkboard = adapt(campusEvents.getPublicCorkboard, () => ({events: [], total: 0, hasMore: false, clubs: []}))
export const getPublicCampusEvent = adapt(campusEvents.getPublicCampusEvent, () => null)
const noDemoEventWrite = () => { throw new Error("Exit Demo Mode to manage campus events.") }
export const listClubCampusEvents = adapt(campusEvents.listClubCampusEvents, () => [])
export const saveCampusEvent = adapt(campusEvents.saveCampusEvent, noDemoEventWrite)
export const commandCampusEvent = adapt(campusEvents.commandCampusEvent, noDemoEventWrite)
export const uploadEventFlyer = adapt(eventFlyers.uploadEventFlyer, noDemoEventWrite)
export const getCampusEventRsvp = adapt(campusEvents.getCampusEventRsvp, () => ({going:false}))
export const setCampusEventRsvp = adapt(campusEvents.setCampusEventRsvp, noDemoEventWrite)
export const getCampusEventAttendees = adapt(campusEvents.getCampusEventAttendees, () => [])
export const getMyCampusEventRsvps = adapt(campusEvents.getMyCampusEventRsvps, () => [])

export const respondToOffer = adapt(offers.respondToOffer, demoOffers.respondToOffer)
export const revokeRecruitmentOffer = adapt(offers.revokeRecruitmentOffer, demoOffers.revokeRecruitmentOffer)
