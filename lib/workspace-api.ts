"use client"
import * as pipelineActions from "@/actions/club-settings";
import * as pipelineInterviewActions from "@/actions/pipeline-interviews";
import * as interviewEntry from "@/actions/interview-entry";
import * as availabilitySchedules from "@/actions/availability-schedules";
import * as panelApi from "@/actions/panel-proposals";
import * as publicationApi from "@/actions/panel-publication";
import * as availabilityOverrideApi from "@/actions/interview-availability-overrides";
import * as bookingPublicationApi from "@/actions/interview-booking-publication";
import * as invitationSchedules from "@/actions/invitation-schedules";
import * as decisionSchedules from "@/actions/decision-schedules";
import * as recruitmentManagement from "@/actions/recruitment-management";
import * as decisionCommunications from "@/actions/communications";
import * as offers from "@/actions/recruitment-offers";
import { readWorkspace } from "@/lib/workspace-read"
import * as campusEvents from "@/actions/campus-events"
import * as eventFlyers from "@/actions/event-flyers"
import * as resumeImport from "@/actions/resume-import"
import * as tutorials from "@/actions/tutorials"
import * as votingApi from "@/actions/voting"
import * as applicantIntelligence from "@/actions/applicant-intelligence"
import * as accessSetup from "@/actions/interview-access-setup"
import * as roomApi from "@/actions/interview-rooms"
import * as recruitingRules from "@/actions/recruiting-rules"
import * as clubOverview from "@/actions/club-overview"
import * as tasksApi from "@/actions/tasks"
import * as interviewResumes from "@/actions/interview-resumes"
import * as interviewGrants from "@/actions/organization-members"
import * as interviewKits from "@/actions/interview-kits"
import * as collaboration from "@/actions/interview-collaboration"
import * as meetingsApi from "@/actions/meetings"
import * as apps from "@/actions/applications"
import * as crm from "@/actions/crm"
import * as evaluation from "@/actions/evaluations"
import * as profile from "@/actions/profile"
import * as directory from "@/actions/club-directory"
import * as storage from "@/actions/storage"
import * as search from "@/actions/workspace-search"
import * as rankedReview from "@/actions/ranked-review"
import * as interviewFeedbackApi from "@/actions/interview-feedback"
import * as votingTargetSummary from "@/actions/voting-target-summary"
import { demoGate, loadDemoWorkspace, type DemoWorkspaceModule } from "@/lib/demo/loader"
export type { WorkspaceSearchResult } from "@/actions/workspace-search"
// The sole client data boundary: demo operations never invoke a server action,
// and demo implementations load only while Demo Mode is active.
type DemoKey = keyof DemoWorkspaceModule
function adapt<F extends (...args: never[]) => Promise<unknown>>(real: F, key: DemoKey): F {
  return (async (...args: Parameters<F>) => {
    if (!(await demoGate())) return real(...args)
    const demo = (await loadDemoWorkspace())[key] as unknown as (...args: Parameters<F>) => unknown
    return demo(...args)
  }) as F
}
export const getPanelProposalWorkspace = adapt((scope: Parameters<typeof panelApi.getPanelProposalWorkspace>[0]) => readWorkspace<Awaited<ReturnType<typeof panelApi.getPanelProposalWorkspace>>>("panelWorkspace", [scope]), "getPanelProposalWorkspace")
export const generatePanelProposal = adapt(panelApi.generatePanelProposal, "generatePanelProposal")
export const previewPanelProposalEdits = adapt(panelApi.previewPanelProposalEdits, "previewPanelProposalEdits")
export const savePanelProposalDraft = adapt(panelApi.savePanelProposalDraft, "savePanelProposalDraft")
export const discardPanelProposal = adapt(panelApi.discardPanelProposal, "discardPanelProposal")
export const beginPanelScheduleRevision = adapt(publicationApi.beginPanelScheduleRevision, "beginPanelScheduleRevision")
export const revalidatePanelDraft = adapt(publicationApi.revalidatePanelDraft, "revalidatePanelDraft")
export const reviewPanelPublication = adapt(publicationApi.reviewPanelPublication, "reviewPanelPublication")
export const publishPanelSchedule = adapt(publicationApi.publishPanelSchedule, "publishPanelSchedule")
export const assignPanelAvailabilityOverride = adapt(availabilityOverrideApi.assignPanelAvailabilityOverride, "assignPanelAvailabilityOverride")
export const revokePanelAvailabilityOverride = adapt(availabilityOverrideApi.revokePanelAvailabilityOverride, "revokePanelAvailabilityOverride")
export const getInterviewBookingPublication = adapt((...args: Parameters<typeof bookingPublicationApi.getInterviewBookingPublication>) => readWorkspace<Awaited<ReturnType<typeof bookingPublicationApi.getInterviewBookingPublication>>>("bookingPublication", args), "getInterviewBookingPublication")
export const setInterviewBookingPublication = adapt(bookingPublicationApi.setInterviewBookingPublication, "setInterviewBookingPublication")

