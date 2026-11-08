// Demo Mode implementations of the workspace API. Loaded on demand by
// lib/workspace-api.ts while Demo Mode is active; never imported statically
// by live code. Each export mirrors the facade export of the same name.
import { pipelineListProjection } from "@/lib/pipeline-list";
import { pagePipeline, completePipelineSelection, pipelinePageQuery, pipelineSelectionKey } from "@/lib/pipeline-page";
import * as demoPipeline from "./pipeline";
import * as demoInterviewEntry from "./interview-entry";
import * as demoBookingApi from "./interview-booking";
import * as demoDecisionCommunications from "./communications";
import * as demoOffers from "./recruitment-offers";
import { assertRecruitmentRoundMove } from "@/lib/recruitment-lifecycle";
import { interviewCapabilities } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
import { organizationCapabilities } from "@/lib/organization-authorization";
import * as demoRankedReview from "./ranked-review";
import * as demoInterviewFeedback from "./interview-feedback";
import { genderVisibility } from "@/lib/recruitment-profile";
import type * as tutorials from "@/actions/tutorials"
import { tutorialExperience, tutorialInput } from "@/lib/tutorials"
import { corkboardInput } from "@/lib/corkboard"
import * as demoVoting from "./voting"
import { defaultDisplayConfig, displayConfigSchema, projectApplicantDisplay } from "@/lib/applicant-display"
import { z } from "zod"
import * as demoAccessSetup from "./interview-access-setup"
import * as demoRoomApi from "./interview-rooms"
import * as demoRecruitingRules from "./recruiting-rules"
import { demoDashboardSummary } from "./dashboard-summary"
import * as demoTasks from "./tasks"
import { anonymousApplication, identifiedApplication, validateAnonymousText, type ReviewApplication } from "@/lib/anonymous-review"
import { meetsTestRequirement, testRequirements } from "@/lib/test-scores"
import * as demoInterviews from "./interview-foundation"
import * as demoCollaboration from "./interview-collaboration"
import { meetingInputSchema, canReadMeeting, TOKEN_LIFETIME_MS } from "@/lib/meetings"
import type * as apps from "@/actions/applications"
import type * as evaluation from "@/actions/evaluations"
import type * as profile from "@/actions/profile"
import { demoStore, demoMember, demoUser, joinedApplication, studentApplications, demoDirectory, demoDashboard, demoNotifications, presentDemoMeeting, } from "./store"
import { readVotingDisplay } from "@/lib/voting-presentation"
import { applicationInputSchema, applicationAnswersKey, answerErrors, normalizeApplicationAttachments, assertApplicationAttachmentOwnership } from "@/lib/student-applications"
import { genderValues, profileSectionSchema } from "@/lib/student-profile"
import * as api from "@/lib/workspace-api"
type Api = typeof api
type Demo<K extends keyof Api> = (...args: Parameters<Api[K]>) => unknown
export { demoVoting }
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
  const { applicationId } = await api.startClubApplication(parsed.clubId)
  return demoStore.mutate((next) => {
    const app = next.applications.find((a) => a.id === applicationId)!
    if (app.status !== "DRAFTING") throw new Error("Application already submitted.")
    if (parsed.expectedAnswers !== undefined && applicationAnswersKey(app.answers) !== parsed.expectedAnswers && applicationAnswersKey(app.answers) !== applicationAnswersKey(parsed.answers)) throw Error("This application changed in another tab.")
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
function demoMeetingAccess(id: string) {
  const s=demoStore.get(), meeting=s.meetings.find(m=>m.id===id), membership=s.memberships.find(m=>m.clubId===meeting?.clubId&&m.userId===demoUser().id)
  if(!meeting || !canReadMeeting(meeting,membership?{}:null))throw new Error("Meeting unavailable or access denied.")
  return presentDemoMeeting(meeting)
}
function demoMeetingManager(clubId:string){demoMember();if(clubId!==demoStore.get().clubs[0].id)throw new Error("Access denied.")}
function demoTutorialScope(experience: unknown, clubId?: string) {
  const kind = tutorialExperience.parse(experience), state = demoStore.get()
  if (kind === "leader" && (state.perspective.role !== "leader" || clubId !== state.clubs[0].id)) throw new Error("Choose the MII leader workspace.")
  return kind
}
const noDemoEventWrite = () => { throw new Error("Exit Demo Mode to manage campus events.") }
export const getPanelProposalWorkspace: Demo<"getPanelProposalWorkspace"> = (scope) => demoBookingApi.getPanelProposalWorkspace(scope as Parameters<typeof demoBookingApi.getPanelProposalWorkspace>[0])
export const generatePanelProposal: Demo<"generatePanelProposal"> = (scope) => demoBookingApi.generatePanelProposal(scope as Parameters<typeof demoBookingApi.generatePanelProposal>[0])
export const previewPanelProposalEdits: Demo<"previewPanelProposalEdits"> = (scope) => demoBookingApi.previewPanelProposalEdits(scope as Parameters<typeof demoBookingApi.previewPanelProposalEdits>[0])
export const savePanelProposalDraft: Demo<"savePanelProposalDraft"> = (scope) => demoBookingApi.savePanelProposalDraft(scope as Parameters<typeof demoBookingApi.savePanelProposalDraft>[0])
export const discardPanelProposal: Demo<"discardPanelProposal"> = (scope) => demoBookingApi.discardPanelProposal(scope as Parameters<typeof demoBookingApi.discardPanelProposal>[0])
export const beginPanelScheduleRevision: Demo<"beginPanelScheduleRevision"> = (scope) => demoBookingApi.beginPanelScheduleRevision(scope as Parameters<typeof demoBookingApi.beginPanelScheduleRevision>[0])
export const revalidatePanelDraft: Demo<"revalidatePanelDraft"> = (scope) => demoBookingApi.revalidatePanelDraft(scope as Parameters<typeof demoBookingApi.revalidatePanelDraft>[0])
export const reviewPanelPublication: Demo<"reviewPanelPublication"> = (scope) => demoBookingApi.reviewPanelPublication(scope as Parameters<typeof demoBookingApi.reviewPanelPublication>[0])
export const publishPanelSchedule: Demo<"publishPanelSchedule"> = (scope) => demoBookingApi.publishPanelSchedule(scope as Parameters<typeof demoBookingApi.publishPanelSchedule>[0])
export const assignPanelAvailabilityOverride: Demo<"assignPanelAvailabilityOverride"> = (scope) => demoBookingApi.assignPanelAvailabilityOverride(scope as Parameters<typeof demoBookingApi.assignPanelAvailabilityOverride>[0])
export const revokePanelAvailabilityOverride: Demo<"revokePanelAvailabilityOverride"> = (scope) => demoBookingApi.revokePanelAvailabilityOverride(scope as Parameters<typeof demoBookingApi.revokePanelAvailabilityOverride>[0])
export const getInterviewBookingPublication: Demo<"getInterviewBookingPublication"> = (scope) => demoBookingApi.getInterviewBookingPublication(scope as Parameters<typeof demoBookingApi.getInterviewBookingPublication>[0])
export const setInterviewBookingPublication: Demo<"setInterviewBookingPublication"> = (scope) => demoBookingApi.setInterviewBookingPublication(scope as Parameters<typeof demoBookingApi.setInterviewBookingPublication>[0])
export const getStudentApplications: Demo<"getStudentApplications"> = () =>
  studentApplications()
export const getStudentDashboardData: Demo<"getStudentDashboardData"> = () => demoDashboard()
export const getClubDirectory: Demo<"getClubDirectory"> = () => ({
  clubs: demoDirectory(),
})
export const getPublicClub: Demo<"getPublicClub"> = (id) => ({
  club: demoDirectory().find((c) => c.id === id || c.slug === id) || null,
})
export const getClubPipeline: Demo<"getClubPipeline"> = (clubId, filter = {}) => {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || clubId !== s.perspective.clubId || clubId !== s.clubs[0].id)
    throw new Error("Choose a club leader perspective.")
  const rounds = s.clubs.find(c => c.id === clubId)!.rounds;
  const selectedRound = rounds.find(r => r.id === filter.roundId);
  if ((filter.gender || filter.genderCounts) && (!selectedRound || !genderVisibility(s.applicantDisplay[selectedRound.id]?.config))) throw Error("Gender visibility must be explicitly enabled for this round.");
  const scoped = s.applications.filter(a => a.clubId === clubId && a.status !== "DRAFTING" && (!filter.applicationId || a.id === filter.applicationId) && (!filter.roundId || a.roundId === filter.roundId));
  return {
    genderCounts: filter.genderCounts ? genderValues.map(gender => ({ gender, count: scoped.filter(a => s.students.find(u => u.id === a.studentId)?.profile.gender === gender).length })) : null,
    rounds: rounds.map(r => ({ ...r, type: /interview/i.test(r.name) ? "INTERVIEW" : "CUSTOM", genderVisible: genderVisibility(s.applicantDisplay[r.id]?.config) })),
    applications: s.applications
      .filter((a) => a.clubId === clubId && a.status !== "DRAFTING" && (!filter.applicationId || a.id === filter.applicationId) && (!filter.roundId || a.roundId === filter.roundId) && (!filter.gender || s.students.find(u => u.id === a.studentId)?.profile.gender === filter.gender))
      .map((a) => { const app = joinedApplication(a.id); const projected = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === a.roundId)?.anonymousReview ? anonymousApplication(app as unknown as ReviewApplication, genderVisibility(s.applicantDisplay[a.roundId]?.config)) : identifiedApplication(app as unknown as ReviewApplication, genderVisibility(s.applicantDisplay[a.roundId]?.config)); const ownSubmitted = a.evaluations.some(e=>e.interviewerId===demoMember().id&&e.roundId===a.roundId&&e.submittedAt); const assigned=s.interviewFoundation.assignments.some(g=>g.applicationId===a.id&&g.roundId===a.roundId&&g.memberId===demoMember().id&&!g.revokedAt);const caps=interviewCapabilities(demoMember());const self=a.studentId===demoMember().userId;const allowed=!self&&((caps.readClosing&&!assigned)||caps.participate&&assigned&&ownSubmitted); const roundScore=allowed?demoInterviews.getInterviewRoundScore({clubId,applicationId:a.id,roundId:a.roundId}):null;return { ...projected, evaluations: projected.evaluations.filter(e=>!self&&e.submittedAt&&(caps.participate&&e.interviewerId===demoMember().id&&s.interviewFoundation.assignments.some(g=>g.applicationId===a.id&&g.roundId===e.roundId&&g.memberId===demoMember().id&&!g.revokedAt)||allowed&&e.roundId===a.roundId)), roundScore, canEvaluate: !self && !ownSubmitted && (s.clubs.find(c=>c.id===clubId)?.rounds.find(r=>r.id===a.roundId)?.anonymousReview ? caps.participate : caps.participate && assigned), recruitmentOffer: s.recruitmentOffers.find(o=>o.applicationId===a.id) ?? null } }),
  }
}
export const getClubPipelineList: Demo<"getClubPipelineList"> = async (...args: Parameters<typeof getClubPipeline>) => pipelineListProjection(await api.getClubPipeline(...args))
export const getClubPipelinePage: Demo<"getClubPipelinePage"> = async (clubId, input = {}) => {
    const query = pipelinePageQuery.parse(input), member = demoMember()
    const list = await api.getClubPipeline(clubId, { roundId: query.roundId, gender: query.gender, genderCounts: query.genderCounts })
    const page = pagePipeline(list, query, member.id, member.userId, `demo:${clubId}:${member.id}:${pipelineSelectionKey(query)}`)
    return { ...page, coverage: { mode: query.mode, complete: !query.roundId && !query.gender && !query.genderCounts && page.page.start === 0 && page.applications.length === page.page.baseTotal } }
  }
