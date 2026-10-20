"use client";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveStatus } from "@/components/ui/autosave-status";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { canDiscoverInterviewSetup, interviewSetupHref, type InterviewSetupRounds } from "@/lib/interview-setup";
import { interviewCapabilities } from "@/lib/interview-access";
import { useEffect, useRef, useState } from "react";
import {
  getInterviewKit,
  saveInterviewKit,
  getInterviewRounds,
} from "@/lib/workspace-api";
import type { KitQuestion } from "@/lib/interview-kits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListChecks, ChevronDown } from "@/components/icons";
import "@/components/clubs/interview-kit-editor.css";
export function InterviewKitEditor({
  clubId,
  rounds,
  initialRoundId,
}: {
  clubId: string;
  rounds: { id: string; name: string; canReadKit?: boolean }[];
  initialRoundId?: string;
}) {
  return <section className="oc-kit-editor" aria-label="Interview kit editor">
    <header className="oc-kit-heading"><h2>Interview master kit</h2><p className="text-sm text-muted-foreground">Configure questions and guidance for each round. Changes apply to new interviews; existing interviews retain their original kit.</p></header>
    <div className="oc-kit-sections">{rounds.map(round => <RoundKitEditor key={clubId + ':' + round.id} clubId={clubId} roundInfo={round} initiallyOpen={round.id === initialRoundId} />)}</div>
  </section>;
}