export const getStudentApplications = adapt(apps.getStudentApplications, "getStudentApplications")
export const getStudentDashboardData = adapt(() => readWorkspace<Awaited<ReturnType<typeof apps.getStudentDashboardData>>>("studentDashboard"), "getStudentDashboardData")
export const getClubDirectory = adapt((...args: Parameters<typeof directory.getClubDirectory>) => readWorkspace<Awaited<ReturnType<typeof directory.getClubDirectory>>>("directory", args), "getClubDirectory")
export const getPublicClub = adapt((...args: Parameters<typeof directory.getPublicClub>) => readWorkspace<Awaited<ReturnType<typeof directory.getPublicClub>>>("publicClub", args), "getPublicClub")
export const getClubPipeline = adapt((...args: Parameters<typeof crm.getClubPipeline>) => readWorkspace<Awaited<ReturnType<typeof crm.getClubPipeline>>>("pipeline", args), "getClubPipeline")
export const getRankedReviewRound = adapt((...args: Parameters<typeof crm.getRankedReviewRound>) => readWorkspace<Awaited<ReturnType<typeof crm.getRankedReviewRound>>>("rankedReviewRound", args), "getRankedReviewRound")
export const getClubPipelineList = adapt((...args: Parameters<typeof crm.getClubPipelineList>) => readWorkspace<Awaited<ReturnType<typeof crm.getClubPipelineList>>>("pipelineList", args), "getClubPipelineList")
export const getClubPipelinePage = adapt((...args: Parameters<typeof crm.getClubPipelinePage>) => readWorkspace<Awaited<ReturnType<typeof crm.getClubPipelinePage>>>("pipelinePage", args), "getClubPipelinePage")
export const getClubPipelineSelection = adapt((...args: Parameters<typeof crm.getClubPipelineSelection>) => readWorkspace<Awaited<ReturnType<typeof crm.getClubPipelineSelection>>>("pipelineSelection", args), "getClubPipelineSelection")
export const moveApplicantRound = adapt(crm.moveApplicantRound, "moveApplicantRound")
export const setApplicationStatus = adapt(crm.setApplicationStatus, "setApplicationStatus")
export const submitEvaluation = adapt(evaluation.submitEvaluation, "submitEvaluation")
export const startClubApplication = adapt(directory.startClubApplication, "startClubApplication")

export const saveApplicationDraft = adapt(apps.saveApplicationDraft, "saveApplicationDraft")
export const submitApplication = adapt(apps.submitApplication, "submitApplication")
export const getStudentProfile = adapt(profile.getStudentProfile, "getStudentProfile")
export const updateStudentProfileSection = adapt(profile.updateStudentProfileSection, "updateStudentProfileSection")
export const uploadProfileFile = adapt(storage.uploadProfileFile, "uploadProfileFile")
export const searchWorkspace = adapt(search.searchWorkspace, "searchWorkspace")

