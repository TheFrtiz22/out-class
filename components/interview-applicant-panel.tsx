"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { InterviewResumeLoader as InterviewResumeViewer } from "@/components/interview-resume-loader";
import { getInterviewApplicantPanel, pinInterviewResume } from "@/lib/workspace-api";
import { useDemoMode } from "@/contexts/demo-context";
import { scholarNames } from "@/lib/scholar-status";
import type { InterviewScope } from "@/lib/interview-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Maximize2, UserRound } from "lucide-react";

const ResumePreview = dynamic(() => import("@/components/interview-resume-preview"), { ssr: false, loading: () => <p role="status" className="text-xs text-muted-foreground">Loading résumé…</p> });

export function InterviewApplicantPanel({ clubId, applicationId, roundId, initialPanel }: InterviewScope & { initialPanel?: Awaited<ReturnType<typeof getInterviewApplicantPanel>> }) {
  const scope = useMemo(() => ({ clubId, applicationId, roundId }), [clubId, applicationId, roundId]);
  const { isDemoEnabled } = useDemoMode();
  const [panel, setPanel] = useState<Awaited<ReturnType<typeof getInterviewApplicantPanel>> | null>(initialPanel || null);
  const [documentId, setDocumentId] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [resumeError, setResumeError] = useState("");
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(!initialPanel);
  const [imageFailed, setImageFailed] = useState(false);
  const resumeTrigger = useRef<HTMLButtonElement>(null);
  const resumeRequest = useRef<AbortController | null>(null);
  const resumeObjectUrl = useRef("");
  const [demoSource, setDemoSource] = useState("/demo/sample-resume.pdf");
  useEffect(() => {
    let current = true;
    setLoading(!initialPanel || retry > 0); setError(""); setResumeError(""); if (!initialPanel || retry) setPanel(null); setDocumentId(""); setImageFailed(false);
    (initialPanel && !retry ? Promise.resolve(initialPanel) : getInterviewApplicantPanel(scope)).then(async value => {
      if (!current) return;
      setPanel(value);
      try {
        const document = value.document || await pinInterviewResume(scope);
        if (current) { setDocumentId(document.id); if ("source" in document) setDemoSource(document.source === "/demo/sample-scanned-resume.pdf" ? "/demo/sample-scanned-resume.pdf" : "/demo/sample-resume.pdf"); }
      } catch { if (current) setResumeError("No interview résumé is available. A private PDF upload is needed."); }
    }).catch(() => { if (current) { setError("Applicant panel unavailable. Your access may have changed."); setOpen(false); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [scope, retry, initialPanel]);
  useEffect(() => {
    if (!documentId) return;
    const controller = new AbortController(); let objectUrl = "";
    resumeRequest.current = controller;
    setUrl("");
    const path = isDemoEnabled ? demoSource : `/api/interview-resumes?${new URLSearchParams({ ...scope, documentId })}`;
    fetch(path, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); resumeObjectUrl.current = objectUrl; setUrl(objectUrl); setResumeError("");
    }).catch(() => { if (!controller.signal.aborted) { setResumeError("Résumé unavailable. Retry to check your current access."); setUrl(""); setOpen(false); } });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); if (resumeRequest.current === controller) { resumeRequest.current = null; resumeObjectUrl.current = ""; } };
  }, [documentId, scope, isDemoEnabled, demoSource, retry]);
  const name = panel?.profile ? `${panel.profile.firstName} ${panel.profile.lastName}` : "Profile not provided";
  const scholarships = scholarNames(panel?.profile?.scholarStatus);
  return <aside id="interview-context" className="oc-room-applicant min-w-0" aria-label="Applicant panel">
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading applicant…</p>}
    <div className="oc-candidate-content">
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : panel && <>
      <div className="oc-applicant-identity">
        {panel.profile?.headshotUrl && !imageFailed ? <Image unoptimized width={120} height={128} src={panel.profile.headshotUrl} alt={`${name} headshot`} onError={() => setImageFailed(true)} className="oc-applicant-photo" /> : <div className="oc-applicant-photo oc-applicant-fallback" role="img" aria-label="No headshot provided"><UserRound className="size-9" aria-hidden="true" /></div>}
        <div className="min-w-0"><h1>{name}</h1>{!!scholarships.length && <ul aria-label="Scholar status" className="oc-applicant-scholars">{scholarships.map((s,i) => <li key={`${s}-${i}`}>{s}</li>)}</ul>}</div>
      </div>
      <div className="oc-resume-document">
      {url ? <ResumePreview url={url} name={name} /> : <FileText className="size-10 text-muted-foreground" aria-hidden="true" />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button ref={resumeTrigger} type="button" variant="ghost" disabled={!documentId} className="oc-resume-trigger" aria-label={`Open résumé for ${name}`}>
          <span className="oc-resume-label">Expand résumé <Maximize2 className="size-4" aria-hidden="true" /></span>
        </Button></DialogTrigger>
        <DialogContent className="flex h-[94dvh] max-w-[96vw] flex-col overflow-hidden sm:max-w-[96vw]" onCloseAutoFocus={e => { e.preventDefault(); resumeTrigger.current?.focus(); }}>
          <DialogHeader className="pr-10"><DialogTitle>{name} · Résumé</DialogTitle><DialogDescription>The document version saved for this interview round.</DialogDescription></DialogHeader>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setOpen(false)}>Minimize to questions</Button>
          {open && documentId && <InterviewResumeViewer scope={scope} documentId={documentId} isDemo={isDemoEnabled} onAccessLost={() => { resumeRequest.current?.abort(); if (resumeObjectUrl.current) URL.revokeObjectURL(resumeObjectUrl.current); resumeObjectUrl.current = ""; setUrl(""); setResumeError("Document access could not be verified. Retry to check access."); }} />}
        </DialogContent>
      </Dialog>
      </div>
      {resumeError && <p role="status" className="text-xs text-muted-foreground">{resumeError}</p>}
    </>}
    {(error || resumeError) && <Button type="button" variant="outline" size="sm" onClick={() => setRetry(v => v + 1)}>Retry applicant panel</Button>}
    </div>
  </aside>;
}
