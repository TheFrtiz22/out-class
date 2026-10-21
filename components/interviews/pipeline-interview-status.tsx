"use client";
import Link from "next/link";
import { interviewSetupHref } from "@/lib/interview-setup";
import { handleClubLink } from "@/lib/workspace-navigation";
import { type InterviewSetupStatus } from "@/lib/interview-round-workflow";
export function PipelineInterviewStatus({ clubId, roundId, status, disabled }: { clubId: string; roundId: string; status?: InterviewSetupStatus; disabled: boolean }) {
  const href = interviewSetupHref(clubId, roundId, status?.tab ?? "kits");
  return <div className="space-y-1 text-sm">{status && <p role="status">{status.label}{status.next && <span className="ml-2 text-muted-foreground">{status.next}</span>}</p>}<Link href={href} aria-disabled={disabled} className="oc-profile-link" onClick={e => { if (disabled) e.preventDefault(); else handleClubLink(e, href); }}>{status?.configured ? "Manage interviews" : "Set up interviews"}</Link>{disabled && <p className="text-xs text-muted-foreground">Save pipeline changes before opening setup.</p>}</div>;
}
