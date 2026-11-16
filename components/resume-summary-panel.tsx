"use client";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { FileText, ListChecks } from "@/components/icons";
import { useDemoMode } from "@/contexts/demo-context";
import { getResumeSummary } from "@/lib/workspace-api";
import { resumeSectionLabel, type ResumeSummary, type ResumeSummaryResult } from "@/lib/resume-summary";
import type { ResumeSummaryRequest } from "@/actions/resume-summary";
import "@/components/resume-summary-panel.css";

type Tab = "summary" | "document";
const TTL = 5 * 60_000;
const recent = new Map<string, { at: number; value: Promise<ResumeSummaryResult> }>();
/** One request per résumé for a few minutes (opening, tab switches, the review prefetch); failures are not kept. */
export function loadResumeSummary(request: ResumeSummaryRequest, demo: boolean) {
  const key = JSON.stringify([demo, request]), hit = recent.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = getResumeSummary(request);
  recent.set(key, { at: Date.now(), value });
  value.catch(() => { if (recent.get(key)?.value === value) recent.delete(key); });
  if (recent.size > 24) recent.delete(recent.keys().next().value!);
  return value;
}

/**
 * The one résumé panel: a deterministic section summary (Summary, the default) and the document
 * itself (Document). When the sections can't be read, it says so and shows the document only.
 * `document` is rendered on first visit to the Document tab and kept mounted afterwards.
 */
export function ResumeSummaryPanel({ request, name, document, className }: { request: ResumeSummaryRequest | null; name: string; document: ReactNode; className?: string }) {
  const { isDemoEnabled } = useDemoMode();
  const id = useId();
  const [tab, setTab] = useState<Tab>("summary"), [visited, setVisited] = useState(false);
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | ResumeSummaryResult>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const key = request ? JSON.stringify(request) : "";
  useEffect(() => {
    if (!request) { setState({ status: "unreadable" }); return; }
    let current = true;
    setState({ status: "loading" });
    loadResumeSummary(request, isDemoEnabled).then(value => { if (current) setState(value); }, () => { if (current) setState({ status: "error" }); });
    return () => { current = false; };
    // `key` stands for `request`'s contents; a new object with the same scope is the same résumé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isDemoEnabled, attempt]);
  const select = useCallback((next: Tab, focus = false) => {
    setTab(next); if (next === "document") setVisited(true);
    if (focus) requestAnimationFrame(() => globalThis.document.getElementById(`${id}-${next}-tab`)?.focus());
  }, [id]);
  if (state.status === "unreadable") return <div className={["oc-resume-summary-panel", className].filter(Boolean).join(" ")} data-state="document-only">
    <p role="status" className="oc-resume-summary-note">Couldn’t read this résumé’s sections.</p>
    <div className="oc-resume-summary-document">{document}</div>
  </div>;
  return <div className={["oc-resume-summary-panel", className].filter(Boolean).join(" ")} data-state={state.status}>
    <UnderlineTabs label={`${name} résumé`} className="oc-resume-summary-tabs" value={tab} onChange={value => select(value)} panelId={value => `${id}-${value}`}
      items={[{ id: "summary", label: <><ListChecks size={16} aria-hidden="true" />Summary</> }, { id: "document", label: <><FileText size={16} aria-hidden="true" />Document</> }]} />
    <div role="tabpanel" id={`${id}-summary`} aria-labelledby={`${id}-summary-tab`} hidden={tab !== "summary"} tabIndex={0} className="oc-resume-summary-body">
      {state.status === "loading" ? <LoadingState label="Reading résumé sections…" layout="rows" rows={3} />
        : state.status === "error" ? <div role="status" className="oc-resume-summary-error">
          <p>The summary isn’t available right now.</p>
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setAttempt(v => v + 1)}>Try again</Button><Button type="button" variant="ghost" size="sm" onClick={() => select("document", true)}>View document</Button></div>
        </div>
        : <ResumeSummaryView summary={state.summary} />}
    </div>
    <div role="tabpanel" id={`${id}-document`} aria-labelledby={`${id}-document-tab`} hidden={tab !== "document"} className="oc-resume-summary-document">
      {(visited || tab === "document") && document}
    </div>
  </div>;
}

export function ResumeSummaryView({ summary }: { summary: ResumeSummary }) {
  const id = useId();
  return <div className="oc-resume-summary">
    <p className="oc-resume-summary-provenance"><FileText size={14} aria-hidden="true" />From the résumé file · check the document for detail</p>
    {summary.sections.map((section, s) => <section key={`${section.kind}-${s}`} aria-labelledby={`${id}-${s}`} className="oc-resume-summary-section">
      <h3 id={`${id}-${s}`}>{section.kind === "Other" ? section.heading : resumeSectionLabel[section.kind]}</h3>
      <ul>
        {section.items.map((item, i) => <li key={i} className="oc-resume-summary-item">
          {(item.org || item.dates) && <p className="oc-resume-summary-line"><span className="oc-resume-summary-org">{item.org}</span>{item.dates && <span className="oc-resume-summary-dates">{item.dates}</span>}</p>}
          {item.role && <p className="oc-resume-summary-role">{item.role}</p>}
          {!!item.bullets.length && <ul className="oc-resume-summary-bullets">{item.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
          {!!item.metrics.length && <ul className="oc-resume-summary-metrics" aria-label="Highlights">{item.metrics.map(m => <li key={m}>{m}</li>)}</ul>}
        </li>)}
      </ul>
    </section>)}
  </div>;
}
