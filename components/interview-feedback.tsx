"use client";
import { useEffect, useRef, useState } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { getInterviewFeedback } from "@/lib/workspace-api";
import type { InterviewFeedbackResult } from "@/lib/interview-feedback";
import { InterviewFeedbackSection, EarlierFeedbackRounds } from "@/components/interview-feedback-section";

/** Leader review dialog loader. Renders nothing when the viewer is not authorized. */
export function InterviewFeedbackPanel({ clubId, applicationId, roundId, refreshKey = "", onCount, embedded = false }: { clubId: string; applicationId: string; roundId?: string; refreshKey?: string;
  /** Reports how many interviewer notes the viewer may read (null while loading or when unauthorized). */
  onCount?: (count: number | "error") => void;
  /** Inside a collapsible section that already names it: no outer rule. */
  embedded?: boolean }) {
  const [value, setValue] = useState<InterviewFeedbackResult | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const report = useRef(onCount); report.current = onCount;
  // Reports only settled states, so a reload after Finalize keeps the last count instead of hiding the section.
  useEffect(() => { if (error) report.current?.("error"); else if (value) report.current?.(value.status === "ready" ? value.feedback?.entries.length ?? 0 : 0); }, [value, error]);
  useEffect(() => {
    let current = true; setValue(null); setError(false);
    Promise.resolve(getInterviewFeedback({ clubId, applicationId, ...(roundId ? { roundId } : {}) })).then(v => { if (current) setValue(v); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [clubId, applicationId, roundId, refreshKey, retry]);
  if (error) return <section aria-label="Interview feedback" className="space-y-2 border-b pb-6"><h3 className="oc-card-heading">Interview feedback</h3><p role="status" className="text-sm text-muted-foreground">Interview feedback could not be loaded. <Button type="button" variant="ghost" size="sm" onClick={() => setRetry(v => v + 1)}>Retry</Button></p></section>;
  if (!value) return <LoadingState label="Loading interview feedback…" layout="inline" />;
  if (value.status !== "ready") return null;
  return <div className={embedded ? "space-y-2" : "space-y-2 border-b pb-6"}>
    {value.feedback ? <><InterviewFeedbackSection feedback={value.feedback} /><EarlierFeedbackRounds feedback={value.feedback} /></>
      : <section aria-label="Interview feedback" className="space-y-2"><h3 className="oc-card-heading">Interview feedback</h3><p className="text-sm text-muted-foreground">No interview feedback has been submitted yet.</p></section>}
  </div>;
}
