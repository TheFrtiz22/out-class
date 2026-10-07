"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readPlatformResource, inspectPlatformRecord, changePlatformResource, type PlatformResource } from "@/actions/platform-admin";
import { inspectAdminStudent, inspectAdminClub, setAdminClubSuspended, resendAdminStudentInvitation, resendAdminClubInvitation } from "@/actions/admin-workspace";
import { platformStatuses } from "@/lib/platform-console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : value instanceof Date ? value.toISOString() : value == null ? "—" : String(value);
const name = (row: Row) => text(row.name || row.email || row.title || row.action || row.id);
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
export function AdminRecord({ value }: { value: unknown }) {
  if (value == null) return <span className="text-muted-foreground">None</span>;
  if (value instanceof Date) return <span>{value.toLocaleString()}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="space-y-3">{value.map((v, i) => <li key={i} className="rounded-lg border p-3"><AdminRecord value={v} /></li>)}</ul> : <span className="text-muted-foreground">No records</span>;
  if (typeof value === "object") return <dl className="space-y-3">{Object.entries(value).filter(([key]) => !/token|password|secret|credentials/i.test(key)).map(([key, v]) => <div key={key} className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label(key)}</dt><dd className="mt-1 break-words text-sm"><AdminRecord value={v} /></dd></div>)}</dl>;
  return <span>{typeof value === "boolean" ? value ? "Yes" : "No" : text(value)}</span>;
}
export function AdminDirectory({ resource, initialQuery = "", initialUserId = "", initialClubId = "" }: { resource: PlatformResource; initialQuery?: string; initialUserId?: string; initialClubId?: string }) {
  const [query, setQuery] = useState(initialQuery), [status, setStatus] = useState(""), [page, setPage] = useState(0), [rows, setRows] = useState<Row[]>([]), [reason, setReason] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [selected, setSelected] = useState<Row | null>(null), [detail, setDetail] = useState<unknown>(null), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    readPlatformResource(resource, page, { query, status, userId: initialUserId, clubId: initialClubId }).then(r => { if (live) setRows(r as Row[]); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [resource, query, status, page, retry, initialUserId, initialClubId]);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); setRetry(r => r + 1); } catch (e) { setError(e instanceof Error ? e.message : "Operation failed."); } finally { setBusy(false); } }
  async function inspect(row: Row) { if (reason.trim().length < 10) { setError("Provide an investigation reason of at least 10 characters."); return; } await run(async () => {
    const result = resource === "clubs" ? await inspectAdminClub(String(row.id), reason) : resource === "users" ? await inspectAdminStudent(String(row.id), reason) : ["applications", "meetings"].includes(resource) ? await inspectPlatformRecord(resource, String(row.id), reason) : row;
    setDetail(result); setSelected(row); setConfirmation("");
  }); }
  return <section className="space-y-5">
    <div className="flex flex-wrap gap-3"><label className="min-w-60 flex-1">Search<Input type="search" value={query} placeholder="Name, email, ID, or club" onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>{platformStatuses[resource] && <label>Filter<select aria-label="Filter records" className="block min-h-11 rounded-md border bg-card px-3" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">All</option>{platformStatuses[resource]!.map(s => <option key={s} value={s}>{s === "SUSPENDED" ? "Disabled / suspended" : label(s.toLowerCase())}</option>)}</select></label>}</div>
    <label className="block">Investigation / support reason<Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this record needs inspection or a change." maxLength={1000} /></label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Loading records…</p> : rows.length ? <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Record</th><th className="p-4">Status / details</th><th className="p-4">Inspect</th></tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id || i)} className="border-b last:border-0"><td className="max-w-80 break-words p-4"><strong>{name(row)}</strong><small className="mt-1 block text-muted-foreground">{text(row.id)}</small></td><td className="p-4">{text(row.status || (row.disabledAt ? "Disabled" : row.suspendedAt ? "Suspended" : row.claimedAt ? "Claimed" : row.email ? "Enabled" : resource === "clubs" ? ((row._count as { invitations?: number } | undefined)?.invitations ? "Invited" : "Unclaimed") : row.date || row.reason || row.createdAt))}</td><td className="p-4"><Button variant="outline" disabled={busy} onClick={() => void inspect(row)}>Inspect</Button></td></tr>)}</tbody></table></div> : <p className="rounded-xl border bg-card p-6">No matching records.</p>}
    <div className="flex items-center gap-3"><Button variant="outline" disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page + 1}</span><Button variant="outline" disabled={rows.length < 100 || loading} onClick={() => setPage(p => p + 1)}>Next</Button><Button variant="ghost" onClick={() => setRetry(r => r + 1)}>Refresh</Button></div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setDetail(null); } }}><DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto"><DialogTitle>{selected ? name(selected) : "Record"}</DialogTitle><DialogDescription>Platform investigation · Actions are attributed to your administrator account.</DialogDescription>
      {error && <p role="alert">{error}</p>}<AdminRecord value={detail} />
      {selected && resource === "users" && <div className="space-y-4 border-t pt-4"><div className="flex flex-wrap gap-3"><Link className="underline" href={`/platform/applications?userId=${selected.id}`}>View applications</Link><Link className="underline" href={`/platform/permissions?userId=${selected.id}`}>View clubs and access</Link><Button variant="outline" disabled={busy} onClick={() => void run(() => resendAdminStudentInvitation(String(selected.id), reason))}>Resend unclaimed invitation</Button></div>
        <label className="block">Confirm sensitive operation<Input value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Type DISABLE, ENABLE, or LOG IN AS" /></label>
        <div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={busy || confirmation !== (selected.disabledAt ? "ENABLE" : "DISABLE")} onClick={() => void run(async () => { await changePlatformResource({ kind: "user", id: selected.id, disabled: !selected.disabledAt }, reason); setSelected(null); })}>{selected.disabledAt ? "Enable account" : "Disable account"}</Button><Button disabled={busy || confirmation !== "LOG IN AS"} onClick={() => void run(async () => { const response = await fetch("/api/platform/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", userId: selected.id, reason, confirmation }) }); const r = await response.json(); if (!response.ok) throw Error(r.error || "Could not start support session."); window.location.assign("/?workspace=student"); })}>Log in as</Button></div></div>}
      {selected && resource === "clubs" && <div className="space-y-3 border-t pt-4"><Link className="underline" href={`/platform/applications?clubId=${selected.id}`}>View applications</Link><label className="block">Type {selected.suspendedAt ? "RESTORE" : "SUSPEND"} to confirm<Input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><Button variant="destructive" disabled={busy || confirmation !== (selected.suspendedAt ? "RESTORE" : "SUSPEND")} onClick={() => void run(async () => { await setAdminClubSuspended(String(selected.id), !selected.suspendedAt, reason); setSelected(null); })}>{selected.suspendedAt ? "Restore club" : "Suspend club"}</Button>
        {((detail as { club?: { invitations?: Row[] } } | null)?.club?.invitations || []).map(invite => <div key={String(invite.id)} className="flex flex-wrap items-center gap-3 rounded-md border p-3"><span className="flex-1">{text(invite.email)} · {text(invite.status)}</span><Link href={`/invitations/${invite.id}`} className="underline">Claim link</Link><Button variant="outline" onClick={() => void navigator.clipboard.writeText(new URL(`/invitations/${invite.id}`, window.location.origin).href).catch(() => setError("Could not copy link. Open the claim link to copy it."))}>Copy link</Button><Button variant="outline" disabled={busy || invite.status !== "PENDING"} onClick={() => void run(() => resendAdminClubInvitation(String(selected.id), String(invite.id), reason))}>Resend</Button></div>)}
      </div>}
    </DialogContent></Dialog>
  </section>;
}
