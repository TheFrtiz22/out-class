"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { interviewCapabilities } from "@/lib/interview-access";
import { applicantInterviewHref, type ApplicantInterviewTool } from "@/lib/applicant-interview-navigation";
import { InterviewResumeModeration } from "@/components/interview-resume-moderation";
import { InterviewSubmittedReviews } from "@/components/interview-submitted-reviews";
import { canLeaveWorkspace } from "@/lib/product-navigation";

export function ApplicantInterviewReviews({ clubId, tool }: { clubId: string; tool: ApplicantInterviewTool }) {
  const params = useSearchParams(), { user } = useAuth();
  const caps = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId));
  const allowed = tool === "resumes" ? caps.moderateResume : caps.readClosing;
  const filters = { applicationId: params.get("applicantId") || params.get("applicationId") || undefined, roundId: params.get("roundId") || undefined, cycleId: params.get("cycleId") || params.get("recruitmentCycleId") || undefined };
  return <div className="space-y-3 pb-20 md:pb-6">
    <nav aria-label="Applicants" className="flex flex-wrap items-center gap-2 text-sm">
      <Link className="inline-flex min-h-10 items-center underline" href={applicantInterviewHref(clubId, "applicants", params.toString())} onClick={e => { if (!canLeaveWorkspace()) e.preventDefault(); }}>Applicants</Link><span aria-hidden="true">/</span><span aria-current="page">{tool === "resumes" ? "Résumé moderation" : "Submitted reviews"}</span>
    </nav>
    {!allowed ? <p role="alert">This section isn’t available with your current interview access.</p> : tool === "resumes" ? <InterviewResumeModeration key={`${clubId}:${params}`} clubId={clubId} filters={filters} initialDocumentId={params.get("documentId") || undefined} /> : <InterviewSubmittedReviews key={`${clubId}:${params}`} clubId={clubId} filters={filters} initialReviewId={params.get("reviewId") || undefined} />}
  </div>;
}