export const setRoundAnonymousReview = adapt(crm.setRoundAnonymousReview, "setRoundAnonymousReview")
export const setClubTestRequirement = adapt(crm.setClubTestRequirement, "setClubTestRequirement")
export const revealApplicantIdentity = adapt(crm.revealApplicantIdentity, "revealApplicantIdentity")

export const saveAnonymousReviewContent = adapt(crm.saveAnonymousReviewContent, "saveAnonymousReviewContent")

export const getInterviewKit = adapt(interviewKits.getInterviewKit, "getInterviewKit")
export const getInterviewWorkspace = adapt((...args: Parameters<typeof interviewKits.getInterviewWorkspace>) => readWorkspace<Awaited<ReturnType<typeof interviewKits.getInterviewWorkspace>>>("interviewWorkspace", args), "getInterviewWorkspace")
export const getAssignedInterviewRooms = adapt((...args: Parameters<typeof interviewEntry.getAssignedInterviewRooms>) => readWorkspace<Awaited<ReturnType<typeof interviewEntry.getAssignedInterviewRooms>>>("assignedRooms", args), "getAssignedInterviewRooms")
export const resolveInterviewRoomEntry = adapt(interviewEntry.resolveInterviewRoomEntry, "resolveInterviewRoomEntry")
export const getEarlierInterviewReviews = adapt(interviewKits.getEarlierInterviewReviews, "getEarlierInterviewReviews")
export const getInterviewRoundScore = adapt(interviewKits.getInterviewRoundScore, "getInterviewRoundScore")
export const getInterviewCollaboration = adapt(collaboration.getInterviewCollaboration, "getInterviewCollaboration")
export const selectSharedInterviewQuestion = adapt(collaboration.selectSharedInterviewQuestion, "selectSharedInterviewQuestion")
export const leaveInterviewCollaboration = adapt(collaboration.leaveInterviewCollaboration, "leaveInterviewCollaboration")
export const dismissInterviewInvitation = adapt(collaboration.dismissInterviewInvitation, "dismissInterviewInvitation")
export const prepareInterviewAdvance = adapt(collaboration.prepareInterviewAdvance, "prepareInterviewAdvance")
export const confirmInterviewAdvance = adapt(collaboration.confirmInterviewAdvance, "confirmInterviewAdvance")
export const saveInterviewKit = adapt(interviewKits.saveInterviewKit, "saveInterviewKit")
export const openInterviewSession = adapt(interviewKits.openInterviewSession, "openInterviewSession")
export const saveInterviewSession = adapt(interviewKits.saveInterviewSession, "saveInterviewSession")
export const getSubmittedInterviewReview = adapt(interviewKits.getSubmittedInterviewReview, "getSubmittedInterviewReview")
export const getSubmittedInterviewReviews = adapt(interviewKits.getSubmittedInterviewReviews, "getSubmittedInterviewReviews")
export const getPreviousInterviewScores = adapt(interviewKits.getPreviousInterviewScores, "getPreviousInterviewScores")
export const getInterviewApplicantPanel = adapt(interviewResumes.getInterviewApplicantPanel, "getInterviewApplicantPanel")
export const getInterviewResumeModerationQueue = adapt(interviewResumes.getInterviewResumeModerationQueue, "getInterviewResumeModerationQueue")
export const pinInterviewResume = adapt(interviewResumes.pinInterviewResume, "pinInterviewResume")
export const getInterviewResumeAnnotations = adapt(interviewResumes.getInterviewResumeAnnotations, "getInterviewResumeAnnotations")
export const saveInterviewResumeAnnotation = adapt(interviewResumes.saveInterviewResumeAnnotation, "saveInterviewResumeAnnotation")
export const deleteInterviewResumeAnnotation = adapt(interviewResumes.deleteInterviewResumeAnnotation, "deleteInterviewResumeAnnotation")
export const getInterviewAnnotationHistory = adapt(interviewResumes.getInterviewAnnotationHistory, "getInterviewAnnotationHistory")
export const setMemberInterviewOffices = adapt(interviewGrants.setMemberInterviewOffices, "setMemberInterviewOffices")
export const setInterviewPanelAssignment = adapt(interviewGrants.setInterviewPanelAssignment, "setInterviewPanelAssignment")
export const getInterviewRounds = adapt((...args: Parameters<typeof interviewKits.getInterviewRounds>) => readWorkspace<Awaited<ReturnType<typeof interviewKits.getInterviewRounds>>>("interviewRounds", args), "getInterviewRounds")



