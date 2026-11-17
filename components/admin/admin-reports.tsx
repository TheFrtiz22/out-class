"use client";
import { userMessage } from "@/lib/user-message"
import { SearchField } from "@/components/ui/search-field"
import { PillGroup } from "@/components/ui/segmented-control"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { useEffect, useState } from "react";
import { listAdminReports, resolveAdminReport } from "@/actions/admin-workspace";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { StatusMark, type StatusTone } from "@/components/ui/status-pill";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { getFeedbackScreenshot } from "@/lib/workspace-api";
import { ADMIN_REPORTS_CHANGED_EVENT, feedbackKindLabels, type FeedbackKind } from "@/lib/feedback-reports";

const REPORT_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"] as const;
const sentenceCase = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replaceAll("_", " ");
const statusTones: Record<string, StatusTone> = { OPEN: "neutral", INVESTIGATING: "active", RESOLVED: "done", DISMISSED: "neutral" };
/** Each button names what it does to the report, not the status code it sets. */
const statusActions: Record<string, string> = { OPEN: "Reopen", INVESTIGATING: "Mark investigating", RESOLVED: "Resolve", DISMISSED: "Dismiss" };

function ReportContext({ row }: { row: { id: string; context: { path: string; userAgent: string; viewport: string | null; appVersion: string; hasScreenshot: boolean } | null } }) {
  const [shot, setShot] = useState<{ url?: string; error?: string; loading?: boolean }>({});
  const c = row.context;
  if (!c) return null;
  return <div className="space-y-2 text-sm">
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground"><dt>Page</dt><dd className="break-all text-foreground">{c.path}</dd><dt>Device</dt><dd>{c.userAgent}{c.viewport ? ` · ${c.viewport}` : ""}</dd><dt>Version</dt><dd>{c.appVersion}</dd></dl>
    {c.hasScreenshot && (shot.url ? <a href={shot.url} target="_blank" rel="noreferrer noopener" className="block w-fit">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 60-second signed URL, not an optimizable asset */}
      <img src={shot.url} alt="Screenshot attached to this report" className="max-h-80 max-w-full rounded-md border border-border object-contain" /></a> : <Button variant="outline" size="sm" disabled={shot.loading} onClick={async () => { setShot({ loading: true }); try { setShot({ url: (await getFeedbackScreenshot({ id: row.id })).url }); } catch (e) { setShot({ error: userMessage(e, "Couldn’t open the screenshot.") }); } }}>{shot.loading ? "Opening…" : "View screenshot"}</Button>)}
    {shot.error && <p role="alert" className="text-destructive">{shot.error}</p>}
  </div>;
}
export function AdminReports({ support = false }: { support?: boolean }) {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true), [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminReports>>>([]), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [reasons, setReasons] = useState<Record<string, string>>({}), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [kind, setKind] = useState<"" | FeedbackKind>("");
  useEffect(() => { let live = true; setLoading(true); setError(""); listAdminReports({ query, status, support, ...(support ? {} : { kind }) }).then(r => { if (live) setRows(r); }).catch(e => { if (live) setError(userMessage(e, "Couldn’t load reports. Try again.")); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [query, status, support, kind, retry]);
  // The admin shell watches the queue (Realtime signal or 20 s poll) and announces changes; refetch through the audited list.
  useEffect(() => { const changed = () => setRetry(r => r + 1); window.addEventListener(ADMIN_REPORTS_CHANGED_EVENT, changed); return () => window.removeEventListener(ADMIN_REPORTS_CHANGED_EVENT, changed); }, []);
  return <section className="oc-workspace-stack"><div className="oc-toolbar"><SearchField aria-label="Search reports" placeholder="Search" containerClassName="flex-1" value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery("")} /><PillGroup label="Status" size="compact" value={status} onChange={setStatus} options={[{ value: "", label: "All" }, ...REPORT_STATUSES.map(s => ({ value: s, label: sentenceCase(s) }))]} />{!support && <PillGroup label="Kind" size="compact" value={kind} onChange={setKind} options={[{ value: "" as const, label: "All" }, ...(["ISSUE", "FEEDBACK"] as const).map(k => ({ value: k, label: k === "ISSUE" ? "Issues" : feedbackKindLabels[k] }))]} />}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !rows.length ? <LoadingState label={support ? "Loading support requests…" : "Loading reports…"} rows={3} /> : rows.length ? rows.map(row => { const reason = reasons[row.id] ?? ""; return <Panel as="article" key={row.id} className="space-y-3"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><StatusMark label={sentenceCase(row.status)} tone={statusTones[row.status]} /><span className="text-muted-foreground">{(feedbackKindLabels as Record<string, string>)[row.kind] ?? sentenceCase(row.kind)}</span></div><h2 className="whitespace-pre-wrap break-words font-semibold">{row.summary}</h2><p className="break-all text-sm">Target: {row.target.href ? <Link className="underline underline-offset-4" href={row.target.href}>{row.target.label}</Link> : row.target.label} <span className="text-muted-foreground">({row.targetId})</span></p><ReportContext row={row} /><p className="break-all text-sm text-muted-foreground">Reported by {row.reporter.name ? `${row.reporter.name} · ` : ""}{row.reporter.email} · <time dateTime={new Date(row.createdAt).toISOString()}>{new Date(row.createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })}</time></p>{row.resolution && <p className="text-sm">{row.resolution}</p>}<label className="oc-field">Note for the record<Textarea rows={2} value={reason} onChange={e => setReasons(r => ({ ...r, [row.id]: e.target.value }))} /><span className="text-xs text-muted-foreground">Required to change the status: at least 10 characters, kept with the report.</span></label><div className="flex flex-wrap gap-2">{REPORT_STATUSES.filter(s => s !== row.status).map(next => <Button key={next} variant="outline" disabled={busy || reason.trim().length < 10} onClick={async () => { if (["RESOLVED", "DISMISSED"].includes(next) && !(await confirm({ title: `${next === "RESOLVED" ? "Resolve" : "Dismiss"} this report?`, confirmLabel: next === "RESOLVED" ? "Resolve report" : "Dismiss report" }))) return; setBusy(true); setError(""); try { await resolveAdminReport({ id: row.id, revision: row.revision, status: next, reason }); setReasons(r => ({ ...r, [row.id]: "" })); setRetry(r => r + 1); window.dispatchEvent(new Event("outclass:admin-reports-resolved")); } catch (e) { setError(userMessage(e, "Resolution failed.")); } finally { setBusy(false); } }}>{statusActions[next]}</Button>)}</div></Panel>; }) : !error && <EmptyState density="compact" align="start" title={support ? "No matching support requests" : "No matching reports"} description={query || status || kind ? "No request fits this search or filter." : support ? "No one has asked for support." : "No reports have been filed."} action={query || status || kind ? <Button variant="outline" size="sm" onClick={() => { setQuery(""); setStatus(""); setKind(""); }}>Clear search and filters</Button> : <Button variant="outline" size="sm" asChild><Link href="/platform">Back to admin overview</Link></Button>} />}
  </section>;
}
