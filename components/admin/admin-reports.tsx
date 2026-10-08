"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { NativeSelect } from "@/components/ui/native-select"
import { useEffect, useState } from "react";
import { listAdminReports, resolveAdminReport } from "@/actions/admin-workspace";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformReport } from "@prisma/client";
export function AdminReports({ support = false }: { support?: boolean }) {
  const [loading, setLoading] = useState(true), [rows, setRows] = useState<PlatformReport[]>([]), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { let live = true; setLoading(true); setError(""); listAdminReports({ query, status, support }).then(r => { if (live) setRows(r); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [query, status, support, retry]);
  return <section className="space-y-4"><div className="flex flex-wrap gap-3"><label className="flex-1">Search<Input value={query} onChange={e => setQuery(e.target.value)} /></label><label>Status<NativeSelect className="block min-h-11 rounded-md border bg-card px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option>{["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"].map(s => <option key={s}>{s}</option>)}</NativeSelect></label></div><label className="block">Resolution / investigation reason<Textarea value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert">{error}</p>}
    {loading && !rows.length ? <LoadingState label={support ? "Loading support requests…" : "Loading reports…"} rows={3} /> : rows.length ? rows.map(row => <article key={row.id} className="space-y-3 rounded-lg border bg-card p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{row.kind} · {row.status}</p><h2 className="font-semibold">{row.summary}</h2><p className="break-all text-sm">Target: {row.targetId}</p>{row.resolution && <p>{row.resolution}</p>}<div className="flex flex-wrap gap-2">{["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"].filter(s => s !== row.status).map(next => <Button key={next} variant="outline" disabled={busy || reason.trim().length < 10} onClick={async () => { if (["RESOLVED", "DISMISSED"].includes(next) && !window.confirm(`${next === "RESOLVED" ? "Resolve" : "Dismiss"} this report?`)) return; setBusy(true); setError(""); try { await resolveAdminReport({ id: row.id, revision: row.revision, status: next, reason }); setRetry(r => r + 1); } catch (e) { setError(e instanceof Error ? e.message : "Resolution failed."); } finally { setBusy(false); } }}>{next}</Button>)}</div></article>) : !error && <EmptyState density="compact" align="start" title={support ? "No matching support requests" : "No matching reports"} description="Try another search or status filter." />}
  </section>;
}
