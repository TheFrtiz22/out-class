import type { PanelValidation } from "@/lib/panel-proposals"

export function panelIssueSummary(validation: PanelValidation) {
  // An assigned but invalid interviewer needs conflict resolution, not blindly adding people.
  const missingSlots = [...new Set(validation.sessions.filter(row => row.proposed < row.required).map(row => row.slotId))]
  const conflictSlots = [...new Set(validation.issues.map(issue => issue.slotId))]
  const staffingText = missingSlots.length ? `${missingSlots.length} ${missingSlots.length === 1 ? "slot needs" : "slots need"} interviewers` : !conflictSlots.length ? validation.sessions.length ? "All slots are staffed." : "No interview slots to check." : ""
  const conflictText = conflictSlots.length ? `${conflictSlots.length} ${conflictSlots.length === 1 ? "slot has" : "slots have"} assignment conflicts` : ""
  return { missingSlots, conflictSlots, staffingText, conflictText }
}