export const listMeetings = adapt((...args: Parameters<typeof meetingsApi.listMeetings>) => readWorkspace<Awaited<ReturnType<typeof meetingsApi.listMeetings>>>("meetings", args), "listMeetings")
export const getMeeting = adapt(meetingsApi.getMeeting, "getMeeting")
export const saveMeeting = adapt(meetingsApi.saveMeeting, "saveMeeting")
export const issueMeetingCheckIn = adapt(meetingsApi.issueMeetingCheckIn, "issueMeetingCheckIn")
export const closeMeetingCheckIn = adapt(meetingsApi.closeMeetingCheckIn, "closeMeetingCheckIn")
export const checkInMeeting = adapt(meetingsApi.checkInMeeting, "checkInMeeting")
export const meetingAttendance = adapt(meetingsApi.meetingAttendance, "meetingAttendance")
export const recruitmentAttendanceSummary = adapt((...args: Parameters<typeof meetingsApi.recruitmentAttendanceSummary>) => readWorkspace<Awaited<ReturnType<typeof meetingsApi.recruitmentAttendanceSummary>>>("attendance", args), "recruitmentAttendanceSummary")

// Semester work follows the same isolated demo boundary as recruitment.
export const getTaskNotifications = adapt((...args: Parameters<typeof tasksApi.getTaskNotifications>) => readWorkspace<Awaited<ReturnType<typeof tasksApi.getTaskNotifications>>>("taskNotifications", args), "getTaskNotifications")
export const getTaskWorkspace = adapt((...args: Parameters<typeof tasksApi.getTaskWorkspace>) => readWorkspace<Awaited<ReturnType<typeof tasksApi.getTaskWorkspace>>>("tasks", args), "getTaskWorkspace")
export const saveTask = adapt(tasksApi.saveTask, "saveTask")
export const previewTaskAudience = adapt(tasksApi.previewTaskAudience, "previewTaskAudience")
export const bulkUpdateTasks = adapt(tasksApi.bulkUpdateTasks, "bulkUpdateTasks")
export const addTaskRecipients = adapt(tasksApi.addTaskRecipients, "addTaskRecipients")
export const bulkApproveTaskSubmissions = adapt(tasksApi.bulkApproveTaskSubmissions, "bulkApproveTaskSubmissions")
export const updateTaskMember = adapt(tasksApi.updateTaskMember, "updateTaskMember")
export const viewTask = adapt(tasksApi.viewTask, "viewTask")
export const submitTask = adapt(tasksApi.submitTask, "submitTask")
export const reviewTask = adapt(tasksApi.reviewTask, "reviewTask")
export const uploadTaskFile = adapt(tasksApi.uploadTaskFile, "uploadTaskFile")
export const downloadTaskFile = adapt(tasksApi.downloadTaskFile, "downloadTaskFile")

export const getClubWorkspaceOverview = adapt((...args: Parameters<typeof clubOverview.getClubWorkspaceOverview>) => readWorkspace<Awaited<ReturnType<typeof clubOverview.getClubWorkspaceOverview>>>("overview", args), "getClubWorkspaceOverview")
export const getDashboardReviewQueue = adapt((...args: Parameters<typeof clubOverview.getDashboardReviewQueue>) => readWorkspace<Awaited<ReturnType<typeof clubOverview.getDashboardReviewQueue>>>("dashboardReviews", args), "getDashboardReviewQueue")
export const getWorkspaceRounds = adapt((...args: Parameters<typeof clubOverview.getWorkspaceRounds>) => readWorkspace<Awaited<ReturnType<typeof clubOverview.getWorkspaceRounds>>>("rounds", args), "getWorkspaceRounds")

