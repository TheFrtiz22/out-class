"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  getInterviewKit,
  openInterviewSession,
  saveInterviewSession,
  getPreviousInterviewScores,
} from "@/lib/workspace-api";
import {
  emptyInterviewDraft,
  type InterviewDraft,
  type InterviewSessionData,
} from "@/lib/interview-kits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
export function InterviewKitSession({
  clubId,
  applicationId,
  roundId,
  formRef,
  onState,
  onComplete,
  context,
  toolbar,
}: {
  context?: ReactNode;
  toolbar?: (completed: boolean) => ReactNode;
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
  const [activeQuestion, setActiveQuestion] = useState("");
  const activeHeading = useRef<HTMLHeadingElement>(null);
  const bankControl = useRef<HTMLButtonElement>(null);
  const [closingQuestion, setClosingQuestion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getPreviousInterviewScores>> | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyRetry, setHistoryRetry] = useState(0);
  const [closing, setClosing] = useState(false);
  const [failedFinish, setFailedFinish] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState<InterviewSessionData["questions"]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryRetry, setLibraryRetry] = useState(0);
  useEffect(() => {
    if (!libraryOpen) return;
    let current = true;
    setLibraryError("");
    setLibraryLoading(true);
    getInterviewKit(clubId, roundId).then(result => { if (current) setLibrary(result.questions) }).catch(() => { if (current) setLibraryError("Current kit unavailable. Your session snapshot is still available.") }).finally(() => { if (current) setLibraryLoading(false); });
    return () => { current = false };
  }, [clubId, roundId, libraryOpen, libraryRetry]);
  useEffect(() => { if (activeQuestion) activeHeading.current?.focus({ preventScroll: false }); }, [activeQuestion]);
  useEffect(() => {
    if (!closing || session?.completedAt) return;
    let current = true; setHistory(null); setHistoryError("");
    getPreviousInterviewScores({ clubId, applicationId, roundId }).then(value => { if (current) setHistory(value); }).catch(() => { if (current) setHistoryError("Score history unavailable."); });
    return () => { current = false; };
  }, [closing, session?.completedAt, clubId, applicationId, roundId, historyRetry]);
  const closingHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (closing) { closingHeading.current?.scrollIntoView({ block: "center" }); closingHeading.current?.focus({ preventScroll: true }) } }, [closing]);
  const savingRef = useRef(false),
    mounted = useRef(true),
    sessionRef = useRef<InterviewSessionData | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
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
  async function persist(complete = false, next = false, override?: InterviewDraft) {
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
    setFailedFinish(false);
    const snapshot = structuredClone(override || draftRef.current);
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
        if (override) setDraft(snapshot);
        if (complete && result.evaluation) { setClosing(false); onComplete(result.evaluation, next); }
      }
      return true;
    } catch {
      if (mounted.current) setFailedFinish(complete);
      if (mounted.current)
        setError("Your interview could not be saved. Retry, or refresh your access and revision.");
      return false;
    } finally {
      savingRef.current = false;
      if (mounted.current) {
        setSaving(false);
        setCompleting(false);
      }
    }
  }
  useEffect(() => {
    if (!dirty || !session || session.completedAt || error) return;
    const timer = setTimeout(() => {
      if (!savingRef.current) void persist();
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, saved, session?.id, saving, error]);
  if (!session)
    return (
      <div className="space-y-3" role="status">
        {error || "Loading your interview?"}
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
  const questions = [
    ...session.questions.map(q => ({ id: q.id, prompt: q.prompt, guidance: q.guidance, extra: false })),
    ...draft.additionalQuestions.map(q => ({ id: q.id, prompt: q.question, guidance: "", extra: true })),
  ];
  const active = questions.find(q => q.id === activeQuestion);
  const completedIds = session.draft.completedQuestionIds || [];
  const completed = questions.filter(q => completedIds.includes(q.id));
  const available = questions.filter(q => !completedIds.includes(q.id));
  const disabled = !!session.completedAt || completing || closingQuestion;
  const libraryQuestions = library.filter(q => `${q.prompt} ${q.guidance}`.toLowerCase().includes(search.toLowerCase()));
  function addQuestion(prompt: string, bankId?: string) {
    if (disabled || draft.additionalQuestions.length >= 30 || !prompt.trim()) return;
    const id = bankId || crypto.randomUUID();
    if (questions.some(q => q.id === id)) { setActiveQuestion(id); return; }
    setDraft(d => ({ ...d, additionalQuestions: [...d.additionalQuestions, { id, question: prompt.trim(), notes: "" }] }));
    setActiveQuestion(id);
  }
  async function closeQuestion() {
    if (!active || disabled || savingRef.current) return;
    setClosingQuestion(true);
    const snapshot = { ...draft, completedQuestionIds: [...new Set([...(draft.completedQuestionIds || []), active.id])] };
    const ok = await persist(false, false, snapshot);
    if (mounted.current) {
      setClosingQuestion(false);
      if (ok) { setActiveQuestion(""); setAnnouncement("Question saved and moved to your completed questions."); bankControl.current?.focus(); }
    }
  }
  async function refreshRevision() {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const fresh = await openInterviewSession({ clubId, applicationId, roundId });
      if (fresh.completedAt) { sessionRef.current = fresh; setSession(fresh); setFailedFinish(false); setError("Submitted elsewhere. Your unsaved text remains visible but cannot be submitted again. Reopen the interview to read the saved review."); return; }
      sessionRef.current = fresh; setSession(fresh);
      setDraft(local => ({ ...local, completedQuestionIds: [...new Set([...(fresh.draft.completedQuestionIds || []), ...(local.completedQuestionIds || [])])], additionalQuestions: [...fresh.draft.additionalQuestions.filter(q => !local.additionalQuestions.some(l => l.id === q.id)), ...local.additionalQuestions] }));
      setError("Revision refreshed. Review your retained text, then choose Retry save.");
    } catch { setError("Could not refresh access and revision. Your text remains here."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <form ref={formRef} id="interview-evaluation" className="oc-focused-interview min-w-0" data-unsaved={dirty || !!newQuestion.trim()} data-saving={saving} onSubmit={e => { e.preventDefault(); if (!session.completedAt) setClosing(true); }}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-5 py-4 sm:px-8">
      {toolbar?.(!!session.completedAt)}
      {session.instructions && <p className="w-full whitespace-pre-wrap text-sm text-muted-foreground">{session.instructions}</p>}
      <div className="flex flex-wrap items-center gap-3"><span role="status" aria-live="polite" className="text-xs text-muted-foreground">{session.completedAt ? "Submitted · Read only" : error ? "Save needs attention" : saving ? "Saving…" : dirty || newQuestion.trim() ? "Unsaved changes" : "Draft saved"}</span>{!session.completedAt && <Button type="button" disabled={saving} onClick={() => setClosing(true)}>End interview</Button>}</div>
    </header>
    {error && <div role="alert" className="space-y-2 border-b px-5 py-3 text-sm text-destructive">{error} Your text remains here.<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving || !!session.completedAt} onClick={() => void persist(failedFinish)}>{failedFinish ? "Retry save and finish" : "Retry save"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => void refreshRevision()}>Refresh revision, keep my text</Button></div></div>}
    <p role="status" aria-live="polite" className={announcement ? "px-5 py-2 text-sm text-primary" : "sr-only"}>{announcement}</p>
    <div className="oc-interview-columns grid items-start">
      {context}
      <div className="oc-question-workspace min-w-0 space-y-6 px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Your questions</h2><Button ref={bankControl} type="button" variant="outline" aria-expanded={libraryOpen} aria-controls="interview-bank" onClick={() => setLibraryOpen(v => !v)}>Question bank</Button></div>
        <a href="#interview-completed" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 lg:hidden">Your completed questions · {completed.length}</a>
        {libraryOpen && <section id="interview-bank" aria-label="Round question bank" className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium">Round question bank</h3><p className="text-xs text-muted-foreground">Browse the current kit. Existing interview questions keep their original wording.</p>
          <Input aria-label="Search question bank" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} />
          {libraryLoading && <p role="status">Loading question bank…</p>}
          {libraryError && <p role="alert">{libraryError} <Button type="button" variant="ghost" onClick={() => setLibraryRetry(v => v + 1)}>Retry bank</Button></p>}
          <ul className="space-y-3">{libraryQuestions.map(q => { const existing = questions.find(item => item.id === q.id); return <li key={q.id} className="space-y-2 border-t pt-3"><p className="break-words text-sm font-medium">{q.prompt}</p>{q.guidance && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{q.guidance}</p>}<Button type="button" size="sm" variant="outline" disabled={!existing && (disabled || draft.additionalQuestions.length >= 30)} onClick={() => existing ? setActiveQuestion(existing.id) : addQuestion(q.prompt, q.id)}>{existing ? "Open saved question" : "Use question"}</Button></li>; })}</ul>
          {!libraryLoading && !libraryQuestions.length && <p className="text-sm text-muted-foreground">No matching questions in this bank.</p>}
        </section>}
        <section className="oc-question-agenda space-y-3" aria-label="Available questions"><h3 className="text-sm font-medium">Available questions · {available.length}</h3><ul className="space-y-2">{available.map(q => <li key={q.id}><button type="button" aria-current={q.id === activeQuestion ? "step" : undefined} onClick={() => setActiveQuestion(q.id)} className="min-h-11 w-full rounded-md px-3 py-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><span className="break-words">{q.prompt}</span>{q.extra && <span className="block text-xs text-muted-foreground">Off-script</span>}</button></li>)}</ul>{!available.length && <p className="text-sm text-muted-foreground">No available questions. Browse the bank, add an off-script question, or reopen a completed question.</p>}</section>
        {active ? <section className="oc-active-question space-y-4" aria-label="Active question">
          <h2 ref={activeHeading} tabIndex={-1} className="oc-section-heading break-words">{active.prompt}</h2>
          {completedIds.includes(active.id) && <p className="text-xs text-primary">Completed by you{session.completedAt ? " · Read only" : " · Notes can still be revised"}</p>}
          {active.guidance && <p className="whitespace-pre-wrap border-l-2 border-brand-orange pl-4 text-sm leading-7 text-muted-foreground">{active.guidance}</p>}
          <label htmlFor={`active-notes-${active.id}`} className="block text-sm font-medium">Your private question notes</label>
          <Textarea id={`active-notes-${active.id}`} disabled={disabled} rows={8} maxLength={10000} value={active.extra ? draft.additionalQuestions.find(q => q.id === active.id)?.notes || "" : draft.questionNotes.find(q => q.questionId === active.id)?.notes || ""} onChange={e => active.extra ? setDraft(d => ({ ...d, additionalQuestions: d.additionalQuestions.map(q => q.id === active.id ? { ...q, notes: e.target.value } : q) })) : note(active.id, e.target.value)} />
          <p className="text-xs text-muted-foreground">Only your interview session stores these notes. Typing does not mark a question complete.</p>
          {!session.completedAt && <Button type="button" disabled={saving || closingQuestion} onClick={() => void closeQuestion()}>{closingQuestion ? "Saving question…" : "Save and close"}</Button>}
        </section> : <p className="text-sm text-muted-foreground">Choose a question to open it here and write your private notes.</p>}
        {!session.completedAt && <fieldset disabled={completing || closingQuestion} className="space-y-3 border-t pt-4"><label htmlFor="new-interview-question" className="text-sm font-medium">Add an off-script question</label><Input id="new-interview-question" maxLength={3000} value={newQuestion} onChange={e => setNewQuestion(e.target.value)} /><Button type="button" variant="outline" disabled={!newQuestion.trim() || draft.additionalQuestions.length >= 30} onClick={() => { addQuestion(newQuestion); setNewQuestion(""); }}>Add question</Button></fieldset>}
        {(closing || session.completedAt) && <section aria-label="Closing review" className="space-y-4 border-t pt-5">
          <h2 ref={closingHeading} tabIndex={-1} className="oc-section-heading">{session.completedAt ? "Submitted review" : "Closing review"}</h2><p className="text-sm text-muted-foreground">{session.completedAt ? "Your submitted review is read only." : "Discuss your thoughts, then choose your own score. Opening this review does not submit it."}</p>
          <fieldset disabled={disabled} className="space-y-3"><label htmlFor="applicant-questions">Questions the applicant asked</label><Textarea id="applicant-questions" maxLength={20000} value={draft.applicantQuestions || ""} onChange={e => setDraft(d => ({ ...d, applicantQuestions: e.target.value }))} /><label htmlFor="additional-interview-notes">Additional notes</label><Textarea id="additional-interview-notes" rows={5} maxLength={20000} value={draft.additionalNotes ?? draft.overallReview} onChange={e => setDraft(d => ({ ...d, additionalNotes: e.target.value }))} />
            {!session.completedAt && <div className="space-y-2 text-sm"><h3>Your previous five interviews in this round</h3>{historyError ? <p role="alert">{historyError} <Button type="button" variant="ghost" onClick={() => setHistoryRetry(v => v + 1)}>Retry history</Button></p> : history === null ? <p role="status">Loading your scores…</p> : history.length ? <ul>{history.map(h => <li key={h.id} className="flex justify-between gap-3 rounded-md border bg-card px-3 py-2"><span>{h.name}</span><span>{h.score} / 10</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No previous completed interviews available.</p>}</div>}
            <label htmlFor="interview-score" className="block">Overall score · <span aria-live="polite">{draft.score === null ? "Not scored" : `${draft.score} / 10`}</span></label>
            {session.completedAt ? <p>{draft.score === null ? "Not scored" : `${draft.score} / 10`}</p> : <input id="interview-score" type="range" min={1} max={10} step={0.5} value={draft.score ?? 1} disabled={disabled} aria-valuetext={draft.score === null ? "Not scored; interact to select a score" : `${draft.score} out of 10`} className="min-h-11 w-full accent-foreground cursor-pointer disabled:opacity-50" onChange={e => { const score = Number(e.currentTarget.value); setDraft(d => ({ ...d, score })); }} onPointerUp={e => { const score = Number(e.currentTarget.value); setDraft(d => ({ ...d, score })); }} onKeyUp={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) { const score = Number(e.currentTarget.value); setDraft(d => ({ ...d, score })); } }} />}
            {!session.completedAt && <p className="text-xs text-muted-foreground">1–10 in half-point steps. Select with pointer or touch, or use the arrow keys, Home and End.</p>}
          </fieldset>
          {!session.completedAt && <div className="flex flex-wrap gap-2"><Button type="button" disabled={saving || draft.score === null} onClick={() => void persist(true)}>Save and finish</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setClosing(false)}>Keep interviewing</Button></div>}
        </section>}
        {!session.completedAt && <Button type="button" variant="outline" disabled={saving || !dirty} onClick={() => void persist()}>Save draft</Button>}
        {!session.completedAt && <p className="text-xs text-muted-foreground">Drafts autosave after a brief pause. Wait for “Draft saved” before leaving. Ctrl / ⌘ + Enter opens the closing review.</p>}
      </div>
      <aside id="interview-completed" tabIndex={-1} aria-label="Your completed questions" className="min-w-0 space-y-4 border-t p-5 lg:sticky lg:top-0 lg:border-l lg:border-t-0"><h2 className="oc-section-heading">Completed questions · {completed.length}</h2><p className="text-xs text-muted-foreground">Your completion and notes are independent of other interviewers.</p><ul className="space-y-3">{completed.map(q => <li key={q.id}><button type="button" aria-current={q.id === activeQuestion ? "step" : undefined} onClick={() => setActiveQuestion(q.id)} className="flex min-h-11 w-full gap-2 rounded-lg border border-primary/20 bg-accent p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span className="break-words">{q.prompt}<span className="block text-xs text-muted-foreground">Completed{q.extra ? " · Off-script" : ""}</span></span></button></li>)}</ul>{!completed.length && <p className="text-sm text-muted-foreground">No completed questions yet. “Save and close” moves a question here after it is saved.</p>}</aside>
    </div>
  </form>;
}