// A mounted editor owns each round's draft, version and independent save queue.
export function RoundKitEditor({ clubId, roundInfo, initiallyOpen = false }: {
  clubId: string; roundInfo: { id: string; name: string; canReadKit?: boolean }; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => { if (initiallyOpen) setOpen(true); }, [initiallyOpen]);
  const { user } = useAuth();
  const version = useRef(0);
  const canEdit = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).editKit;
  const round = roundInfo.id;
  const [questions, setQuestions] = useState<KitQuestion[]>([]),
        [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const canReadKit = roundInfo.canReadKit !== false;
  const canManageGrants = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).manageGrants;
  useEffect(() => {
    let current = true;
    setLoaded(false);
    setMessage("");
    if (!round || !canReadKit) return;
    getInterviewKit(clubId, round)
      .then((result) => {
        if (current) {
          setQuestions(result.questions);
          version.current = result.version;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (current) setMessage("Could not load the kit. Your access may have changed. Retry below.");
      });
    return () => {
      current = false;
    };
  }, [clubId, round, retry, canReadKit]);
  const autosave = useAutosave({
    identity: `${user?.id}:kit:${clubId}:${round}`,
    value: questions, restore: setQuestions, enabled: loaded && canEdit && canReadKit,
    save: async value => { const result = await saveInterviewKit(clubId, round, version.current, value); version.current = result.version; },
  });
  const dirty = autosave.dirty, busy = autosave.saving;
  function edit(value: KitQuestion[]) {
    setQuestions(value);
  }
  function move(index: number, direction: number) {
    const items = [...questions];
    [items[index], items[index + direction]] = [
      items[index + direction],
      items[index],
    ];
    edit(items);
  }
  return (
    <section className="oc-kit-round" data-autosave-editor="true" data-unsaved={dirty} data-saving={busy} aria-label={roundInfo.name}>
      <h3><button className="oc-kit-round-trigger" type="button" aria-expanded={open} aria-controls={'kit-panel-' + round} id={'kit-heading-' + round} onClick={() => setOpen(value => !value)}>
        <ChevronDown size={18} aria-hidden="true" className={open ? "oc-kit-chevron is-open" : "oc-kit-chevron"} />
        <span className="oc-kit-round-name">{roundInfo.name}</span>
        <span className="oc-kit-round-count">{!canReadKit ? "Restricted" : loaded ? questions.length + (questions.length === 1 ? ' question' : ' questions') : message ? "Could not load" : "Loading…"}</span>
        <span className="oc-kit-round-status" role="status">{autosave.error ? "Couldn’t save" : busy ? "Saving…" : autosave.recovery != null ? "Draft available" : dirty ? "Unsaved changes" : ""}</span>
      </button></h3>
      <div id={'kit-panel-' + round} role="region" aria-labelledby={'kit-heading-' + round} hidden={!open} className="oc-kit-builder" onBlur={event => {
        if (!event.relatedTarget?.closest('.oc-kit-round-trigger')) autosave.onBlur();
      }}>
          {!canReadKit ? <div role="alert" className="space-y-3"><p>This round is saved. Editing its kit requires an explicit President, Vice-president or Board grant. Assigned interviewers can browse its question bank.</p>{canManageGrants && <Link className="underline" href={interviewSetupHref(clubId, round, "access")}>Manage interview access</Link>}</div> : <>
          {!canEdit && <p className="mb-4 text-sm text-muted-foreground">Read-only question bank. Use questions in your assigned interview workspace.</p>}
          <h4 className="oc-kit-builder-label"><ListChecks size={19} aria-hidden="true" />Question builder</h4>
        <fieldset disabled={!loaded || !canEdit || autosave.recovery != null} className="space-y-5">
          {questions.map((q, i) => (
            <section key={q.id} className="oc-kit-question space-y-2">
              <label htmlFor={`prompt-${round}-${q.id}`}>Question {i + 1}</label>
              <Textarea
                id={`prompt-${round}-${q.id}`}
                value={q.prompt}
                maxLength={3000}
                onChange={(e) =>
                  edit(
                    questions.map((item) =>
                      item.id === q.id
                        ? { ...item, prompt: e.target.value }
                        : item,
                    ),
                  )
                }
              />
              <details className="oc-kit-guidance"><summary>Answer key / evaluation guidance{q.guidance?.trim() ? " · Added" : " · Optional"}</summary>
              <label className="sr-only" htmlFor={`guidance-${round}-${q.id}`}>Answer key / evaluation guidance</label>
              <Textarea
                id={`guidance-${round}-${q.id}`}
                value={q.guidance}
                maxLength={5000}
                onChange={(e) =>
                  edit(
                    questions.map((item) =>
                      item.id === q.id
                        ? { ...item, guidance: e.target.value }
                        : item,
                    ),
                  )
                }
              />
              </details>
              {canEdit && <div className="oc-kit-question-actions flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === questions.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Move down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    edit(questions.filter((item) => item.id !== q.id))
                  }
                >
                  Delete question
                </Button>
              </div>}
            </section>
          ))}
          {canEdit && <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={questions.length >= 50}
              onClick={() =>
                edit([
                  ...questions,
                  { id: crypto.randomUUID(), prompt: "", guidance: "" },
                ])
              }
            >
              Add question
            </Button>
          </div>}
        </fieldset>
        <AutosaveStatus save={autosave} />
        <p role="status">{message}</p>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            if (!dirty || window.confirm("Discard unsaved changes and reload?")) {
              await autosave.discardRecovery?.();
              setRetry((v) => v + 1);
            }
          }}
        >
          Reload kit
        </Button>
        </>}
      </div>
    </section>
  );
}
export function ClubInterviewKitSettings({ clubId, initialRoundId }: { clubId: string; initialRoundId?: string }) {
  const { user } = useAuth();
  const member = user?.memberships.find(m => m.clubId === clubId);
  const accessKey = JSON.stringify([user?.id, member?.id, member?.status, member?.isOwner, member?.permissions, member?.interviewOffices]);
  const [result, setResult] = useState<InterviewSetupRounds | null>(
      null,
    ),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setResult(null);
    setError(false);
    getInterviewRounds(clubId)
      .then((value) => {
        if (current) setResult(value);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [clubId, retry, accessKey]);
  if (error)
    return (
      <div role="alert">
        Could not load interview rounds.{" "}
        <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
          Retry
        </Button>
      </div>
    );
  if (!result) return <p role="status">Loading interview rounds…</p>;
  if (result.status === "denied") return <p role="alert">Interview setup access denied. Ask your club owner to check your current membership and permissions.</p>;
  const { rounds } = result;
  if (!rounds.length)
    return (
      <p>{member && canDiscoverInterviewSetup(member) ? "No active interview rounds. Configure an Interview or Group Interview round in Recruiting Pipeline." : "No assigned interview rounds. Ask your club owner to confirm your panel assignment."}</p>
    );
  if (initialRoundId && !rounds.some(r => r.id === initialRoundId)) return <p role="alert">The requested round is unavailable under your current access or is no longer an active interview round. Return to Interview Setup to choose an eligible round.</p>;
  return <InterviewKitEditor key={`${clubId}:${initialRoundId || ""}`} clubId={clubId} rounds={rounds} initialRoundId={initialRoundId} />;
}