export const getRecruitingRules = adapt(recruitingRules.getRecruitingRules, "getRecruitingRules")
export const saveRecruitingRule = adapt(recruitingRules.saveRecruitingRule, "saveRecruitingRule")
export const previewRecruitingRule = adapt(recruitingRules.previewRecruitingRule, "previewRecruitingRule")
export const applyRecruitingRuleFlags = adapt(recruitingRules.applyRecruitingRuleFlags, "applyRecruitingRuleFlags")
export const getRecruitingRuleFlags = adapt(recruitingRules.getRecruitingRuleFlags, "getRecruitingRuleFlags")
export const clearRecruitingRuleFlags = adapt(recruitingRules.clearRecruitingRuleFlags, "clearRecruitingRuleFlags")

export const getRoomWorkspace = adapt((...args: Parameters<typeof roomApi.getRoomWorkspace>) => readWorkspace<Awaited<ReturnType<typeof roomApi.getRoomWorkspace>>>("roomWorkspace", args), "getRoomWorkspace")
export const createInterviewRoom = adapt(roomApi.createInterviewRoom, "createInterviewRoom")
export const setInterviewStaffingRequirement = adapt(roomApi.setInterviewStaffingRequirement, "setInterviewStaffingRequirement")
export const setInterviewRoomOpen = adapt(roomApi.setInterviewRoomOpen, "setInterviewRoomOpen")
export const renameInterviewRoom = adapt(roomApi.renameInterviewRoom, "renameInterviewRoom")
export const setInterviewRoomExternallyBooked = adapt(roomApi.setInterviewRoomExternallyBooked, "setInterviewRoomExternallyBooked")
export const getApplicantSchedule = adapt(roomApi.getApplicantSchedule, "getApplicantSchedule")
export const reserveInterview = adapt(roomApi.reserveInterview, "reserveInterview")
export const cancelRoomBooking = adapt(roomApi.cancelRoomBooking, "cancelRoomBooking")
export const getBookingApplication = adapt(roomApi.getBookingApplication, "getBookingApplication")


export const getApplicantDisplay = adapt((...args: Parameters<typeof applicantIntelligence.getApplicantDisplay>) => readWorkspace<Awaited<ReturnType<typeof applicantIntelligence.getApplicantDisplay>>>("applicantDisplay", args), "getApplicantDisplay");
export const getApplicantDisplayConfiguration = adapt(applicantIntelligence.getApplicantDisplayConfiguration, "getApplicantDisplayConfiguration");
export const saveApplicantDisplayConfiguration = adapt(applicantIntelligence.saveApplicantDisplayConfiguration, "saveApplicantDisplayConfiguration");
export const saveApplicantObservation = adapt(applicantIntelligence.saveApplicantObservation, "saveApplicantObservation");
export const deleteApplicantObservation = adapt(applicantIntelligence.deleteApplicantObservation, "deleteApplicantObservation");

// Persisted voting follows the same Demo Mode boundary as recruitment and applicant display.
export const getVotingWorkspace = adapt((...args: Parameters<typeof votingApi.getVotingWorkspace>) => readWorkspace<Awaited<ReturnType<typeof votingApi.getVotingWorkspace>>>("voting", args), "getVotingWorkspace")
export const createVotingSession = adapt(votingApi.createVotingSession, "createVotingSession")
export const submitVotingBallot = adapt(votingApi.submitVotingBallot, "submitVotingBallot")
export const commandVotingSession = adapt(votingApi.commandVotingSession, "commandVotingSession")
export async function seedVotingDemo(clubId: string) {
  if (!(await demoGate())) throw Error("Sample voting is available only in Demo Mode.")
  return (await loadDemoWorkspace()).demoVoting.seedVotingDemo(clubId)
}

// One saved-item boundary. Demo saves reference the same deterministic demo directory.
export const getCorkboard = adapt((...args: Parameters<typeof directory.getCorkboard>) => readWorkspace<Awaited<ReturnType<typeof directory.getCorkboard>>>("corkboard", args), "getCorkboard")
export const setCorkboardClub = adapt(directory.setCorkboardClub, "setCorkboardClub")


