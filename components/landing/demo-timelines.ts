import type { JourneyScene } from "./journey-content"

export type DemoBeat = { target: string; label: string; state: number; start: number; arrive: number; press: number; clickEnd: number; respond: number; end: number }
export type DemoTimeline = { title: string; summary: string; result: string; beats: [DemoBeat]; duration: number; finalState: number }

// Time to read, one deliberate gesture, then a result that stays on screen.
export const demoPacing = { intro: 2300, move: 900, hover: 600, click: 140, response: 260, finalHold: 2400 } as const

function defineDemo(title: string, summary: string, target: string, label: string, result: string): DemoTimeline {
  const start = demoPacing.intro
  const arrive = start + demoPacing.move
  const press = arrive + demoPacing.hover
  const clickEnd = press + demoPacing.click
  const respond = clickEnd
  const end = respond + demoPacing.response + demoPacing.finalHold
  return { title, summary, result, beats: [{ target, label, state: 1, start, arrive, press, clickEnd, respond, end }], duration: end, finalState: 1 }
}

/** Every vignette begins at a prepared product state. No compressed workflows. */
export const demoTimelines: Record<Exclude<JourneyScene, "profile" | "schedule">, DemoTimeline> = {
  discover: defineDemo("Discover", "In the club directory, Jordan opens Jefferson Investment Society. Its profile reveals the club’s focus and open recruitment.", "view-club", "Opening the club profile", "Club profile opened"),
  apply: defineDemo("Apply", "Jordan has reviewed the attached shared profile and completed club response. Submitting sends this application to JIS for review.", "submit-application", "Submitting the reviewed application", "Application submitted"),
  "student-interview": defineDemo("Interview", "With Thursday at 6:30 PM already selected, Jordan confirms the interview. The booking shows the time, room and duration together.", "confirm-booking", "Confirming the selected time", "Interview confirmed"),
  status: defineDemo("Track", "Jordan opens the JIS application in Status. The current interview stage and confirmed next step appear together in the application details.", "status-application", "Checking application status", "Current stage: Interview"),
  join: defineDemo("Belong", "Jordan accepts the JIS membership offer. The accepted offer creates an active membership with access to the club workspace.", "accept-offer", "Accepting the membership offer", "Membership active"),
  build: defineDemo("Set Up", "In an approved club workspace, the owner has prepared a club description. Saving updates the public club profile with the revised description.", "save-profile", "Saving the prepared club profile", "Club profile saved"),
  recruit: defineDemo("Recruit", "The owner has prepared a required club-specific application question. Saving makes the question part of this club’s application settings.", "save-application", "Saving the application question", "Application question saved"),
  review: defineDemo("Review", "A reviewer has read Jordan’s application and prepared rubric scores and a note. Saving records the evaluation for the recruitment team.", "save-evaluation", "Saving Jordan’s evaluation", "Evaluation saved"),
  "leader-interview": defineDemo("Interview Scheduling", "Using confirmed availability and a prepared room, Auto-Fill creates a staffed panel proposal. This remains an unpublished draft for owner review.", "auto-fill", "Creating a panel proposal", "Panel proposal ready · Unpublished"),
  decide: defineDemo("Decide", "After reviewing team feedback, a leader has selected acceptance. Recording the decision creates an offer awaiting Jordan’s response, not membership.", "record-decision", "Recording the selected acceptance", "Acceptance recorded · Offer pending"),
  manage: defineDemo("Manage", "The task and exact recipients have already been reviewed. The owner assigns the welcome brief to three members, including Jordan.", "assign-task", "Assigning the reviewed task", "Welcome brief assigned to 3 members"),
}