export const getClubPipelineSelection: Demo<"getClubPipelineSelection"> = async (clubId, input = {}) => {
    const query = pipelinePageQuery.omit({ cursor: true }).parse(input), member = demoMember()
    const list = await api.getClubPipelineList(clubId, { roundId: query.roundId, gender: query.gender })
    return completePipelineSelection(list, query, member.id, member.userId)
  }
export const moveApplicantRound: Demo<"moveApplicantRound"> = (input) => {
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
      throw new Error("Application changed. Reload the page and try again.")
    assertRecruitmentRoundMove(app.status)
    const round = s.clubs.find(c=>c.id===input.clubId)!.rounds.find(r=>r.id===input.newRoundId)!
    if(app.status === "INTERVIEWING" && !/interview/i.test(round.name)) app.status = "IN_REVIEW"
    app.roundId = input.newRoundId
    return { success: true, application: app }
  })
}
export const setApplicationStatus: Demo<"setApplicationStatus"> = (input) => {
  const app = scopedApplication(input.clubId, input.applicationId)
  if (input.expectedStatus && app.status !== input.expectedStatus)
    throw new Error("This candidate changed. Reload the page and try again.")
  return demoStore.mutate((s) => {
    const app = s.applications.find((a) => a.id === input.applicationId)!
    demoOffers.demoDecision(s, app.id, input.status)
    return { success: true, application: app }
  })
}
export const submitEvaluation: Demo<"submitEvaluation"> = demoInterviews.submitEvaluation
export const startClubApplication: Demo<"startClubApplication"> = (clubId) => {
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
}
export const saveApplicationDraft: Demo<"saveApplicationDraft"> = (input) =>
  persist(input, false)