export const getTutorial = adapt((...args: Parameters<typeof tutorials.getTutorial>) => readWorkspace<Awaited<ReturnType<typeof tutorials.getTutorial>>>("tutorial", args), "getTutorial")
export const saveTutorial = adapt(tutorials.saveTutorial, "saveTutorial")

export const getVotingJoinInfo = adapt((...args: Parameters<typeof votingApi.getVotingJoinInfo>) => readWorkspace<Awaited<ReturnType<typeof votingApi.getVotingJoinInfo>>>("votingJoin", args), "getVotingJoinInfo")
export async function joinVotingSession(sessionId:string,demoMemberId?:string){
  if(await demoGate())return (await loadDemoWorkspace()).demoVoting.joinVotingSession(sessionId,demoMemberId)
  if(demoMemberId)throw Error("Demo identities are not valid in production.")
  return votingApi.joinVotingSession(sessionId)
}
export async function getJoinedVotingWorkspace(sessionId:string,demoMemberId?:string){
  if(await demoGate())return (await loadDemoWorkspace()).demoVoting.getJoinedVotingWorkspace(sessionId,demoMemberId)
  if(demoMemberId)throw Error("Demo identities are not valid in production.")
  const info=await getVotingJoinInfo(sessionId)
  if(!("clubId" in info)||!info.clubId)throw Error(`Session ${info.status.toLowerCase().replaceAll("_"," ")}.`)
  return getVotingWorkspace(info.clubId,sessionId)
}

export const prepareResumeImport = adapt(resumeImport.prepareResumeImport, "prepareResumeImport")
export const confirmResumeImport = adapt(resumeImport.confirmResumeImport, "confirmResumeImport")

export const getInterviewAccessSetup = adapt(accessSetup.getInterviewAccessSetup, "getInterviewAccessSetup")
export const approveInterviewRoomPanel = adapt(accessSetup.approveInterviewRoomPanel, "approveInterviewRoomPanel")
export const changeInterviewRoomPanel = adapt(accessSetup.changeInterviewRoomPanel, "changeInterviewRoomPanel")
// Campus publication is never simulated as a live write in Demo Mode.
export const getPublicCorkboard = adapt(campusEvents.getPublicCorkboard, "getPublicCorkboard")
export const getPublicCampusEvent = adapt(campusEvents.getPublicCampusEvent, "getPublicCampusEvent")
export const getSavedCampusEventIds = adapt(campusEvents.getSavedCampusEventIds, "getSavedCampusEventIds")
export const setSavedCampusEvent = adapt(campusEvents.setSavedCampusEvent, "setSavedCampusEvent")
export const listClubCampusEvents = adapt(campusEvents.listClubCampusEvents, "listClubCampusEvents")
export const saveCampusEvent = adapt(campusEvents.saveCampusEvent, "saveCampusEvent")
export const commandCampusEvent = adapt(campusEvents.commandCampusEvent, "commandCampusEvent")
export const uploadEventFlyer = adapt(eventFlyers.uploadEventFlyer, "uploadEventFlyer")
export const getCampusEventRsvp = adapt(campusEvents.getCampusEventRsvp, "getCampusEventRsvp")
export const setCampusEventRsvp = adapt(campusEvents.setCampusEventRsvp, "setCampusEventRsvp")
export const getCampusEventAttendees = adapt(campusEvents.getCampusEventAttendees, "getCampusEventAttendees")
export const getMyCampusEventRsvps = adapt(campusEvents.getMyCampusEventRsvps, "getMyCampusEventRsvps")

export const respondToOffer = adapt(offers.respondToOffer, "respondToOffer")
export const revokeRecruitmentOffer = adapt(offers.revokeRecruitmentOffer, "revokeRecruitmentOffer")

export const getCampusEventRsvpDashboard = adapt(campusEvents.getCampusEventRsvpDashboard, "getCampusEventRsvpDashboard")

