"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  openInterviewSession,
  saveInterviewSession,
} from "@/lib/workspace-api";
import {
  emptyInterviewDraft,
  type InterviewDraft,
  type InterviewSessionData,
} from "@/lib/interview-kits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
export function InterviewKitSession({
  clubId,
  applicationId,
  roundId,
  formRef,
  onState,
  onComplete,
}: {
  clubId: string;
  applicationId: string;
  roundId: string;
  formRef: RefObject<HTMLFormElement | null>;
  onState: (dirty: boolean, busy: boolean) => void;
  onComplete: (
    evaluation: NonNullable<
      Awaited<ReturnType<typeof saveInterviewSession>>["evaluation"]
    >,
    next: boolean,
  ) => void;
}) {
  const [session, setSession] = useState<InterviewSessionData | null>(null),
    [draft, setDraft] = useState<InterviewDraft>(
      structuredClone(emptyInterviewDraft),
    ),
    [saved, setSaved] = useState(""),
    [saving, setSaving] = useState(false),
    [completing, setCompleting] = useState(false),
    [error, setError] = useState(""),
    [newQuestion, setNewQuestion] = useState(""),
    [retry, setRetry] = useState(0);
  const savingRef = useRef(false),
    mounted = useRef(true),
    sessionRef = useRef<InterviewSessionData | null>(null);
  const serialized = JSON.stringify(draft),
    dirty = !!session && !session.completedAt && serialized !== saved;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    openInterviewSession({ clubId, applicationId, roundId })
      .then((record) => {
        if (current) {
          sessionRef.current = record;
          setSession(record);
          setDraft(record.draft);
          setSaved(JSON.stringify(record.draft));
          setError("");
        }
      })
      .catch((e) => {
        if (current)
          setError(
            e instanceof Error ? e.message : "Could not open interview.",
          );
      });
    return () => {
      current = false;
    };
  }, [clubId, applicationId, roundId, retry]);
  useEffect(() => {
    onState(dirty || !!newQuestion.trim(), saving);
    return () => onState(false, false);
  }, [dirty, saving, newQuestion, onState]);
  async function persist(complete = false, next = false) {
    const record = sessionRef.current;
    if (!record || savingRef.current || record.completedAt) return;
    if (complete && newQuestion.trim()) {
      setError("Add or clear the additional question before completing.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setCompleting(complete);
    setError("");
    const snapshot = structuredClone(draft);
    try {
      const result = await saveInterviewSession({
        clubId,
        applicationId,
        roundId,
        revision: record.revision,
        draft: snapshot,
        complete,
      });
      sessionRef.current = result.session;
      if (mounted.current) {
        setSession(result.session);
        setSaved(JSON.stringify(snapshot));
        if (complete && result.evaluation) onComplete(result.evaluation, next);
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Save failed. Your text is still here; retry before leaving.",
        );
    } finally {
      savingRef.current = false;
      if (mounted.current) {
        setSaving(false);
        setCompleting(false);
      }
    }
  }
  useEffect(() => {
    if (!dirty || !session || session.completedAt) return;
    const timer = setTimeout(() => {
      if (!savingRef.current) void persist();
    }, 800);
    return () => clearTimeout(timer);
  }, [serialized, saved, session?.id]);
  if (!session)
    return (
      <div className="space-y-3" role="status">
        {error || "Loading interview kit…"}
        {error && (
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            Retry
          </Button>
        )}
      </div>
    );
  function note(questionId: string, notes: string) {
    setDraft((d) => ({
      ...d,
      questionNotes: [
        ...d.questionNotes.filter((n) => n.questionId !== questionId),
        { questionId, notes },
      ],
    }));
  }
  return (
    <form
      ref={formRef}
      className="min-w-0 space-y-6 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        void persist(true);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Interview kit</h2>
        <span role="status" className="text-xs text-muted-foreground">
          {session.completedAt
            ? "Completed interview"
            : saving
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : "Draft saved"}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <fieldset
        disabled={!!session.completedAt || completing}
        className="space-y-6"
      >
        {!session.questions.length && (
          <p className="text-sm text-muted-foreground">
            No configured questions. Add questions below or record an overall
            review.
          </p>
        )}
        {session.questions.map((q, i) => (
          <section className="space-y-3" key={q.id}>
            <h3 className="font-medium">
              {i + 1}. {q.prompt}
            </h3>
            {q.guidance && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {q.guidance}
              </p>
            )}
            <label className="text-sm" htmlFor={`notes-${q.id}`}>
              Question notes
            </label>
            <Textarea
              id={`notes-${q.id}`}
              rows={4}
              maxLength={10000}
              value={
                draft.questionNotes.find((n) => n.questionId === q.id)?.notes ||
                ""
              }
              onChange={(e) => note(q.id, e.target.value)}
            />
          </section>
        ))}
        <section className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Additional Questions</h3>
          {draft.additionalQuestions.map((q) => (
            <div key={q.id} className="space-y-2">
              <p className="font-medium">{q.question}</p>
              <label htmlFor={`extra-${q.id}`} className="text-sm">
                Question notes
              </label>
              <Textarea
                id={`extra-${q.id}`}
                maxLength={10000}
                value={q.notes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    additionalQuestions: d.additionalQuestions.map((item) =>
                      item.id === q.id
                        ? { ...item, notes: e.target.value }
                        : item,
                    ),
                  }))
                }
              />
            </div>
          ))}
          {!draft.additionalQuestions.length && (
            <p className="text-sm text-muted-foreground">
              No off-script questions added.
            </p>
          )}
          {!session.completedAt && (
            <div className="space-y-2">
              <label htmlFor="new-interview-question">
                Ask an off-script question
              </label>
              <Input
                id="new-interview-question"
                maxLength={3000}
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  !newQuestion.trim() || draft.additionalQuestions.length >= 30
                }
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    additionalQuestions: [
                      ...d.additionalQuestions,
                      {
                        id: crypto.randomUUID(),
                        question: newQuestion.trim(),
                        notes: "",
                      },
                    ],
                  }));
                  setNewQuestion("");
                }}
              >
                Add question
              </Button>
            </div>
          )}
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">Closing review</h3>
          <details>
            <summary className="cursor-pointer text-sm">
              Additional Questions summary ({draft.additionalQuestions.length})
            </summary>
            {draft.additionalQuestions.map((q) => (
              <div key={q.id} className="py-2">
                <p className="font-medium">{q.question}</p>
                <p className="whitespace-pre-wrap text-sm">
                  {q.notes || "No notes recorded."}
                </p>
              </div>
            ))}
          </details>
          <label htmlFor="overall-interview-review">Overall Review</label>
          <Textarea
            id="overall-interview-review"
            rows={5}
            maxLength={20000}
            value={draft.overallReview}
            onChange={(e) =>
              setDraft((d) => ({ ...d, overallReview: e.target.value }))
            }
          />
          <label htmlFor="interview-score">Overall score · 1–10</label>
          <Input
            id="interview-score"
            type="number"
            min={1}
            max={10}
            step="any"
            className="w-28"
            value={draft.score ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                score: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Question guidance supports the existing overall 1–10 score.
            Question-specific notes stay separate from the overall evaluation.
          </p>
        </section>
      </fieldset>
      {!session.completedAt && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving || !dirty}
            onClick={() => void persist()}
          >
            Save draft
          </Button>
          <Button type="submit" disabled={saving || draft.score === null}>
            Complete interview
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || draft.score === null}
            onClick={() => void persist(true, true)}
          >
            Complete & next
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Drafts autosave after a brief pause. Wait for “Draft saved” before
        leaving. ⌘ / Ctrl + Enter completes the interview. Completion does not
        change the candidate’s round or decision.
      </p>
    </form>
  );
}
