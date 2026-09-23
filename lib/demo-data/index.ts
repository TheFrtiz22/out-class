/**
 * Demo Data — Barrel Export
 *
 * Central entry point for all demo/sample data used when demo mode is enabled.
 * All data is generated deterministically at module evaluation time and
 * conforms to the existing application types so views render identically
 * regardless of data source.
 */

export { demoClubs, demoDiscoverClubs, demoClubPipelines, demoClubQuestions, demoClubRosters, demoClubExecutives, demoClubBranding } from "./clubs"
export { demoApplicants, demoScreeningApplicants, demoInterviewCandidate, demoNextInQueue } from "./students"
export {
  demoMergedApplicants,
  demoTrackedApplications,
  demoEssayPrompts,
  demoDecisionHistory,
  demoStudentMemberships,
  demoExperienceItems,
  getDemoClubApplicants,
  getDemoClubApplicantCount,
  getDemoClubStageCounts,
} from "./applications"
export { demoEvents, demoCoffeeChatRequests, demoManagedEvents, demoScheduleBlocks } from "./events"
export { demoNotifications } from "./notifications"
export { demoInterviewQuestions, demoWorkspaceRounds } from "./interview-questions"
export { demoRubricCriteria } from "./rubrics"

