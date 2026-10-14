"use client";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { canDiscoverInterviewSetup, interviewSetupHref, type InterviewSetupRounds } from "@/lib/interview-setup";
import { interviewCapabilities } from "@/lib/interview-access";
import { useEffect, useState } from "react";
import {
  getInterviewKit,
  saveInterviewKit,
  getInterviewRounds,
} from "@/lib/workspace-api";
import type { KitQuestion } from "@/lib/interview-kits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListChecks, ChevronRight } from "lucide-react";
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
  const { user } = useAuth();
  const canEdit = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).editKit;
  const [round, setRound] = useState(rounds.find(r => r.id === initialRoundId)?.id || rounds[0]?.id || ""),
    [questions, setQuestions] = useState<KitQuestion[]>([]),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const canReadKit = rounds.find(r => r.id === round)?.canReadKit !== false;
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
          setVersion(result.version);
          setLoaded(true);
          setDirty(false);
        }
      })
      .catch(() => {
        if (current) setMessage("Could not load the kit. Your access may have changed. Retry below.");
      });
    return () => {
      current = false;
    };
  }, [clubId, round, retry, canReadKit]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(value: KitQuestion[]) {
    setQuestions(value);
    setDirty(true);
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
    <section className="oc-kit-editor" data-unsaved={dirty} data-saving={busy} aria-label="Interview kit editor">
      <header className="oc-kit-heading"><h2>Interview master kit</h2>
      <div>
        <p className="text-sm text-muted-foreground">
          Configure questions and guidance for each round. Changes apply to new
          interviews; existing interviews retain their original kit.
        </p>
      </div></header>
      <div className="oc-kit-layout">
        <nav className="oc-kit-rounds" aria-label="Interview kit rounds"><h3>Rounds</h3>
          {rounds.map((r, index) => <button key={r.id} type="button" aria-current={r.id === round ? "true" : undefined} disabled={busy} onClick={() => {
            if (r.id !== round && (!dirty || window.confirm("Discard unsaved kit changes?"))) {
              setRound(r.id);
              if (window.location && window.history) {
                const url = new URL(window.location.href); url.searchParams.set("roundId", r.id);
                window.history.replaceState(null, "", url.pathname + url.search);
              }
            }
          }}><span>{index + 1}</span><strong>{r.name}</strong><ChevronRight size={17} aria-hidden="true" /></button>)}
        </nav>
        <div className="oc-kit-builder">
          <header><div><p>Selected round</p><h3>{rounds.find(r => r.id === round)?.name || "Choose a round"}</h3></div>{canReadKit && <span>{loaded ? `${questions.length} questions` : "Loading…"}</span>}</header>
          {!canReadKit ? <div role="alert" className="space-y-3"><p>This round is saved. Editing its kit requires an explicit President, Vice-president or Board grant. Assigned interviewers can browse its question bank.</p>{canManageGrants && <Link className="underline" href={interviewSetupHref(clubId, round, "access")}>Manage interview access</Link>}</div> : <>
          <p className="mb-4 text-sm text-muted-foreground">{canEdit ? "You can edit the selected round master kit." : "Read-only question bank. Use questions in your assigned interview workspace."}</p>
          <h4 className="oc-kit-builder-label"><ListChecks size={19} aria-hidden="true" />Question builder</h4>
        <fieldset disabled={busy || !loaded || !canEdit} className="space-y-5">
          {questions.map((q, i) => (
            <section key={q.id} className="oc-kit-question space-y-2">
              <label htmlFor={`prompt-${q.id}`}>Question {i + 1}</label>
              <Textarea
                id={`prompt-${q.id}`}
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
              <label className="sr-only" htmlFor={`guidance-${q.id}`}>Answer key / evaluation guidance</label>
              <Textarea
                id={`guidance-${q.id}`}
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
            <Button
              type="button"
              disabled={!dirty}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  const result = await saveInterviewKit(
                    clubId,
                    round,
                    version,
                    questions,
                  );
                  setVersion(result.version);
                  setDirty(false);
                  setMessage("Kit saved.");
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Could not save.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save kit
            </Button>
          </div>}
        </fieldset>
        <p role="status">{message}</p>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes and reload?"))
              setRetry((v) => v + 1);
          }}
        >
          Reload kit
        </Button>
        </>}
        </div>
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
