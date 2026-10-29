"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { editorValue } from "@/lib/editor-value"
import { AutosaveStatus } from "@/components/ui/autosave-status"

import { ActionWorkflow } from "@/components/product/action-workflow";
import { NativeSelect } from "@/components/ui/native-select"
import { getPipelineSettings, savePipelineSettings, getPipelineInterviewStatus } from "@/lib/workspace-api";
import { PipelineInterviewStatus } from "@/components/interviews/pipeline-interview-status";
import { INTERVIEW_ROUNDS_CHANGED, type InterviewSetupStatus } from "@/lib/interview-round-workflow";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "@/components/icons";
import {
  pipelineSettingsSchema,
  roundConfigurationSchema,
  roundTypes,
  roundTypeLabels,
  type RoundDraft,
} from "@/lib/club-settings";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { hasPermission } from "@/lib/permissions";
import "@/components/clubs/club-settings.css";
export function InterviewPipelineBuilderView({
  clubId: provided,
  onSaved,
}: {
  clubId?: string;
  onSaved?: () => void;
}) {
  const { activeClubId, user } = useAuth(),
    demo = useDemoMode(),
    clubId = provided || activeClubId;
  const [rounds, setRounds] = useState<RoundDraft[]>([]),
    [archived, setArchived] = useState<string[]>([]),
    [version, setVersion] = useState(0),
    [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0);
  const [savedRounds, setSavedRounds] = useState<
      { id: string; name: string; anonymousReview: boolean }[]
    >([]),
    working = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false), [editing, setEditing] = useState<RoundDraft | null>(null);
  const [setup, setSetup] = useState<InterviewSetupStatus[]>([]), [setupError, setSetupError] = useState(false), [setupRetry, setSetupRetry] = useState(0);
  useEffect(() => { if (!demo.ready || !clubId) return; let active = true; setSetupError(false); setSetup([]); getPipelineInterviewStatus(clubId).then(value => { if (active) setSetup(value); }).catch(() => { if (active) setSetupError(true); }); return () => { active = false; }; }, [clubId, demo.ready, demo.isDemoEnabled, retry, setupRetry]);
  const snapshot = editorValue(rounds),
    dirty = loaded && snapshot !== baseline;
  useEffect(() => {
    if (!demo.ready || !clubId) return;
    let current = true;
    setLoaded(false);
    setError("");
    getPipelineSettings(clubId)
      .then((data) => {
        if (!current) return;
        const items = data.pipelineRounds
          .filter((r) => !r.archivedAt)
          .map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type as RoundDraft["type"],
            configuration: roundConfigurationSchema.parse(r.configuration),
          }));
        setRounds(items);
        setBaseline(editorValue(items));
        setVersion(data.pipelineVersion);
        setSavedRounds(data.pipelineRounds.filter((r) => !r.archivedAt));
        setArchived(
          data.pipelineRounds.filter((r) => r.archivedAt).map((r) => r.name),
        );
        setLoaded(true);
      })
      .catch(() => {
        if (current)
          setError(
            "Could not load recruiting rounds. Check your access and retry.",
          );
      });
    return () => {
      current = false;
    };
  }, [clubId, demo.ready, demo.isDemoEnabled, retry]);
  const draftSave = useEditorDraft({ scope: { kind: "pipeline", clubId }, value: rounds, restore: setRounds, enabled: loaded && !!clubId, base: baseline });
  function move(index: number, direction: number) {
    setRounds((items) => {
      const next = [...items];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function save(proposed = rounds) {
    if (working.current) return;
    const input = { clubId, version, rounds: proposed },
      parsed = pipelineSettingsSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await draftSave.flush();
      await savePipelineSettings(input);
      await draftSave.clear();
      setRounds(proposed);
      setBaseline(editorValue(proposed));
      setNotice("Recruiting pipeline saved.");
      setRetry((n) => n + 1);
      window.dispatchEvent(new Event(INTERVIEW_ROUNDS_CHANGED));
      onSaved?.();
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your edits are still here.",
      );
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (!clubId)
    return (
      <p className="text-sm text-muted-foreground">
        Open a club workspace with recruiting-management access to configure its
        rounds.
      </p>
    );
  return <div className="oc-settings-editor space-y-6" data-autosave-editor="true" onBlur={draftSave.onBlur} data-unsaved={draftSave.dirty} data-saving={busy || draftSave.saving}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="oc-section-heading">Interview rounds</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Build your recruitment pipeline, then prepare each round’s questions, availability, and schedule.</p></div>
      <Button disabled={!loaded || busy || dirty || rounds.length >= 50} onClick={() => { setEditing(null); setEditorOpen(true) }}><Plus size={16} />New round</Button>
    </header>
    <AutosaveStatus save={draftSave} />
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved pipeline changes and reload?")) setRetry(n => n + 1) }}>Reload pipeline</Button></div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {setupError && <p role="alert">Could not check interview setup. <Button variant="ghost" onClick={() => setSetupRetry(n => n + 1)}>Retry setup status</Button></p>}
    {!loaded ? !error && <LoadingState label="Loading interview rounds…" layout="rows" rows={3} /> : <>
      <ol className="divide-y border-y">{rounds.map((round, index) => <li key={round.id} className="space-y-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Round {index + 1} · {roundTypeLabels[round.type]}</p><h3 className="mt-1 font-medium">{round.name}</h3>{["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type) && <p className="mt-1 text-xs text-muted-foreground">{round.configuration.duration} minute interviews</p>}</div>
          <div className="flex flex-wrap gap-1"><Button variant="outline" disabled={busy || dirty} onClick={() => { setEditing(round); setEditorOpen(true) }}>Manage round<span className="sr-only"> {round.name}</span></Button><Button size="icon" variant="ghost" aria-label={`Move ${round.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></Button><Button size="icon" variant="ghost" aria-label={`Move ${round.name} down`} disabled={busy || index === rounds.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></Button><Button size="icon" variant="ghost" aria-label={`Remove ${round.name}`} disabled={busy || rounds.length === 1} onClick={() => { if (window.confirm(`Remove ${round.name}? Active applicants and dependent rooms or voting sessions must be moved first. Historical records are retained.`)) setRounds(items => items.filter(item => item.id !== round.id)) }}><Trash2 size={16}/></Button></div>
        </div>
        {round.configuration.instructions && <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{round.configuration.instructions}</p>}
        {["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type) && <PipelineInterviewStatus clubId={clubId} roundId={round.id} status={setup.find(item => item.roundId === round.id)} disabled={dirty || busy} />}
      </li>)}</ol>
      {dirty && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-4"><p className="text-sm">Review your round order and removals before saving.</p><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save pipeline"}</Button></div>}
      <ActionWorkflow title={editing ? "Manage round" : "New interview round"} description="Set the round details and review before saving. Questions, availability, rooms, and scheduling can be completed afterward." open={editorOpen} onOpenChange={setEditorOpen}>
        {editorOpen && <RoundComposer key={editing?.id ?? "new"} clubId={clubId} source={editing} busy={busy} error={error} onSave={async round => { const saved = await save(editing ? rounds.map(item => item.id === editing.id ? round : item) : [...rounds, round]); if (saved) setEditorOpen(false); return !!saved }} />}
      </ActionWorkflow>
      <ActionWorkflow title="Round privacy & profile requirements" description="Configure review privacy and required applicant profile fields for saved rounds." trigger="Privacy & profile requirements" presentation="sheet" disabled={dirty || busy}><RecruitmentReviewSettings clubId={clubId} rounds={savedRounds} canIdentify={hasPermission(user?.memberships.find(member => member.clubId === clubId), "applicants.identify")} embedded onChanged={() => { setRetry(n => n + 1); onSaved?.() }} /></ActionWorkflow>
      {!!archived.length && <p className="text-xs text-muted-foreground">Archived rounds (history retained): {archived.join(", ")}</p>}
    </>}
  </div>;
}

function RoundComposer({ clubId, source, busy, error, onSave }: { clubId: string; source: RoundDraft | null; busy: boolean; error: string; onSave: (round: RoundDraft) => Promise<boolean> }) {
  const [round, setRound] = useState<RoundDraft>(() => source ?? { id: crypto.randomUUID(), name: "", type: "INTERVIEW", configuration: { instructions: "", duration: 30 } });
  const [stage, setStage] = useState("details"), [validation, setValidation] = useState("");
  const draft = useEditorDraft({ scope: { kind: "pipeline", clubId, resourceId: source?.id ?? "new-round" }, value: round, restore: setRound, base: source ? JSON.stringify(source) : "new" });
  const interview = ["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type);
  return <form data-autosave-editor="true" data-unsaved={draft.dirty} data-saving={busy} onBlur={draft.onBlur} className="space-y-5" onSubmit={async event => { event.preventDefault(); setValidation(""); const parsed = pipelineSettingsSchema.innerType().shape.rounds.element.safeParse(round); if (!parsed.success) { setValidation(parsed.error.issues[0].message); return } if (stage === "details") { setStage("review"); return } try { await draft.flush(); if (await onSave(round)) await draft.clear() } catch { setValidation("Could not save the round draft. Please retry.") } }}>
    <div className="flex gap-3 text-sm" aria-label="Round setup progress"><span aria-current={stage === "details" ? "step" : undefined}>1. Round details</span><span aria-current={stage === "review" ? "step" : undefined}>2. Review & save</span></div>
    <AutosaveStatus save={draft}/>
    <fieldset disabled={busy || !draft.ready || draft.recovery != null} className="space-y-4">
      {stage === "details" ? <>
        <label className="block space-y-2 text-sm">Round name<Input required maxLength={100} value={round.name} onChange={event => setRound(value => ({ ...value, name: event.target.value }))} /></label>
        <label className="block space-y-2 text-sm">Round type<NativeSelect className="oc-settings-select" value={round.type} onChange={event => setRound(value => ({ ...value, type: event.target.value as RoundDraft["type"] }))}>{roundTypes.map(type => <option key={type} value={type}>{roundTypeLabels[type]}</option>)}</NativeSelect></label>
        <label className="block space-y-2 text-sm">Round instructions<Textarea maxLength={5000} rows={3} value={round.configuration.instructions} onChange={event => setRound(value => ({ ...value, configuration: { ...value.configuration, instructions: event.target.value } }))}/></label>
        {interview && <label className="block space-y-2 text-sm">Default interview duration (minutes)<Input type="number" min={5} max={180} required value={round.configuration.duration} onChange={event => setRound(value => ({ ...value, configuration: { ...value.configuration, duration: Number(event.target.value) } }))}/></label>}
      </> : <section className="space-y-4 rounded-lg bg-muted/40 p-4"><h3 className="font-medium">{round.name}</h3><p className="text-sm">{roundTypeLabels[round.type]}{interview ? ` · ${round.configuration.duration} minutes` : ""}</p><p className="whitespace-pre-wrap text-sm">{round.configuration.instructions || "No additional instructions."}</p>{interview && <div className="space-y-2 text-sm"><h4 className="font-medium">Next steps · complete when ready</h4><ol className="list-decimal space-y-1 pl-5"><li>Manage questions and the interview kit</li><li>Collect interviewer availability</li><li>Configure rooms and panels</li><li>Preview assignments and finalize scheduling</li></ol><p className="text-xs text-muted-foreground">Saving this round does not open bookings or publish a schedule.</p></div>}</section>}
      {(validation || error) && <p role="alert" className="text-sm text-destructive">{validation || error}</p>}
      <div className="flex justify-end gap-2">{stage === "review" && <Button type="button" variant="outline" onClick={() => setStage("details")}>Back</Button>}<Button>{busy ? "Saving…" : stage === "details" ? "Review round" : source ? "Save changes" : "Create round"}</Button></div>
    </fieldset>
  </form>;
}