export const getDecisionLetter = adapt(decisionCommunications.getDecisionLetter, "getDecisionLetter");
export const getDecisionTemplates = adapt(decisionCommunications.getDecisionTemplates, "getDecisionTemplates");
export const saveDecisionTemplates = adapt(decisionCommunications.saveDecisionTemplates, "saveDecisionTemplates");
export const setDecisionNotificationsRead = adapt(decisionCommunications.setDurableNotificationsRead, "setDecisionNotificationsRead");

export const setFormalDecisionLetters = adapt(decisionCommunications.setFormalDecisionLetters, "setFormalDecisionLetters");

// These management operations are deliberately unavailable in Demo; no server calls.
export const getRecruitmentCycles = adapt(recruitmentManagement.getRecruitmentCycles, "getRecruitmentCycles");
export const saveRecruitmentCycle = adapt(recruitmentManagement.saveRecruitmentCycle, "saveRecruitmentCycle");
export const assignApplicationCycle = adapt(recruitmentManagement.assignApplicationCycle, "assignApplicationCycle");
export const startRecruitmentCycleFromPrevious = adapt(recruitmentManagement.startRecruitmentCycleFromPrevious, "startRecruitmentCycleFromPrevious");
export const reconsiderRejectedApplication = adapt(recruitmentManagement.reconsiderRejectedApplication, "reconsiderRejectedApplication");

export const scheduleDecisionPublication = adapt(decisionSchedules.scheduleDecisionPublication, "scheduleDecisionPublication");

export const getDecisionSchedules = adapt(decisionSchedules.getDecisionSchedules, "getDecisionSchedules");

export const cancelDecisionSchedule = adapt(decisionSchedules.cancelDecisionSchedule, "cancelDecisionSchedule");

export const previewInvitationSchedule = adapt(invitationSchedules.previewInvitationSchedule, "previewInvitationSchedule");
export const saveInvitationSchedule = adapt(invitationSchedules.saveInvitationSchedule, "saveInvitationSchedule");
export const getInvitationSchedules = adapt(invitationSchedules.getInvitationSchedules, "getInvitationSchedules");
export const cancelInvitationSchedule = adapt(invitationSchedules.cancelInvitationSchedule, "cancelInvitationSchedule");

export const saveAvailabilitySchedule = adapt(availabilitySchedules.saveAvailabilitySchedule, "saveAvailabilitySchedule");
export const getAvailabilitySchedules = adapt(availabilitySchedules.getAvailabilitySchedules, "getAvailabilitySchedules");
export const cancelAvailabilitySchedule = adapt(availabilitySchedules.cancelAvailabilitySchedule, "cancelAvailabilitySchedule");

export const getPipelineSettings = adapt(pipelineActions.getPipelineSettings, "getPipelineSettings");
export const savePipelineSettings = adapt(pipelineActions.savePipelineSettings, "savePipelineSettings");
export const getProfileFieldVisibility = adapt(pipelineActions.getProfileFieldVisibility, "getProfileFieldVisibility");
export const saveProfileFieldVisibility = adapt(pipelineActions.saveProfileFieldVisibility, "saveProfileFieldVisibility");
export const getPipelineInterviewStatus = adapt(pipelineInterviewActions.getPipelineInterviewStatus, "getPipelineInterviewStatus");
export const getInterviewFeedback = adapt(interviewFeedbackApi.getInterviewFeedback, "getInterviewFeedback")
export const getRankedReviewSettings = adapt((...args: Parameters<typeof rankedReview.getRankedReviewSettings>) => readWorkspace<Awaited<ReturnType<typeof rankedReview.getRankedReviewSettings>>>("rankedReviewSettings", args), "getRankedReviewSettings")
export const saveRankedReviewBands = adapt(rankedReview.saveRankedReviewBands, "saveRankedReviewBands")
/** Entire-round target and decision counts (counts only). Demo implementation loads only in Demo Mode. */
export const getRoundTargetSummary = adapt(votingTargetSummary.getRoundTargetSummary, "getRoundTargetSummary")