export const submitApplication: Demo<"submitApplication"> = (input) => persist(input, true)
export const getStudentProfile: Demo<"getStudentProfile"> = () => ({
  profile: demoUser().profile,
})
export const updateStudentProfileSection: Demo<"updateStudentProfileSection"> = (input) => {
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
}
export const uploadProfileFile: Demo<"uploadProfileFile"> = () => {
  throw new Error("Uploads are disabled in Demo Mode. The sample PDF and photos stay isolated from production.")
}
export const searchWorkspace: Demo<"searchWorkspace"> = (query, leader = false) => {
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
}
export const setRoundAnonymousReview: Demo<"setRoundAnonymousReview"> = (clubId, roundId, enabled) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id) throw new Error("Access denied.")
  return demoStore.mutate(s => { const round = s.clubs[0].rounds.find(r => r.id === roundId); if (!round) throw new Error("Round unavailable."); round.anonymousReview = enabled; return { success: true } })
}
export const setClubTestRequirement: Demo<"setClubTestRequirement"> = (clubId, requirement) => {
  demoMember(); if (clubId !== demoStore.get().clubs[0].id || !testRequirements.includes(requirement as typeof testRequirements[number])) throw new Error("Invalid requirement.")
  return demoStore.mutate(s => { s.clubs[0].testRequirement = requirement; return { success: true } })
}
export const revealApplicantIdentity: Demo<"revealApplicantIdentity"> = (clubId, applicationId, reason) => {
  scopedApplication(clubId, applicationId); if (reason.trim().length < 10) throw new Error("Add a reason.")
  const app = joinedApplication(applicationId)
  return identifiedApplication(app as unknown as ReviewApplication, genderVisibility(demoStore.get().applicantDisplay[app.roundId]?.config))
}
export const saveAnonymousReviewContent: Demo<"saveAnonymousReviewContent"> = (clubId, applicationId, content, confirmed) => {
  scopedApplication(clubId, applicationId); if (!confirmed || content.length > 20000) throw new Error("Review and confirm the content first.")
  const app = joinedApplication(applicationId)
  validateAnonymousText(content, app.student)
  return demoStore.mutate(s => { s.applications.find(a => a.id === applicationId)!.anonymousReviewText = content.trim() || null; return { success: true } })
}
export const getInterviewKit: Demo<"getInterviewKit"> = demoInterviews.getInterviewKit
export const getInterviewWorkspace: Demo<"getInterviewWorkspace"> = demoInterviews.getInterviewWorkspace
export const getAssignedInterviewRooms: Demo<"getAssignedInterviewRooms"> = demoInterviewEntry.getAssignedInterviewRooms
export const resolveInterviewRoomEntry: Demo<"resolveInterviewRoomEntry"> = demoInterviewEntry.resolveInterviewRoomEntry
export const getEarlierInterviewReviews: Demo<"getEarlierInterviewReviews"> = demoInterviews.getEarlierInterviewReviews
export const getInterviewRoundScore: Demo<"getInterviewRoundScore"> = demoInterviews.getInterviewRoundScore
export const getInterviewCollaboration: Demo<"getInterviewCollaboration"> = demoCollaboration.getInterviewCollaboration
export const selectSharedInterviewQuestion: Demo<"selectSharedInterviewQuestion"> = demoCollaboration.selectSharedInterviewQuestion
export const leaveInterviewCollaboration: Demo<"leaveInterviewCollaboration"> = demoCollaboration.leaveInterviewCollaboration
export const dismissInterviewInvitation: Demo<"dismissInterviewInvitation"> = demoCollaboration.dismissInterviewInvitation
export const prepareInterviewAdvance: Demo<"prepareInterviewAdvance"> = demoCollaboration.prepareInterviewAdvance
export const confirmInterviewAdvance: Demo<"confirmInterviewAdvance"> = demoCollaboration.confirmInterviewAdvance
export const saveInterviewKit: Demo<"saveInterviewKit"> = demoInterviews.saveInterviewKit
export const openInterviewSession: Demo<"openInterviewSession"> = demoInterviews.openInterviewSession
export const saveInterviewSession: Demo<"saveInterviewSession"> = demoInterviews.saveInterviewSession
export const getSubmittedInterviewReview: Demo<"getSubmittedInterviewReview"> = demoInterviews.getSubmittedInterviewReview
export const getSubmittedInterviewReviews: Demo<"getSubmittedInterviewReviews"> = demoInterviews.getSubmittedInterviewReviews
export const getPreviousInterviewScores: Demo<"getPreviousInterviewScores"> = demoInterviews.getPreviousInterviewScores
export const getInterviewApplicantPanel: Demo<"getInterviewApplicantPanel"> = demoInterviews.getInterviewApplicantPanel
export const getInterviewResumeModerationQueue: Demo<"getInterviewResumeModerationQueue"> = demoInterviews.getInterviewResumeModerationQueue
export const pinInterviewResume: Demo<"pinInterviewResume"> = demoInterviews.pinInterviewResume
export const getInterviewResumeAnnotations: Demo<"getInterviewResumeAnnotations"> = demoInterviews.getInterviewResumeAnnotations
export const saveInterviewResumeAnnotation: Demo<"saveInterviewResumeAnnotation"> = demoInterviews.saveInterviewResumeAnnotation
export const deleteInterviewResumeAnnotation: Demo<"deleteInterviewResumeAnnotation"> = demoInterviews.deleteInterviewResumeAnnotation
export const getInterviewAnnotationHistory: Demo<"getInterviewAnnotationHistory"> = demoInterviews.getInterviewAnnotationHistory
export const setMemberInterviewOffices: Demo<"setMemberInterviewOffices"> = demoInterviews.setMemberInterviewOffices
export const setInterviewPanelAssignment: Demo<"setInterviewPanelAssignment"> = demoInterviews.setInterviewPanelAssignment
export const getInterviewRounds: Demo<"getInterviewRounds"> = demoInterviews.getInterviewRounds
export const listMeetings: Demo<"listMeetings"> = clubId => {
  const s=demoStore.get(),user=demoUser()
  return s.meetings.filter(m=>(!clubId||m.clubId===clubId)&&canReadMeeting(m,s.memberships.some(member=>member.clubId===m.clubId&&member.userId===user.id)?{}:null)).sort((a,b)=>b.date.getTime()-a.date.getTime()).map(presentDemoMeeting)
}
export const getMeeting: Demo<"getMeeting"> = id=>demoMeetingAccess(id)
export const saveMeeting: Demo<"saveMeeting"> = input=>{
  const data=meetingInputSchema.parse(input);demoMeetingManager(data.clubId)
  return demoStore.mutate(s=>{
    const old=data.id?s.meetings.find(m=>m.id===data.id&&m.clubId===data.clubId):undefined
    if(data.id&&(!old||old.revision!==data.revision))throw new Error("Meeting changed. Reload before editing.")
    const value={...data,id:old?.id||crypto.randomUUID(),revision:old?old.revision+1:0,isPublic:data.audience==="RECRUITMENT",club:{name:s.clubs[0].name}}
    if(old)Object.assign(old,value);else s.meetings.push(value)
    s.meetingTokens=s.meetingTokens.filter(t=>t.meetingId!==value.id)
    return value
  })
}
export const issueMeetingCheckIn: Demo<"issueMeetingCheckIn"> = (clubId,meetingId)=>{
  demoMeetingManager(clubId);const meeting=demoMeetingAccess(meetingId);if(meeting.clubId!==clubId)throw new Error("Meeting unavailable.")
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,"0")).join(""), expiresAt=new Date(Date.now()+TOKEN_LIFETIME_MS).toISOString()
  return demoStore.mutate(s=>{s.meetingTokens=s.meetingTokens.filter(t=>new Date(t.expiresAt).getTime()>Date.now());s.meetingTokens.push({meetingId,token,expiresAt,issuedBy:demoUser().id});return{token,expiresAt}})
}
export const closeMeetingCheckIn: Demo<"closeMeetingCheckIn"> = (clubId,meetingId)=>{
  demoMeetingManager(clubId);if(demoMeetingAccess(meetingId).clubId!==clubId)throw new Error("Meeting unavailable.")
  return demoStore.mutate(s=>{s.meetingTokens=s.meetingTokens.filter(t=>t.meetingId!==meetingId);return{success:true}})
}
export const checkInMeeting: Demo<"checkInMeeting"> = (meetingId,token)=>{
  demoMeetingAccess(meetingId)
  return demoStore.mutate(s=>{
    if(!s.meetingTokens.some(t=>t.meetingId===meetingId&&t.token===token&&new Date(t.expiresAt).getTime()>Date.now()))throw new Error("This code has expired or was closed. Scan the current QR code.")
    const studentId=demoUser().id,existing=s.meetingAttendances.find(a=>a.eventId===meetingId&&a.studentId===studentId)
    if(existing)return{status:"already-checked-in",checkedInAt:existing.checkedInAt.toISOString()}
    const attendance={id:crypto.randomUUID(),eventId:meetingId,studentId,checkedInAt:new Date()};s.meetingAttendances.push(attendance);return{status:"checked-in",checkedInAt:attendance.checkedInAt.toISOString()}
  })
}
export const meetingAttendance: Demo<"meetingAttendance"> = (clubId,meetingId)=>{
  demoMeetingManager(clubId);if(demoMeetingAccess(meetingId).clubId!==clubId)throw new Error("Meeting unavailable.")
  const s=demoStore.get();return s.meetingAttendances.filter(a=>a.eventId===meetingId).map(a=>{const student=s.students.find(p=>p.id===a.studentId)!;const anonymous=s.applications.some(app=>app.studentId===student.id&&app.clubId===clubId&&s.clubs.find(c=>c.id===clubId)?.rounds.find(r=>r.id===app.roundId)?.anonymousReview);return{id:a.id,checkedInAt:a.checkedInAt.toISOString(),name:anonymous?"Anonymous applicant":`${student.profile.firstName} ${student.profile.lastName}`,email:anonymous?null:student.email}})
}
export const recruitmentAttendanceSummary: Demo<"recruitmentAttendanceSummary"> = (clubId,applicationId)=>{
  const app=scopedApplication(clubId,applicationId),s=demoStore.get(),held=s.meetings.filter(m=>m.clubId===clubId&&m.audience==="RECRUITMENT"&&m.date<=new Date())
  return{held:held.length,attended:s.meetingAttendances.filter(a=>a.studentId===app.studentId&&held.some(m=>m.id===a.eventId)).length}
}
export const getTaskNotifications: Demo<"getTaskNotifications"> = () => demoNotifications().filter(notification => "taskHref" in notification && notification.taskHref)
export const getTaskWorkspace: Demo<"getTaskWorkspace"> = demoTasks.getTaskWorkspace
export const saveTask: Demo<"saveTask"> = demoTasks.saveTask
export const previewTaskAudience: Demo<"previewTaskAudience"> = demoTasks.previewTaskAudience
export const bulkUpdateTasks: Demo<"bulkUpdateTasks"> = demoTasks.bulkUpdateTasks
export const addTaskRecipients: Demo<"addTaskRecipients"> = demoTasks.addTaskRecipients
export const bulkApproveTaskSubmissions: Demo<"bulkApproveTaskSubmissions"> = demoTasks.bulkApproveTaskSubmissions
export const updateTaskMember: Demo<"updateTaskMember"> = demoTasks.updateTaskMember
export const viewTask: Demo<"viewTask"> = demoTasks.viewTask
export const submitTask: Demo<"submitTask"> = demoTasks.submitTask
export const reviewTask: Demo<"reviewTask"> = demoTasks.reviewTask
export const uploadTaskFile: Demo<"uploadTaskFile"> = () => { throw new Error("Demo files stay fictional. Use a text or link submission; no files are uploaded.") }
export const downloadTaskFile: Demo<"downloadTaskFile"> = id => {
  const s = demoStore.get()
  const task = s.tasks.find(t => t.assignments.some(a => a.files.some(f => f.id === id)))
  if (!task) throw new Error("File unavailable.")
  const workspace = demoTasks.getTaskWorkspace(task.clubId)
  if (!workspace.tasks.some(t => t.assignments.some(a => a.files.some(f => f.id === id)))) throw new Error("File unavailable.")
  return { url: "/demo/sample-research.txt" }
}
export const getClubWorkspaceOverview: Demo<"getClubWorkspaceOverview"> = (clubId) => {
 const s=demoStore.get(),user=demoUser(),membership=user.memberships.find(m=>m.clubId===clubId),club=s.clubs.find(c=>c.id===clubId)
 if(!membership||!club)throw new Error("Club workspace access unavailable.")
 const manage=clubId===s.clubs[0].id,now=new Date()
 return {
  operations:demoDashboardSummary(clubId,membership.id),
  upcomingInterviews:null,votingSessions:null,
  // Read-only counts from the demo store; demo has no pending invitations.
  members:organizationCapabilities(membership).canManageMembers||organizationCapabilities(membership).canChangeRoles?{active:s.memberships.filter(m=>m.clubId===clubId&&m.status==="ACTIVE").length,pendingInvitations:0,recent:0}:null,
  club:{id:club.id,name:club.name,tagline:""},membership:{id:membership.id,isOwner:membership.isOwner,permissions:membership.permissions,interviewOffices:membership.interviewOffices,status:membership.status},
  meeting:s.meetings.filter(m=>m.clubId===clubId&&m.date>=now).sort((a,b)=>+a.date-+b.date).map(m=>({id:m.id,title:m.title,date:m.date,location:m.location,audience:m.audience}))[0]??null,
  work:s.tasks.filter(t=>t.clubId===clubId&&!["DRAFT","DONE"].includes(t.status)).flatMap(t=>t.assignments.filter(a=>a.memberId===membership.id&&(!a.submittedAt||a.revisionRequestedAt)&&!a.reviewedAt).map(a=>({id:a.id,task:{id:t.id,title:t.title,dueAt:t.dueAt,kind:t.kind}}))).sort((a,b)=>(a.task.dueAt?+a.task.dueAt:Infinity)-(b.task.dueAt?+b.task.dueAt:Infinity)).slice(0,5),
  awaitingReview:manage?s.tasks.filter(t=>t.clubId===clubId).flatMap(t=>t.assignments).filter(a=>a.submittedAt&&!a.reviewedAt).length:null,
  recruitment:manage?[...new Set(s.applications.filter(a=>a.clubId===clubId&&a.status!=="DRAFTING").map(a=>a.status))].map(status=>({status,count:s.applications.filter(a=>a.clubId===clubId&&a.status===status).length})):null,
 }
}
export const getDashboardReviewQueue: Demo<"getDashboardReviewQueue"> = async (clubId, roundId) => { const data = await api.getClubWorkspaceOverview(clubId); return demoDashboardSummary(clubId, data.membership.id, roundId).queue }
export const getWorkspaceRounds: Demo<"getWorkspaceRounds"> = clubId=>{
 const s=demoStore.get();if(clubId!==s.clubs[0].id)throw new Error("Demo management is limited to MII.")
 return s.clubs[0].rounds.map(r=>({id:r.id,name:r.name,anonymousReview:r.anonymousReview}))
}
export const getRecruitingRules: Demo<"getRecruitingRules"> = demoRecruitingRules.getRecruitingRules
export const saveRecruitingRule: Demo<"saveRecruitingRule"> = demoRecruitingRules.saveRecruitingRule
export const previewRecruitingRule: Demo<"previewRecruitingRule"> = demoRecruitingRules.previewRecruitingRule
export const applyRecruitingRuleFlags: Demo<"applyRecruitingRuleFlags"> = demoRecruitingRules.applyRecruitingRuleFlags
export const getRecruitingRuleFlags: Demo<"getRecruitingRuleFlags"> = demoRecruitingRules.getRecruitingRuleFlags
export const clearRecruitingRuleFlags: Demo<"clearRecruitingRuleFlags"> = demoRecruitingRules.clearRecruitingRuleFlags
export const getRoomWorkspace: Demo<"getRoomWorkspace"> = demoRoomApi.getRoomWorkspace
export const createInterviewRoom: Demo<"createInterviewRoom"> = demoRoomApi.createInterviewRoom
export const setInterviewStaffingRequirement: Demo<"setInterviewStaffingRequirement"> = raw=>demoRoomApi.setInterviewStaffingRequirement(raw as Parameters<typeof demoRoomApi.setInterviewStaffingRequirement>[0])
export const setInterviewRoomOpen: Demo<"setInterviewRoomOpen"> = demoRoomApi.setInterviewRoomOpen
export const getApplicantSchedule: Demo<"getApplicantSchedule"> = demoRoomApi.getApplicantSchedule
export const reserveInterview: Demo<"reserveInterview"> = demoRoomApi.reserveInterview
export const cancelRoomBooking: Demo<"cancelRoomBooking"> = demoRoomApi.cancelRoomBooking
export const getBookingApplication: Demo<"getBookingApplication"> = demoRoomApi.getBookingApplication
export const getApplicantDisplay: Demo<"getApplicantDisplay"> = input => {
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
}
export const getApplicantDisplayConfiguration: Demo<"getApplicantDisplayConfiguration"> = (clubId, roundId) => {
  demoMeetingManager(clubId);
  if (!demoStore.get().clubs[0].rounds.some(r => r.id === roundId)) throw new Error("Round unavailable.");
  return demoStore.get().applicantDisplay?.[roundId] || { config: defaultDisplayConfig, version: 0 };
}
export const saveApplicantDisplayConfiguration: Demo<"saveApplicantDisplayConfiguration"> = input => {
  const data = z.object({ clubId: z.string(), roundId: z.string(), version: z.number(), config: displayConfigSchema }).parse(input);
  demoMeetingManager(data.clubId);
  if (!demoStore.get().clubs[0].rounds.some(r => r.id === data.roundId)) throw new Error("Round unavailable.");
  return demoStore.mutate(s => {
    s.applicantDisplay ??= {};
    if ((s.applicantDisplay[data.roundId]?.version || 0) !== data.version) throw new Error("Configuration changed. Reload.");
    return s.applicantDisplay[data.roundId] = { config: data.config, version: data.version + 1 };
  });
}
export const saveApplicantObservation: Demo<"saveApplicantObservation"> = input => {
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
}
export const deleteApplicantObservation: Demo<"deleteApplicantObservation"> = input => {
  const data = z.object({ clubId: z.string(), applicationId: z.string(), id: z.string() }).parse(input);
  const app = scopedApplication(data.clubId, data.applicationId);
  if (demoStore.get().clubs[0].rounds.find(r => r.id === app.roundId)?.anonymousReview) throw new Error("Pros and Cons are withheld during anonymous review.");
  return demoStore.mutate(s => {
    if (!s.observations?.some(o => o.id === data.id && o.applicationId === app.id && o.own)) throw new Error("Only the author can delete this observation.");
    s.observations = s.observations.filter(o => o.id !== data.id);
    return { success: true };
  });
}
export const getVotingWorkspace: Demo<"getVotingWorkspace"> = async (clubId, sessionId, selectionQuery) => ({ ...await demoVoting.getVotingWorkspace(clubId, sessionId), candidateSelection: selectionQuery ? await getClubPipelineSelection(clubId, selectionQuery) : null })
export const createVotingSession: Demo<"createVotingSession"> = demoVoting.createVotingSession
export const submitVotingBallot: Demo<"submitVotingBallot"> = demoVoting.submitVotingBallot
export const commandVotingSession: Demo<"commandVotingSession"> = demoVoting.commandVotingSession
export const getCorkboard: Demo<"getCorkboard"> = () => {
  const s = demoStore.get()
  const clubs = demoDirectory()
  return { items: [...s.corkboard].sort((a,b) => b.savedAt.getTime()-a.savedAt.getTime() || a.clubId.localeCompare(b.clubId)).map(item => ({ club: clubs.find(c => c.id === item.clubId)!, savedAt: item.savedAt.toISOString() })) }
}
export const setCorkboardClub: Demo<"setCorkboardClub"> = input => {
  const data = corkboardInput.parse(input)
  return demoStore.mutate(s => {
    if (!s.clubs.some(c => c.id === data.clubId)) throw new Error("Club unavailable.")
    if (!data.saved) { s.corkboard = s.corkboard.filter(item => item.clubId !== data.clubId); return { saved: false, savedAt: null } }
    let item = s.corkboard.find(item => item.clubId === data.clubId)
    if (!item) { item = { clubId: data.clubId, savedAt: new Date(`${s.anchor}T12:00:00Z`) }; s.corkboard.push(item) }
    return { saved: true, savedAt: item.savedAt.toISOString() }
  })
}
export const getTutorial: Demo<"getTutorial"> = (experience, clubId) => {
  const kind = demoTutorialScope(experience, clubId)
  return demoStore.get().tutorials[kind]
}
export const saveTutorial: Demo<"saveTutorial"> = input => {
  const data = tutorialInput.parse(input), kind = demoTutorialScope(data.experience, data.clubId)
  return demoStore.mutate(s => {
    const previous = s.tutorials[kind]
    if (data.action !== "restart" && previous.status !== "IN_PROGRESS") return previous
    return s.tutorials[kind] = { status: data.action === "skip" ? "SKIPPED" : data.action === "complete" ? "COMPLETED" : "IN_PROGRESS", step: data.action === "restart" ? 0 : data.step, version: 1 }
  })
}
export const getVotingJoinInfo: Demo<"getVotingJoinInfo"> = demoVoting.getVotingJoinInfo
export const prepareResumeImport: Demo<"prepareResumeImport"> = () => { throw new Error("PDF importing is disabled in Demo Mode.") }
export const confirmResumeImport: Demo<"confirmResumeImport"> = () => { throw new Error("PDF importing is disabled in Demo Mode.") }
export const getInterviewAccessSetup: Demo<"getInterviewAccessSetup"> = demoAccessSetup.getInterviewAccessSetup
export const approveInterviewRoomPanel: Demo<"approveInterviewRoomPanel"> = demoAccessSetup.approveInterviewRoomPanel
export const changeInterviewRoomPanel: Demo<"changeInterviewRoomPanel"> = demoAccessSetup.changeInterviewRoomPanel
export const getPublicCorkboard: Demo<"getPublicCorkboard"> = () => ({events: [], total: 0, hasMore: false, clubs: []})
export const getPublicCampusEvent: Demo<"getPublicCampusEvent"> = () => null
export const getSavedCampusEventIds: Demo<"getSavedCampusEventIds"> = () => []
export const setSavedCampusEvent: Demo<"setSavedCampusEvent"> = noDemoEventWrite
export const listClubCampusEvents: Demo<"listClubCampusEvents"> = () => []
export const saveCampusEvent: Demo<"saveCampusEvent"> = noDemoEventWrite
export const commandCampusEvent: Demo<"commandCampusEvent"> = noDemoEventWrite
export const uploadEventFlyer: Demo<"uploadEventFlyer"> = noDemoEventWrite
export const getCampusEventRsvp: Demo<"getCampusEventRsvp"> = () => ({going:false})
export const setCampusEventRsvp: Demo<"setCampusEventRsvp"> = noDemoEventWrite
export const getCampusEventAttendees: Demo<"getCampusEventAttendees"> = () => []
export const getMyCampusEventRsvps: Demo<"getMyCampusEventRsvps"> = () => []
export const respondToOffer: Demo<"respondToOffer"> = demoOffers.respondToOffer
export const revokeRecruitmentOffer: Demo<"revokeRecruitmentOffer"> = demoOffers.revokeRecruitmentOffer
export const getCampusEventRsvpDashboard: Demo<"getCampusEventRsvpDashboard"> = () => ({ eventId: "", count: 0, capacity: null, attendees: [] })
export const getDecisionLetter: Demo<"getDecisionLetter"> = demoDecisionCommunications.getDecisionLetter
export const getDecisionTemplates: Demo<"getDecisionTemplates"> = demoDecisionCommunications.getDecisionTemplates
export const saveDecisionTemplates: Demo<"saveDecisionTemplates"> = demoDecisionCommunications.saveDecisionTemplates
export const setDecisionNotificationsRead: Demo<"setDecisionNotificationsRead"> = demoDecisionCommunications.setDurableNotificationsRead
export const setFormalDecisionLetters: Demo<"setFormalDecisionLetters"> = async()=>{throw Error("Formal-letter settings are unavailable in Demo.")}
export const getRecruitmentCycles: Demo<"getRecruitmentCycles"> = async()=>{throw Error("Recruitment management is unavailable in Demo.")}
export const saveRecruitmentCycle: Demo<"saveRecruitmentCycle"> = async()=>{throw Error("Recruitment management is unavailable in Demo.")}
export const assignApplicationCycle: Demo<"assignApplicationCycle"> = async()=>{throw Error("Recruitment management is unavailable in Demo.")}
export const reconsiderRejectedApplication: Demo<"reconsiderRejectedApplication"> = async()=>{throw Error("Recruitment management is unavailable in Demo.")}
export const scheduleDecisionPublication: Demo<"scheduleDecisionPublication"> = async()=>{throw Error("Decision scheduling is unavailable in Demo.")}
export const getDecisionSchedules: Demo<"getDecisionSchedules"> = async()=>{throw Error("Decision scheduling is unavailable in Demo.")}
export const cancelDecisionSchedule: Demo<"cancelDecisionSchedule"> = async()=>{throw Error("Decision scheduling is unavailable in Demo.")}
export const previewInvitationSchedule: Demo<"previewInvitationSchedule"> = async()=>{throw Error("Invitation scheduling is unavailable in Demo.")}
export const saveInvitationSchedule: Demo<"saveInvitationSchedule"> = async()=>{throw Error("Invitation scheduling is unavailable in Demo.")}
export const getInvitationSchedules: Demo<"getInvitationSchedules"> = async()=>{throw Error("Invitation scheduling is unavailable in Demo.")}
export const cancelInvitationSchedule: Demo<"cancelInvitationSchedule"> = async()=>{throw Error("Invitation scheduling is unavailable in Demo.")}
export const saveAvailabilitySchedule: Demo<"saveAvailabilitySchedule"> = async()=>{throw Error("Availability scheduling is unavailable in Demo.")}
export const getAvailabilitySchedules: Demo<"getAvailabilitySchedules"> = async()=>{throw Error("Availability scheduling is unavailable in Demo.")}
export const cancelAvailabilitySchedule: Demo<"cancelAvailabilitySchedule"> = async()=>{throw Error("Availability scheduling is unavailable in Demo.")}
export const getPipelineSettings: Demo<"getPipelineSettings"> = demoPipeline.getPipelineSettings
export const savePipelineSettings: Demo<"savePipelineSettings"> = demoPipeline.savePipelineSettings
export const getPipelineInterviewStatus: Demo<"getPipelineInterviewStatus"> = demoPipeline.getPipelineInterviewStatus
export const getInterviewFeedback: Demo<"getInterviewFeedback"> = input => demoInterviewFeedback.getInterviewFeedback(input)
export const getRankedReviewSettings: Demo<"getRankedReviewSettings"> = demoRankedReview.getRankedReviewSettings
export const saveRankedReviewBands: Demo<"saveRankedReviewBands"> = demoRankedReview.saveRankedReviewBands
