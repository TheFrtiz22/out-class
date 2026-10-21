"use client";
import Link from "next/link";
import { interviewSetupHref } from "@/lib/interview-setup";
import { handleClubLink } from "@/lib/workspace-navigation";
import { type InterviewSetupStatus } from "@/lib/interview-round-workflow";
export function PipelineInterviewStatus({ clubId, roundId, status, disabled }: { clubId: string; roundId: string; status?: InterviewSetupStatus; disabled: boolean }) {
  const href = interviewSetupHref(clubId, roundId, status?.tab ?? "kits");
  return <div className="space-y-3 text-sm">{status && <p role="status">{status.label}{status.next && <span className="ml-2 text-muted-foreground">{status.next}</span>}</p>}<Link href={href} aria-disabled={disabled} className="oc-profile-link" onClick={e => { if (disabled) e.preventDefault(); else handleClubLink(e, href); }}>{status?.configured ? "Manage interviews" : "Set up interviews"}</Link><div className="flex flex-wrap gap-x-5 gap-y-2">{[["kits", "Manage questions"], ["availability", "Set availability"], ["schedule", "Configure rooms & panels"]].map(([tab, label]) => { const destination = tab === "availability" ? `${interviewSetupHref(clubId, roundId, "schedule")}&schedule=availability` : interviewSetupHref(clubId, roundId, tab); return <Link key={tab} href={destination} aria-disabled={disabled} className="inline-flex min-h-11 items-center underline underline-offset-4" onClick={event => { if (disabled) event.preventDefault(); else handleClubLink(event, destination) }}>{label}</Link> })}</div>{disabled && <p className="text-xs text-muted-foreground">Save pipeline changes before opening setup.</p>}</div>;
}
