"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { completeAccountDeletion, listAccountDeletionRequests } from "@/actions/account-deletion";
import { userMessage } from "@/lib/user-message"

type Row = Awaited<ReturnType<typeof listAccountDeletionRequests>>[number];
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(new Date(iso));

/** Pending account deletion requests. Completion needs fresh Admin verification and a reason. */
export function AdminDeletionRequests() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { let live = true; setLoading(true); listAccountDeletionRequests().then(r => { if (live) setRows(r); }).catch(e => { if (live) setError(userMessage(e, "Could not load deletion requests.")); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [retry]);
  async function complete(row: Row) {
    if (!(await confirm({ title: "Complete this account deletion?", description: "Personal data, Storage files and the sign-in account are deleted. This can’t be undone.", confirmLabel: "Complete deletion", tone: "danger" }))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeAccountDeletion({ id: row.id, revision: row.revision, reason });
      setNotice(`Deleted. ${result.storageObjects} files removed; ${result.anonymizedApplications} applications and ${result.anonymizedMemberships} memberships anonymized.${result.retainedDecisionLetters || result.retainedResumeSnapshots ? ` ${result.retainedDecisionLetters} decision letters and ${result.retainedResumeSnapshots} résumé snapshots remain (immutable until a migration).` : ""}`);
      setRetry(r => r + 1);
    } catch (e) { setError(userMessage(e, "Deletion failed.")); setRetry(r => r + 1); }
    finally { setBusy(false); }
  }
  return <section className="oc-workspace-stack" aria-labelledby="deletion-requests-heading">
    <h2 id="deletion-requests-heading" className="text-xl font-semibold">Account deletion requests</h2>
    <label className="oc-field">Completion reason<Textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loading && !rows.length ? <LoadingState label="Loading deletion requests…" rows={2} /> : rows.length ? rows.map(row => <Panel as="article" key={row.id} className="space-y-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{row.due ? "Due" : "In cancellation window"}</p>
      <p className="break-all text-sm">Account: {row.userId}</p>
      <p className="text-sm">Requested {day(row.requestedAt)} · Due {day(row.dueAt)}</p>
      <p className="text-sm">{row.emailSent === false ? "Confirmation email failed to send" : row.emailSent ? "Confirmation email sent" : "Confirmation email status unknown"}{row.status === "INVESTIGATING" ? " · A previous run didn’t finish; run it again" : ""}</p>
      <Button variant="destructive" disabled={busy || !row.due || reason.trim().length < 10} onClick={() => void complete(row)}>Complete deletion</Button>
    </Panel>) : !error && <p className="text-sm text-muted-foreground">No pending deletion requests.</p>}
  </section>;
}
