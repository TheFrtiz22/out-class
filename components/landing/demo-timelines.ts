import type { JourneyScene } from "./journey-content"
import { journeySample } from "./journey-example-state"

export type DemoAction = {
  target: string
  label: string
  state: number
  move?: number
  hold?: number
  typing?: { text: string; initial?: string; duration: number }
}
export type DemoBeat = DemoAction & { start: number; arrive: number; press: number; clickEnd: number; respond: number; end: number }
export type DemoTimeline = { title: string; summary: string; beats: DemoBeat[]; duration: number; finalState: number; views: readonly number[] }

/** Every response and cursor phase uses this same absolute timeline. */
export function defineDemo(title: string, summary: string, actions: DemoAction[], views: readonly number[]): DemoTimeline {
  let time = 1200
  const beats = actions.map((action, index) => {
    const start = time, arrive = start + (action.move ?? 760), press = arrive + 420, clickEnd = press + 160, respond = clickEnd + (action.typing?.duration ?? 0)
    const end = respond + 480 + (action.hold ?? (index === actions.length - 1 ? 2600 : 1800))
    time = end
    return { ...action, start, arrive, press, clickEnd, respond, end }
  })
  return { title, summary, beats, duration: time, finalState: actions.at(-1)?.state ?? 0, views }
}

const action = (target: string, label: string, state: number, hold?: number): DemoAction => ({ target, label, state, hold })
const type = (target: string, label: string, state: number, text: string, duration: number, initial = ""): DemoAction => ({ target, label, state, typing: { text, duration, initial } })

export const demoTimelines: Record<Exclude<JourneyScene, "profile" | "schedule">, DemoTimeline> = {
  discover: defineDemo("Discover", "Jordan searches for investing, selects Jefferson Investment Society and opens its club profile before applying.", [type("search", "Finding an interest", 1, "investment", 900), action("club-row", "Selecting a club", 2), action("view-club", "Opening the club profile", 3)], [0, 0, 0, 1]),
  apply: defineDemo("Apply", "Jordan’s shared profile and resume are attached. A club-specific response is saved as a draft, reviewed and submitted.", [type("answer", "Answering the club’s question", 1, journeySample.answer, 3600), action("save-draft", "Saving the application draft", 2), action("review-application", "Reviewing profile and response", 3), action("submit-application", "Submitting the application", 4)], [0, 0, 0, 1, 2]),
  "student-interview": defineDemo("Interview", "Jordan opens an invitation, selects Thursday at 6:30 PM in Room 204 and confirms the interview booking.", [action("open-invitation", "Opening the interview invitation", 1), action("time-choice", "Selecting an available time", 2), action("confirm-booking", "Confirming the interview", 3)], [0, 1, 1, 2]),
  status: defineDemo("Track", "Jordan selects the JIS application in Status, reviews the current recruitment round and opens the confirmed interview details.", [action("status-application", "Reviewing application progress", 1, 2400), action("interview-details", "Checking the confirmed interview", 2)], [0, 1, 2]),
  join: defineDemo("Belong", "After a club acceptance, Jordan accepts the offer, finds JIS in My Clubs and opens the member workspace. Membership begins after offer acceptance.", [action("accept-offer", "Accepting the membership offer", 1), action("my-clubs", "Finding the joined organization", 2), action("member-workspace", "Opening the member workspace", 3)], [0, 1, 2, 3]),
  build: defineDemo("Set Up", "An approved club owner edits the club’s description and saves the profile. A pending claim does not grant workspace access.", [action("edit-profile", "Opening the approved club profile", 1), type("club-description", "Preparing the club description", 2, journeySample.description, 2200, "An investment community built around research, discussion, and learning by doing. "), action("save-profile", "Saving the club profile", 3)], [0, 1, 1, 0]),
  recruit: defineDemo("Recruit", "The owner prepares and saves a required short-response question, opens the applicant pipeline and selects Jordan for review.", [type("application-question", "Preparing a club-specific question", 1, journeySample.question, 1400), action("save-application", "Saving recruitment settings", 2), action("applicants-tab", "Opening incoming applications", 3), action("recruit-applicant", "Selecting Jordan’s application", 4)], [0, 0, 0, 1, 1]),
  review: defineDemo("Review", "A reviewer selects Jordan, reads the shared profile and club-specific response, opens the evaluation, selects a rubric score and saves it.", [action("review-applicant", "Opening Jordan’s application", 1), action("evaluation-tab", "Opening the shared rubric", 2), action("rubric-score", "Choosing a rubric score", 3), action("score-four", "Recording motivation and fit", 4), action("save-evaluation", "Saving the evaluation", 5)], [0, 1, 2, 2, 2, 2]),
  "leader-interview": defineDemo("Interview Scheduling", "The owner reviews confirmed availability and rooms, creates an Auto-Fill draft, replaces an interviewer in one proposed session, reviews the exact plan and confirms publication. Auto-Fill does not publish assignments.", [action("review-rooms", "Reviewing interviewer availability", 1), action("auto-fill", "Creating an unpublished proposal", 2), action("edit-session", "Reviewing a proposed session", 3), action("replace-interviewer", "Adjusting the proposed panel", 4), action("replacement-naomi", "Selecting an available replacement", 5), action("review-publish", "Reviewing the exact schedule", 6, 2400), action("confirm-publish", "Owner approving and publishing", 7)], [0, 1, 2, 2, 2, 2, 3, 4]),
  decide: defineDemo("Decide", "A leader reviews recorded evaluations, selects acceptance and records the decision. Jordan receives an offer; membership awaits the student’s response.", [action("evaluation-detail", "Reviewing recorded evaluations", 1), action("accept-decision", "Selecting the recruitment outcome", 2), action("record-decision", "Recording the acceptance", 3)], [0, 0, 0, 1]),
  manage: defineDemo("Manage", "Jordan is on the member roster after accepting the offer. The owner prepares an announcement, confirms publication, opens member tasks and reviews Jordan’s submitted welcome brief.", [action("announcements-tab", "Preparing the member welcome", 1), action("publish-announcement", "Reviewing the announcement", 2), action("confirm-announcement", "Confirming publication to members", 3), action("tasks-tab", "Opening tasks and submissions", 4), action("open-submission", "Reviewing Jordan’s submission", 5)], [0, 1, 2, 3, 4, 5]),
}
