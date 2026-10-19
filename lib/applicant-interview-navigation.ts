export type ApplicantInterviewFilters = { applicationId?: string; roundId?: string; cycleId?: string };
export type ApplicantInterviewTool = "resumes" | "reviews";

/** Preserve local filters; never accept a caller-controlled return location. */
export function applicantInterviewHref(clubId: string, tool: ApplicantInterviewTool | "applicants", search = "", applicationId?: string) {
  const query = new URLSearchParams(search);
  if (applicationId) query.set("applicantId", applicationId);
  else if (!query.has("applicantId") && query.has("applicationId")) query.set("applicantId", query.get("applicationId")!);
  for (const key of ["interview", "interviewTab", "applicationId", "bookingId", "slotId", "roomId", "sessionId", "setting"]) query.delete(key);
  if (tool !== "reviews") query.delete("reviewId");
  if (tool !== "resumes") query.delete("documentId");
  query.set("section", "recruitment"); query.set("tool", tool);
  return `/club/${encodeURIComponent(clubId)}/workspace?${query}`;
}

export function legacyApplicantInterviewHref(clubId: string, search: string) {
  const query = new URLSearchParams(search), tab = query.get("interviewTab");
  const oldLocation = query.get("section") === "recruitment" && query.get("tool") === "interviews" || query.get("section") === "settings" && query.get("setting") === "interviews";
  return oldLocation && (tab === "resumes" || tab === "reviews")
    ? applicantInterviewHref(clubId, tab, search) : null;
}
