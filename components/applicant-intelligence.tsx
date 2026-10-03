"use client";
import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getApplicantDisplay, saveApplicantObservation, deleteApplicantObservation, getApplicantDisplayConfiguration, saveApplicantDisplayConfiguration } from "@/lib/workspace-api";
import { applicantFields, fieldLabels, type ApplicantDisplay, type ApplicantDisplayConfig } from "@/lib/applicant-display";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ApplicantDisplayPanel({ clubId, applicationId, refreshKey = "", mode = "review" }: { clubId: string; applicationId: string; refreshKey?: string; mode?: "review" | "interview" | "voting" }) {
  const [data, setData] = useState<ApplicantDisplay | null>(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const [body, setBody] = useState(""), [kind, setKind] = useState<"PRO" | "CON">("PRO"), [editing, setEditing] = useState<string | undefined>(), [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    setData(null); setError(""); setBody(""); setEditing(undefined);
    getApplicantDisplay({ clubId, applicationId }).then(v => { if (current) setData(v) }).catch(e => { if (current) setError(e instanceof Error ? e.message : "Review information unavailable.") });
    return () => { current = false };
  }, [clubId, applicationId, revision, refreshKey]);
  async function mutate(remove?: string) {
    setBusy(true); setError("");
    try {
      if (remove) await deleteApplicantObservation({ clubId, applicationId, id: remove });
      else await saveApplicantObservation({ clubId, applicationId, id: editing, kind, body });
      setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save observation.") }
    finally { setBusy(false) }
  }
  return <section aria-label={`${mode} applicant information`} className="space-y-5 rounded-lg border bg-card p-5">
    <header><h3 className="font-semibold">{mode === "review" ? "Reviewer observations" : "Applicant information"}</h3><p className="text-xs text-muted-foreground">Shared Interview and Voting display · filtered for your current review access.</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" onClick={() => setRevision(v => v + 1)}>Reload</Button></p>}
    {!data && !error && <p role="status">Loading authorized review information…</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">{data.configured.length} configured fields · {data.visible.length} available.{data.anonymous && " Anonymous review withholds identifying fields and free text."}</p>
      {!!data.withheld.length && <p className="text-xs text-muted-foreground">Withheld: {data.withheld.map(f => fieldLabels[f]).join(", ")}</p>}
      {mode !== "review" && <div className="flex items-center gap-5">{!data.anonymous && data.visible.includes("photo") && <Avatar className="size-24 sm:size-28"><AvatarImage src={data.photo || undefined} alt="Applicant photo" /><AvatarFallback className="text-xl">{data.sections.find(s => s.field === "name")?.items[0]?.split(/\s+/).map(w => w[0]).slice(0,2).join("") || "?"}</AvatarFallback></Avatar>}{data.visible.includes("name") && <h3 className="min-w-0 break-words font-display text-2xl sm:text-3xl">{data.sections.find(s => s.field === "name")?.items[0]}</h3>}</div>}
      {mode !== "review" && !!data.links?.length && <nav aria-label="Applicant documents and profile" className="flex gap-4">{data.links.map(link => <a key={link.field} href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm underline">{link.label}</a>)}</nav>}
      {data.sections.filter(s => (mode !== "review" && s.field !== "name") || ["pros", "cons", "score", "feedback"].includes(s.field)).map(s => <section key={s.field} className={`space-y-2 border-t pt-4 ${s.field === "pros" ? "border-l-2 border-l-emerald-600 pl-3" : s.field === "cons" ? "border-l-2 border-l-amber-600 pl-3" : ""}`}><h4 className="text-sm font-medium">{s.label}</h4>{["pros", "cons"].includes(s.field) ? <>
        {data.observations.filter(o => o.kind === (s.field === "pros" ? "PRO" : "CON")).map(o => <div key={o.id} className="space-y-1 text-sm"><p className="whitespace-pre-wrap break-words">{o.body}</p><p className="text-xs text-muted-foreground">{o.author} · {new Date(o.createdAt).toLocaleString()}{o.updatedAt !== o.createdAt && ` · Updated ${new Date(o.updatedAt).toLocaleString()}`}</p>{mode === "review" && o.own && <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(o.id); setBody(o.body); setKind(o.kind as "PRO" | "CON") }}>Edit</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate(o.id)}>Delete</Button></div>}</div>)}
        {!s.items.length && <p className="text-xs text-muted-foreground">No observations yet.</p>}
      </> : s.items.length ? s.items.map((value, i) => <p key={i} className="whitespace-pre-wrap break-words text-sm">{value}</p>) : <p className="text-xs text-muted-foreground">Not provided.</p>}</section>)}
      {mode === "review" && !data.anonymous && <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); void mutate() }}>
        <label className="block text-sm">Observation type<select className="ml-3 rounded border p-2" value={kind} disabled={busy} onChange={e => setKind(e.target.value as "PRO" | "CON")}><option value="PRO">Pro</option><option value="CON">Con</option></select></label>
        <label className="block text-sm">{editing ? "Edit your observation" : "Add a reviewer observation"}<Textarea value={body} required maxLength={3000} disabled={busy} onChange={e => setBody(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Separate from application answers, private interview notes, and overall evaluation feedback.</p>
        <Button disabled={busy || !body.trim()}>{editing ? "Save observation" : "Add observation"}</Button>{editing && <Button type="button" variant="ghost" onClick={() => { setEditing(undefined); setBody("") }}>Cancel edit</Button>}
      </form>}
    </>}
  </section>;
}

export function ApplicantDisplaySettings({ clubId, roundId }: { clubId: string; roundId: string }) {
  const [value, setValue] = useState<{ config: ApplicantDisplayConfig; version: number } | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let current = true; setValue(null); setError(""); getApplicantDisplayConfiguration(clubId, roundId).then(v => { if (current) setValue(v) }).catch(() => { if (current) setError("Display settings unavailable.") }); return () => { current = false }; }, [clubId, roundId]);
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Applicant display · Interview and Voting</summary><p className="my-3 text-sm text-muted-foreground">Choose the shared fields for this round. Each reviewer receives only authorized fields; anonymous review still removes identity, observations, and free text.</p>
    {error && <p role="status" className="text-sm">{error}</p>}
    {value && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { setValue(await saveApplicantDisplayConfiguration({ clubId, roundId, ...value })); setError("Display configuration saved.") } catch(e) { setError(e instanceof Error ? e.message : "Save failed.") } finally { setBusy(false) } }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">{applicantFields.map(f => <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.config.fields.includes(f)} onChange={e => setValue({ ...value, config: { version: 1, fields: e.target.checked ? [...value.config.fields, f] : value.config.fields.filter(v => v !== f) } })} />{fieldLabels[f]}</label>)}</fieldset><Button className="mt-4" disabled={busy}>Save display configuration</Button></form>}
  </details>;
}
