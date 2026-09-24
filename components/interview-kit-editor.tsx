"use client";
import { useEffect, useState } from "react";
import {
  getInterviewKit,
  saveInterviewKit,
  getInterviewRounds,
} from "@/lib/workspace-api";
import type { KitQuestion } from "@/lib/interview-kits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function InterviewKitEditor({
  clubId,
  rounds,
}: {
  clubId: string;
  rounds: { id: string; name: string }[];
}) {
  const [round, setRound] = useState(rounds[0]?.id || ""),
    [questions, setQuestions] = useState<KitQuestion[]>([]),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoaded(false);
    setMessage("");
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
        if (current) setMessage("Could not load the kit. Reload to try again.");
      });
    return () => {
      current = false;
    };
  }, [clubId, round, retry]);
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
    <details className="border-y py-4">
      <summary className="cursor-pointer font-medium">Interview kits</summary>
      <div className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Configure questions and guidance for each round. Changes apply to new
          interviews; existing interviews retain their original kit.
        </p>
        <label>
          Recruitment round{" "}
          <select
            className="ml-3 rounded border p-2"
            value={round}
            disabled={busy}
            onChange={(e) => {
              if (!dirty || window.confirm("Discard unsaved kit changes?"))
                setRound(e.target.value);
            }}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset disabled={busy || !loaded} className="space-y-5">
          {questions.map((q, i) => (
            <section key={q.id} className="space-y-2 border-b pb-4">
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
              <label htmlFor={`guidance-${q.id}`}>
                Optional guidance / rubric
              </label>
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
              <div className="flex flex-wrap gap-2">
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
              </div>
            </section>
          ))}
          <div className="flex gap-3">
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
          </div>
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
      </div>
    </details>
  );
}
export function ClubInterviewKitSettings({ clubId }: { clubId: string }) {
  const [rounds, setRounds] = useState<{ id: string; name: string }[] | null>(
      null,
    ),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setRounds(null);
    setError(false);
    getInterviewRounds(clubId)
      .then((value) => {
        if (current) setRounds(value);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [clubId, retry]);
  if (error)
    return (
      <div role="alert">
        Could not load interview rounds.{" "}
        <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
          Retry
        </Button>
      </div>
    );
  if (!rounds) return <p role="status">Loading interview rounds…</p>;
  if (!rounds.length)
    return (
      <p>Create a recruitment round before configuring an interview kit.</p>
    );
  return <InterviewKitEditor key={clubId} clubId={clubId} rounds={rounds} />;
}
