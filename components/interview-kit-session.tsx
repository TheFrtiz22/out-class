"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  getInterviewKit,
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
  context,
  toolbar,
  canManageKit = false,
}: {
  context?: ReactNode;
  toolbar?: (completed: boolean) => ReactNode;
  canManageKit?: boolean;
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
  const [closing, setClosing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState<InterviewSessionData["questions"]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [libraryRetry, setLibraryRetry] = useState(0);
  useEffect(() => {
    if (!canManageKit) return;
    let current = true;
    setLibraryError("");
    getInterviewKit(clubId, roundId).then(result => { if (current) setLibrary(result.questions) }).catch(() => { if (current) setLibraryError("Current kit unavailable. Your session snapshot is still available.") });
    return () => { current = false };
  }, [clubId, roundId, canManageKit, libraryRetry]);
  const closingHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (closing) { closingHeading.current?.scrollIntoView({ block: "center" }); closingHeading.current?.focus({ preventScroll: true }) } }, [closing]);
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
        if (complete && result.evaluation) { setClosing(false); onComplete(result.evaluation, next); }
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
    if (!dirty || !session || session.completedAt || error) return;
    const timer = setTimeout(() => {
      if (!savingRef.current) void persist();
    }, 800);
    return () => clearTimeout(timer);
  }, [serialized, saved, session?.id, saving]);
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
  const questions = [
    ...session.questions.map(q => ({ id: q.id, prompt: q.prompt, guidance: q.guidance, extra: false })),
    ...draft.additionalQuestions.map(q => ({ id: q.id, prompt: q.question, guidance: "", extra: true })),
  ];
  const active = questions.find(q => q.id === activeQuestion) || questions[0];
  const activeIndex = questions.findIndex(q => q.id === active?.id);
  const disabled = !!session.completedAt || completing;
  const libraryQuestions = [...session.questions, ...library.filter(q => !session.questions.some(saved => saved.id === q.id))].filter(q => `${q.prompt} ${q.guidance}`.toLowerCase().includes(search.toLowerCase()));
  function addQuestion(prompt: string) {
    if (disabled || draft.additionalQuestions.length >= 30 || !prompt.trim()) return;
    const id = crypto.randomUUID();
    setDraft(d => ({ ...d, additionalQuestions: [...d.additionalQuestions, { id, question: prompt.trim(), notes: "" }] }));
    setActiveQuestion(id);
  }
  return (
    <form ref={formRef} id="interview-evaluation" className="oc-focused-interview min-w-0" data-unsaved={dirty || !!newQuestion.trim()} data-saving={saving} onSubmit={e => { e.preventDefault(); if (!session.completedAt) setClosing(true) }}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-5 py-4 sm:px-8">
        {toolbar?.(!!session.completedAt)}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-primary">{session.completedAt ? "Ended" : "In progress"}</span>
          <span role="status" className="text-xs text-muted-foreground">{session.completedAt ? "Completed interview" : error ? "Save needs attention" : saving ? "Saving…" : dirty || newQuestion.trim() ? "Unsaved changes" : "Draft saved"}</span>
          {!session.completedAt && <Button type="button" disabled={saving} onClick={() => setClosing(true)}>End Interview</Button>}
        </div>
      </header>
      {error && <div role="alert" className="border-b px-5 py-3 text-sm text-destructive">{error} Your text remains here. <Button type="button" variant="outline" disabled={saving} onClick={() => void persist()}>Retry save</Button></div>}
      <div className={`oc-interview-columns grid items-start lg:grid-cols-[260px_minmax(0,1fr)] ${libraryOpen ? "xl:grid-cols-[260px_minmax(0,1fr)_290px]" : ""}`}>
        {context}
        <div className="min-w-0 space-y-7 px-5 py-7 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-widest text-muted-foreground">{session.completedAt ? "Interview record" : "Interview"}</p><Button type="button" variant="ghost" aria-expanded={libraryOpen} aria-controls="interview-library" onClick={() => setLibraryOpen(v => !v)}>{libraryOpen ? "Hide library" : "Question library"}</Button></div>
          <fieldset disabled={disabled} className="min-w-0 space-y-6">
            <section className="oc-active-question space-y-4" aria-label="Active question">
              <p className="text-sm text-muted-foreground">Active Question {active ? `· ${activeIndex + 1} of ${questions.length}` : ""}</p>
              <h2 className="oc-section-heading ">{active?.prompt || "Make room for a conversation."}</h2>
              {active?.guidance && <p className="whitespace-pre-wrap border-l-2 border-brand-orange pl-4 text-sm leading-7 text-muted-foreground">{active.guidance}</p>}
              {active ? <><label htmlFor={`active-notes-${active.id}`} className="block text-sm font-medium">Your private question notes</label><Textarea id={`active-notes-${active.id}`} className="min-h-48" rows={8} maxLength={10000} value={active.extra ? draft.additionalQuestions.find(q => q.id === active.id)?.notes || "" : draft.questionNotes.find(q => q.questionId === active.id)?.notes || ""} onChange={e => active.extra ? setDraft(d => ({ ...d, additionalQuestions: d.additionalQuestions.map(q => q.id === active.id ? { ...q, notes: e.target.value } : q) })) : note(active.id, e.target.value)} /></> : <p className="text-sm text-muted-foreground">This snapshot has no configured questions. Add an off-script question below.</p>}
              <p className="text-xs text-muted-foreground">Notes belong to your interview session. This is not a shared live document.</p>
            </section>
          </fieldset>
          <section className="oc-question-agenda space-y-3 border-t pt-5"><h2 className="oc-section-heading ">Question Agenda</h2><p className="text-xs text-muted-foreground">Kit order is preserved in this session’s snapshot.</p>
            <ol className="divide-y">{questions.map((q, i) => <li key={q.id}><button type="button" aria-current={q.id === active?.id ? "step" : undefined} onClick={() => setActiveQuestion(q.id)} className={`flex w-full gap-3 rounded px-3 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring ${q.id === active?.id ? "bg-accent font-medium" : "hover:bg-muted"}`}><span className="text-muted-foreground">{i + 1}.</span><span className="break-words">{q.prompt}{q.extra && <span className="mt-1 block text-xs font-normal text-muted-foreground">Off-script</span>}</span></button></li>)}</ol>
            {!session.completedAt && <fieldset disabled={completing} className="space-y-3 pt-3"><label htmlFor="new-interview-question" className="text-sm font-medium">Add an off-script question</label><Input id="new-interview-question" maxLength={3000} value={newQuestion} onChange={e => setNewQuestion(e.target.value)} /><Button type="button" variant="outline" disabled={!newQuestion.trim() || draft.additionalQuestions.length >= 30} onClick={() => { addQuestion(newQuestion); setNewQuestion("") }}>Add question</Button></fieldset>}
          </section>
          {(closing || session.completedAt) && <section aria-label="Closing review" className="space-y-4 border-t pt-5">
            <h2 ref={closingHeading} tabIndex={-1} className="oc-section-heading ">{session.completedAt ? "Overall review" : "Finish your interview"}</h2><p className="text-sm text-muted-foreground">Review your notes before confirming. Completion saves your evaluation and locks this interview; it does not change the candidate’s round or decision.</p>
            <fieldset disabled={disabled} className="space-y-3"><label htmlFor="overall-interview-review">Overall Review</label><Textarea id="overall-interview-review" rows={5} maxLength={20000} value={draft.overallReview} onChange={e => setDraft(d => ({ ...d, overallReview: e.target.value }))} /><label htmlFor="interview-score" className="block">Overall score · 1–10 (required to complete)</label><Input id="interview-score" type="number" min={1} max={10} step="any" className="w-28" value={draft.score ?? ""} onChange={e => setDraft(d => ({ ...d, score: e.target.value === "" ? null : Number(e.target.value) }))} /></fieldset>
            {!session.completedAt && <div className="flex flex-wrap gap-2"><Button type="button" disabled={saving || draft.score === null} onClick={() => void persist(true)}>Confirm completion</Button><Button type="button" variant="outline" disabled={saving || draft.score === null} onClick={() => void persist(true, true)}>Complete & next</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setClosing(false)}>Keep interviewing</Button></div>}
          </section>}
          {!session.completedAt && <Button type="button" variant="outline" disabled={saving || !dirty} onClick={() => void persist()}>Save draft</Button>}
          <p className="text-xs text-muted-foreground">Drafts autosave after a brief pause. Wait for “Draft saved” before leaving. ⌘ / Ctrl + Enter opens the closing review.</p>
        </div>
        {libraryOpen && <aside id="interview-library" aria-label="Question library" className="min-w-0 space-y-4 border-t p-5 lg:col-start-2 xl:col-start-auto xl:sticky xl:top-0 xl:max-h-dvh xl:overflow-y-auto xl:border-l xl:border-t-0">
          <h2 className="oc-section-heading ">Question Library</h2><p className="text-xs leading-5 text-muted-foreground">Your session’s kit snapshot{canManageKit ? " and the current round kit" : ""}. Existing questions stay in the agenda.</p><Input aria-label="Search question library" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} />
          {libraryError && <p role="alert" className="text-xs">{libraryError} <Button type="button" variant="ghost" onClick={() => setLibraryRetry(v => v + 1)}>Retry</Button></p>}
          <ul className="divide-y">{libraryQuestions.map(q => { const existing = questions.find(item => item.id === q.id || item.prompt === q.prompt); return <li key={q.id} className="space-y-3 py-4"><p className="text-sm font-medium leading-6">{q.prompt}</p>{q.guidance && <p className="text-xs leading-5 text-muted-foreground">{q.guidance}</p>}<Button type="button" size="sm" variant="outline" disabled={!existing && (disabled || draft.additionalQuestions.length >= 30)} onClick={() => existing ? setActiveQuestion(existing.id) : addQuestion(q.prompt)}>{existing ? "Go to question" : "Add to Interview"}</Button>{!existing && <p className="text-xs text-muted-foreground">Adds the prompt as an off-script question.</p>}</li> })}</ul>
          {!libraryQuestions.length && <p className="text-sm text-muted-foreground">No matching kit questions.</p>}
        </aside>}
      </div>
    </form>
  );
}
