"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Download, ExternalLink, FileText, XIcon } from "@/components/icons";
import { InterviewResumeResource } from "@/lib/interview-resume-resource";
import type { InterviewScope } from "@/lib/interview-access";
import { resumeDownloadName, resumePreviewKind } from "@/lib/resume-preview-kind";
import "@/components/resume-viewer.css";

// pdf.js loads only when a PDF résumé is opened (public/pdfjs, copied by scripts/copy-pdfjs-assets.cjs).
const ResumePdfPages = dynamic(() => import("@/components/interview-resume-preview"), {
  ssr: false,
  loading: () => <LoadingState label="Loading résumé…" layout="inline" rows={3} />,
});

/**
 * In-page résumé viewer for leaders. `href` must be the server-authorized reference the
 * profile read returned (the /api/recruiting-resumes proxy, a Demo asset, or a student's own
 * external link); the viewer never builds Storage or service URLs. Download uses the same href.
 */
export function ResumeViewerDialog({ href, name, clubId, applicationId, trigger = "View résumé", triggerClassName }: {
  href: string; name: string; clubId: string; applicationId: string; trigger?: ReactNode; triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const kind = resumePreviewKind(href);
  // One resource per opening: its object URL and pdf.js document are released on close.
  const resource = useMemo(() => open && kind === "pdf"
    ? new InterviewResumeResource("recruiting", { clubId, applicationId, roundId: applicationId } as InterviewScope, "resume", false, undefined, href)
    : null, [open, kind, clubId, applicationId, href]);
  useEffect(() => () => resource?.invalidate(), [resource]);
  const title = `Résumé · ${name}`;
  const external = kind === "external";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={triggerClassName}><FileText aria-hidden="true" />{trigger}</Button>
      </DialogTrigger>
      <DialogContent className="oc-resume-viewer motion-reduce:animate-none" showCloseButton={false} aria-describedby={undefined} data-resume-kind={kind}>
        <header className="oc-resume-viewer-header">
          <DialogTitle className="oc-resume-viewer-title">{title}</DialogTitle>
          <div className="oc-resume-viewer-actions">
            <Button asChild variant="outline" size="sm">
              {external
                ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink aria-hidden="true" />Open link<span className="sr-only"> (opens in a new tab)</span></a>
                : <a href={href} download={resumeDownloadName(name)} referrerPolicy="no-referrer"><Download aria-hidden="true" />Download</a>}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close résumé"><XIcon aria-hidden="true" /></Button>
            </DialogClose>
          </div>
        </header>
        <div className="oc-resume-viewer-body">
          {resource
            ? <ResumePdfPages resource={resource} name={name} unavailableText="This résumé couldn’t be displayed. Use Download to open it." />
            : kind !== "pdf" && <div className="oc-resume-viewer-empty" role="status">
                <FileText aria-hidden="true" size={32} />
                <p className="font-medium">{external ? "Preview isn’t available for linked résumés." : "Preview isn’t available for this file type."}</p>
                <p className="text-sm text-muted-foreground">{external ? "Use Open link to view it on the site where it’s hosted." : "Use Download to open it."}</p>
              </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
