"use client";

import { useRef, useState } from "react";
import { previewRosterImport, confirmRosterImport } from "@/actions/roster-import";
import { parseRosterCsv, ROSTER_MAX_BYTES, ROSTER_MAX_ROWS } from "@/lib/roster-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Preview = Awaited<ReturnType<typeof previewRosterImport>>;
const labels = { READY: "Ready", INVALID: "Invalid", DUPLICATE: "Duplicate", ALREADY_MEMBER: "Already a member", ALREADY_INVITED: "Already invited" };

export function RosterCsvImporter({ clubId }: { clubId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof confirmRosterImport>> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const working = useRef(false);
  const upload = useRef<{ file: File; requestId: string } | null>(null);
  async function load(file?: File) {
    if (working.current || !file) return;
    working.current = true; setBusy(true); setError(""); setPreview(null); setResult(null); setPage(0);
    try {
      if (upload.current?.file !== file) upload.current = { file, requestId: crypto.randomUUID() };
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a comma-separated CSV file.");
      if (file.size > ROSTER_MAX_BYTES) throw new Error("CSV must be 1 MB or smaller.");
      const csv = await file.text();
      parseRosterCsv(csv); // Immediate structural feedback; server independently parses and validates.
      const data = await previewRosterImport({ clubId, filename: file.name, csv, requestId: upload.current.requestId });
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not validate CSV. Try again."); }
    finally { working.current = false; setBusy(false); }
  }
  async function confirm() {
    if (working.current || !preview || result?.completed) return;
    working.current = true; setBusy(true); setError("");
    try {
      let previousProcessed = -1;
      while (true) {
        const outcome = await confirmRosterImport(preview.id);
        setResult(outcome);
        if (outcome.completed) break;
        if (outcome.processed <= previousProcessed) throw new Error("Import paused. Retry to resume processing.");
        previousProcessed = outcome.processed;
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not confirm import. Try again."); }
    finally { working.current = false; setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border p-4 sm:p-6" aria-label="CSV member roster import" aria-busy={busy}>
    <div><h2 className="text-lg font-semibold">Import member roster</h2><p className="text-sm text-muted-foreground">Upload → preview → confirm. Required: name, computing_id. Optional: year (2025–2030). Up to {ROSTER_MAX_ROWS.toLocaleString()} rows and 1 MB.</p></div>
    <div className="rounded-lg border border-dashed p-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (working.current) return; if (e.dataTransfer.files.length !== 1) { setError("Upload one CSV file at a time."); return; } void load(e.dataTransfer.files[0]); }}>
      <label className="block space-y-2"><span className="text-sm">Drop a CSV here or choose a file</span><Input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void load(file); }} /></label>
      <p className="mt-2 text-xs text-muted-foreground">Column order may vary. Supported headers include Full Name, Graduation Year, and Computing ID. Ambiguous columns such as email or ID are rejected.</p>
    </div>
    {busy && <p role="status">{preview ? result && !result.completed ? `Importing members… ${result.processed} of ${result.total} rows processed` : "Importing members…" : "Parsing and validating CSV…"}</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{!preview && upload.current && <Button variant="outline" disabled={busy} onClick={() => void load(upload.current?.file)}>Retry upload</Button>}</div>}
    {preview && <>
      <p className="break-words font-medium">{preview.filename}</p>
      {!result?.completed && <p role="status" className="text-sm">{preview.summary.total} total rows · {preview.summary.ready} ready · {preview.summary.duplicates} duplicates · {preview.summary.invalid} invalid · {preview.summary.alreadyMember} already members · {preview.summary.alreadyInvited} already invited</p>}
      {!result?.completed && <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">Roster validation preview</caption><thead className="bg-muted"><tr>{["Name", "Year", "Computing ID", "Status"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{preview.rows.slice(page * 50, (page + 1) * 50).map(row => <tr key={row.rowNumber} className="border-t align-top"><td className="max-w-60 break-words p-3">{row.name || "—"}</td><td className="p-3">{row.year || "—"}</td><td className="max-w-44 break-words p-3">{row.identifier || "—"}</td><td className="p-3"><span className="font-medium">{labels[row.status]}</span>{row.existingUser && <p className="text-xs text-muted-foreground">Existing OutClass user</p>}{row.errors.map((message, i) => <p key={i} className="text-xs text-destructive">{message}</p>)}{row.warnings.map((message, i) => <p key={i} className="text-xs text-muted-foreground">Warning: {message}</p>)}</td></tr>)}</tbody></table></div>}
      {preview.rows.length > 50 && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-sm">Page {page + 1} of {Math.ceil(preview.rows.length / 50)}</span><Button variant="outline" disabled={(page + 1) * 50 >= preview.rows.length} onClick={() => setPage(value => value + 1)}>Next</Button></div>}
      {(!result || !result.completed) && <><p className="text-sm text-muted-foreground">Imports are additive: existing members stay in the organization, including anyone absent from this file. Fix and reupload before continuing, or import the ready rows. Importing creates pending MEMBER invitations, not memberships. Existing invitations remain unchanged. No emails will be sent. Membership and invitation changes since preview are rechecked.</p><Button disabled={busy || !(preview.summary.ready + preview.summary.alreadyMember + preview.summary.alreadyInvited)} onClick={() => void confirm()}>{result ? "Resume import" : "Import members"}</Button></>}
    </>}
    {result?.completed && <div role="status" className="rounded-lg bg-muted p-4"><p className="font-medium">Roster import confirmed</p><ul className="mt-2 text-sm space-y-1"><li>{result.created} new invitations</li><li>{result.alreadyMember} already members</li><li>{result.alreadyInvited} already invited</li><li>{result.invalid} invalid</li>{result.duplicates > 0 && <li>{result.duplicates} duplicate rows</li>}{result.failed > 0 && <li>{result.failed} failed rows — review the errors below and reupload those rows</li>}</ul><p className="mt-2 text-sm">No emails sent.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">Final roster import outcomes</caption><thead><tr>{["Name", "Year", "Computing ID", "Outcome"].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{result.rows.slice(page * 50, (page + 1) * 50).map(row => <tr key={row.rowNumber} className="border-t align-top"><td className="max-w-60 p-2 break-words">{row.name || "—"}</td><td className="p-2">{row.year || "—"}</td><td className="max-w-44 p-2 break-words">{row.identifier || "—"}</td><td className="p-2">{row.status === "INVITATION_CREATED" ? "New invitation" : row.status === "ALREADY_INVITED" ? "ALREADY_INVITED" : row.status.replaceAll("_", " ")}{row.errors.map((message, index) => <p key={index} className="text-xs text-muted-foreground">{message}</p>)}</td></tr>)}</tbody></table></div></div>}
  </section>;
}
