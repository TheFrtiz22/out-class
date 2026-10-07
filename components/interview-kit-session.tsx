"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
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
  onNextApplicant,
  onReturnToList,
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
  onNextApplicant?: () => Promise<boolean>;
  onReturnToList?: () => void;
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
  const [offScriptOpen, setOffScriptOpen] = useState(false);
  const activeHeading = useRef<HTMLHeadingElement>(null);
  const bankControl = useRef<HTMLButtonElement>(null);
  const [closingQuestion, setClosingQuestion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const miscellaneousNotes = useRef<HTMLTextAreaElement>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const endingRef = useRef(false);
  type Flight = { id: string; prompt: string; notes: string; from: { left: number; top: number; width: number; height: number } };
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightNodes = useRef(new Map<string, HTMLDivElement>());
  const questionNodes = useRef(new Map<string, HTMLElement>());
  const rowNodes = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!flights.length) return;
    const animations: Animation[] = [];
    let current = true;
    const settle = () => setFlights([]);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("resize", settle);
    reducedMotion.addEventListener("change", settle);
    // Let previously expanded right-panel rows finish collapsing before measuring
    // the new landing slots. Their final geometry stays fixed for the whole flight.
    void (async () => {
    const reviews = formRef.current?.querySelectorAll<HTMLElement>(".oc-question-review") || [];
    const collapsing = [...reviews].flatMap(el => { el.getBoundingClientRect(); return el.getAnimations(); });
    await Promise.allSettled(collapsing.map(a => a.finished));
    if (!current) return;
    for (const [index, flight] of flights.entries()) {
      const moving = flightNodes.current.get(flight.id), row = rowNodes.current.get(flight.id);
      if (!moving || !row) continue;
      const target = row.getBoundingClientRect();
      // Travel below the stationary notes before crossing into the right column.
      // Inner text keeps its original width; only its clipping surface contracts.
      const y = target.top - flight.from.top, x = target.left - flight.from.left;
      animations.push(moving.animate([
        { transform: "translate(0,0)", width: `${flight.from.width}px`, height: `${flight.from.height}px`, offset: 0 },
        { transform: `translate(0,${Math.max(0, y)}px)`, width: `${flight.from.width}px`, height: `${flight.from.height}px`, offset: .3 },
        { transform: `translate(${x}px,${y}px)`, width: `${target.width}px`, height: `${target.height}px`, offset: 1 },
      ], { duration: 1040, delay: index * 90, easing: "cubic-bezier(.4,0,.16,1)", fill: "both" }));
      // Opacity has its own clock: movement easing must not start the fade early.
      animations.push(moving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: 720 + index * 90, easing: "ease", fill: "both" }));
      animations.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 720 + index * 90, easing: "ease", fill: "both" }));
    }
    const middle = closingHeading.current?.closest(".oc-post-interview");
    if (middle) animations.push(middle.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360, delay: 780 + Math.max(0, flights.length - 1) * 90, fill: "both", easing: "ease" }));
    await Promise.allSettled(animations.map(a => a.finished));
    if (current) { setFlights([]); if (document.activeElement !== miscellaneousNotes.current) closingHeading.current?.focus({ preventScroll: true }); }
    })();
    return () => { current = false; animations.forEach(a => a.cancel()); window.removeEventListener("resize", settle); reducedMotion.removeEventListener("change", settle); };
  }, [flights, formRef]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getPreviousInterviewScores>> | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyRetry, setHistoryRetry] = useState(0);
  const closing = draft.postInterview === true;
  function setClosing(value: boolean) { setDraft(d => ({ ...d, postInterview: value })); }
  const [nextBusy, setNextBusy] = useState(false);
  const nextBusyRef = useRef(false);
  const [nextError, setNextError] = useState("");
  const [noMoreApplicants, setNoMoreApplicants] = useState(false);
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
  useEffect(() => { if ((closing || session?.completedAt) && !ending && !flights.length && (typeof document === "undefined" || document.activeElement !== miscellaneousNotes.current)) { closingHeading.current?.focus({ preventScroll: true }) } }, [closing, session?.completedAt, flights.length, ending]);
  const savingRef = useRef(false),
    mounted = useRef(true),
    sessionRef = useRef<InterviewSessionData | null>(null);
  const draftRef = useRef(draft);
  const pendingSave = useRef<Promise<boolean | undefined> | null>(null);
  const finishingRef = useRef(false);
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
  async function persist(complete = false, next = false, patch?: Partial<InterviewDraft>): Promise<boolean | undefined> {
    if (complete && finishingRef.current) return;
    if (complete) { finishingRef.current = true; setCompleting(true); }
    if (pendingSave.current) await pendingSave.current;
    const record = sessionRef.current;
    if (!record || savingRef.current || record.completedAt) { if (complete) { finishingRef.current = false; setCompleting(false); } return; }
    if (complete && draftRef.current.score === null) {
      setError("Choose an overall score before ending the post-interview.");
      finishingRef.current = false; setCompleting(false);
      return false;
    }
    if (complete && newQuestion.trim()) {
      setError("Add or clear the additional question before completing.");
      finishingRef.current = false; setCompleting(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setFailedFinish(false);
    const snapshot = structuredClone({ ...draftRef.current, ...patch });
    const request = (async () => { try {
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
        if (patch) setDraft(current => ({ ...current, ...patch }));
        if (complete && result.evaluation) { setActiveQuestion(""); setDraft(result.session.draft); onComplete(result.evaluation, next); }
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
        if (complete) { finishingRef.current = false; setCompleting(false); }
      }
    } })();
    pendingSave.current = request;
    try { return await request; } finally { if (pendingSave.current === request) pendingSave.current = null; }
  }
  useEffect(() => {
    if (!dirty || !session || session.completedAt || error) return;
    const timer = setTimeout(() => {
      if (!savingRef.current && !finishingRef.current && !endingRef.current) void persist();
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
    ...draft.additionalQuestions.map(q => ({ id: q.id, prompt: q.question, guidance: q.bankQuestion?.guidance || "", extra: true, bank: !!q.bankQuestion })),
  ];
  const active = questions.find(q => q.id === activeQuestion);
  const completedIds = session.draft.completedQuestionIds || [];
  const completed = questions.filter(q => completedIds.includes(q.id));
  const available = questions.filter(q => !completedIds.includes(q.id));
  const used = questions.filter(q => completedIds.includes(q.id) || (q.extra ? draft.additionalQuestions.some(n => n.id === q.id) : draft.questionNotes.some(n => n.questionId === q.id)));
  const reviewed = closing || session.completedAt ? used : completed;
  const disabled = !!session.completedAt || completing || closingQuestion;
  function questionNotes(id: string) { return draft.additionalQuestions.find(q => q.id === id)?.notes ?? draft.questionNotes.find(q => q.questionId === id)?.notes ?? ""; }
  function key(guidance: string) { return guidance ? <details className="oc-answer-key"><summary>Club answer key</summary><p className="oc-question-guidance">{guidance}</p></details> : null; }
  async function endInterview() {
    if (endingRef.current || sessionRef.current?.completedAt || closing) return;
    if (newQuestion.trim()) { setError("Add or clear your off-script question before ending the interview."); return; }
    endingRef.current = true; setEnding(true);
    const moving: Flight[] = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches ? used.filter(q => !completedIds.includes(q.id)).flatMap(q => {
      const source = questionNodes.current.get(q.id);
      if (!source || !source.animate) return [];
      const r = source.getBoundingClientRect();
      return [{ id: q.id, prompt: q.prompt, notes: questionNotes(q.id), from: { left: r.left, top: r.top, width: r.width, height: Math.min(r.height, 220) } }];
    }) : [];
    const ok = await persist(false, false, { postInterview: true });
    if (ok && mounted.current) {
      setExpandedQuestions([]);
      setFlights(moving);
    }
    endingRef.current = false; if (mounted.current) setEnding(false);
  }
  function scoreKey(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const steps: Record<string, number> = { ArrowLeft: -0.5, ArrowDown: -0.5, ArrowRight: 0.5, ArrowUp: 0.5, PageDown: -1, PageUp: 1 };
    if (event.key !== "Home" && event.key !== "End" && !(event.key in steps)) return;
    // Own the keyboard step rather than reading a potentially stale native value
    // on keyup. Prevent the browser from applying the same step a second time.
    event.preventDefault();
    setDraft(current => ({ ...current, score: event.key === "Home" ? 1 : event.key === "End" ? 10 : Math.max(1, Math.min(10, Math.round((current.score ?? 1) * 2) / 2 + steps[event.key])) }));
  }
  const libraryQuestions = library.filter(q => `${q.prompt} ${q.guidance}`.toLowerCase().includes(search.toLowerCase()));
  function addQuestion(prompt: string, bankId?: string, guidance?: string) {
    if (disabled || draft.additionalQuestions.length >= 30 || !prompt.trim()) return;
    const id = bankId || crypto.randomUUID();
    if (questions.some(q => q.id === id)) { setActiveQuestion(id); return; }
    setDraft(d => ({ ...d, additionalQuestions: [...d.additionalQuestions, { id, question: prompt.trim(), notes: "", ...(bankId ? { bankQuestion: { guidance: guidance || "" } } : {}) }] }));
    setActiveQuestion(id);
  }
  async function closeQuestion() {
    if (!active || disabled) return;
    setClosingQuestion(true);
    const ok = await persist(false, false, { completedQuestionIds: [...new Set([...(draft.completedQuestionIds || []), active.id])] });
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
  async function nextApplicant() {
    if (!sessionRef.current?.completedAt || nextBusyRef.current || !onNextApplicant) return;
    nextBusyRef.current = true; setNextBusy(true); setNextError("");
    try {
      const found = await onNextApplicant();
      if (mounted.current) setNoMoreApplicants(!found);
    } catch {
      if (mounted.current) setNextError("Could not load the next applicant. Your submitted review is safe. Retry to check your current access and assignments.");
    } finally {
      nextBusyRef.current = false;
      if (mounted.current) setNextBusy(false);
    }
  }
  return <form ref={formRef} id="interview-evaluation" className="oc-focused-interview min-w-0" data-unsaved={dirty || !!newQuestion.trim()} data-saving={saving} onSubmit={e => { e.preventDefault(); if (!session.completedAt) void endInterview(); }}>
    <header className="oc-room-header">
      {toolbar?.(!!session.completedAt)}
      <div className="oc-room-save"><span role="status" aria-live="polite">{session.completedAt ? "Submitted · Read only" : error ? "Couldn’t save" : saving || dirty ? "Saving…" : "All changes saved"}</span>{error && !session.completedAt && <Button type="button" variant="ghost" disabled={saving} onClick={() => void persist(failedFinish)}>Retry</Button>}{!session.completedAt && !closing && <Button type="button" variant="outline" disabled={ending || closingQuestion || completing} onClick={() => void endInterview()}>{ending ? "Saving interview…" : "End interview"}</Button>}</div>
    </header>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <div className="oc-interview-columns grid items-start">
      {context}
      <div className="oc-question-workspace min-w-0">
        {error && <div role="alert" className="space-y-2 text-sm text-destructive">{error} Your text remains here.<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving || !!session.completedAt} onClick={() => void persist(failedFinish)}>{failedFinish ? "Retry end post-interview" : "Retry save"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => void refreshRevision()}>Refresh revision, keep my text</Button></div></div>}
        {(!closing && !session.completedAt) || (session.completedAt && activeQuestion) ? <>
        {session.completedAt && <Button type="button" variant="ghost" onClick={() => setActiveQuestion("")}>Back to submitted review</Button>}
        <div className="oc-question-heading"><h2>Interview questions</h2><Button ref={bankControl} type="button" variant="ghost" aria-expanded={libraryOpen} aria-controls="interview-bank" onClick={() => setLibraryOpen(v => !v)}>Question bank</Button></div>
        <a href="#interview-completed" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 lg:hidden">Your completed questions · {completed.length}</a>
        {libraryOpen && <section id="interview-bank" aria-label="Round question bank" className="space-y-3 rounded-lg border bg-card p-4">
          {session.instructions && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{session.instructions}</p>}
          <h3 className="text-sm font-medium">Round question bank</h3><p className="text-xs text-muted-foreground">Browse the current kit. Existing interview questions keep their original wording.</p>
          <Input aria-label="Search question bank" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} />
          {libraryLoading && <p role="status">Loading question bank…</p>}
          {libraryError && <p role="alert">{libraryError} <Button type="button" variant="ghost" onClick={() => setLibraryRetry(v => v + 1)}>Retry bank</Button></p>}
          <ul className="space-y-3">{libraryQuestions.map(q => { const existing = questions.find(item => item.id === q.id); return <li key={q.id} className="space-y-2 border-t pt-3"><p className="break-words text-sm font-medium">{q.prompt}</p>{key(q.guidance)}<Button type="button" size="sm" variant="outline" disabled={!existing && (disabled || draft.additionalQuestions.length >= 30)} onClick={() => existing ? setActiveQuestion(existing.id) : addQuestion(q.prompt, q.id, q.guidance)}>{existing ? "Open saved question" : "Use question"}</Button></li>; })}</ul>
          {!libraryLoading && !libraryQuestions.length && <p className="text-sm text-muted-foreground">No matching questions in this bank.</p>}
        </section>}
        {!active && <section className="oc-question-agenda" aria-label="Available questions"><h3>Available questions · {available.length}</h3><ul>{available.map(q => <li key={q.id}><button ref={el => { if (el) questionNodes.current.set(q.id, el); else questionNodes.current.delete(q.id); }} type="button" disabled={ending} onClick={() => setActiveQuestion(q.id)} className="oc-question-row"><span>{q.prompt}</span>{q.extra && !("bank" in q && q.bank) && <span className="oc-question-kind">Off-script</span>}</button></li>)}</ul>{!available.length && <p className="text-sm text-muted-foreground">Browse the bank or reopen a completed question.</p>}</section>}
        {active ? <section ref={el => { if (el) questionNodes.current.set(active.id, el); else questionNodes.current.delete(active.id); }} className="oc-active-question space-y-4" aria-label="Active question">
          <Button type="button" variant="ghost" onClick={() => { setActiveQuestion(""); setLibraryOpen(false); bankControl.current?.focus(); }}>Back to question bank</Button>
          <h3 ref={activeHeading} tabIndex={-1} className="break-words">{active.prompt}</h3>
          {completedIds.includes(active.id) && <p className="text-xs text-primary">Completed by you{session.completedAt ? " · Read only" : " · Notes can still be revised"}</p>}
          {key(active.guidance)}
          <label htmlFor={`active-notes-${active.id}`}>Your private notes</label>
          <Textarea id={`active-notes-${active.id}`} disabled={disabled || ending} rows={8} maxLength={10000} value={active.extra ? draft.additionalQuestions.find(q => q.id === active.id)?.notes || "" : draft.questionNotes.find(q => q.questionId === active.id)?.notes || ""} onChange={e => active.extra ? setDraft(d => ({ ...d, additionalQuestions: d.additionalQuestions.map(q => q.id === active.id ? { ...q, notes: e.target.value } : q) })) : note(active.id, e.target.value)} />
          <p className="text-xs text-muted-foreground">Only your interview session stores these notes. Typing does not mark a question complete.</p>
          {!session.completedAt && <Button type="button" disabled={ending || closingQuestion || completing} onClick={() => void closeQuestion()}>{closingQuestion ? "Saving question…" : "Save & close"}</Button>}
        </section> : null}
        {!session.completedAt && <div className="oc-off-script"><Button type="button" variant="ghost" aria-expanded={offScriptOpen} aria-controls="interview-off-script" onClick={() => setOffScriptOpen(v => !v)}>+ Off-script question</Button>{offScriptOpen && <fieldset id="interview-off-script" disabled={completing || closingQuestion} className="space-y-3"><label htmlFor="new-interview-question">Off-script question</label><Input id="new-interview-question" autoFocus maxLength={3000} value={newQuestion} onChange={e => setNewQuestion(e.target.value)} /><Button type="button" variant="outline" disabled={!newQuestion.trim() || draft.additionalQuestions.length >= 30} onClick={() => { addQuestion(newQuestion); setNewQuestion(""); setOffScriptOpen(false); setLibraryOpen(false); }}>Add question</Button><p className="text-xs text-muted-foreground">Add it to your session before leaving. Its private notes autosave.</p></fieldset>}</div>}
        </> : <section aria-label={session.completedAt ? "Submitted review" : "Post-interview"} className="oc-post-interview space-y-5" style={flights.length ? { opacity: 0 } : undefined}>
          <h2 ref={closingHeading} tabIndex={-1}>{session.completedAt ? "Interview complete" : "Post-interview"}</h2><p className="text-sm text-muted-foreground">{session.completedAt ? "Your review was submitted and is read only. Other interviewers finish independently." : "Take time to discuss before choosing your own score."}</p>
          <a href="#interview-completed" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 lg:hidden">Miscellaneous notes and question review</a>
          <fieldset disabled={disabled} className="space-y-3"><label htmlFor="applicant-questions">Questions the applicant asked</label><Textarea id="applicant-questions" rows={4} maxLength={20000} value={draft.applicantQuestions || ""} onChange={e => setDraft(d => ({ ...d, applicantQuestions: e.target.value }))} />
            {!session.completedAt && <div className="oc-score-history"><h3>Your previous five interviews in this round</h3>{historyError ? <p role="alert">{historyError} <Button type="button" variant="ghost" onClick={() => setHistoryRetry(v => v + 1)}>Retry history</Button></p> : history === null ? <p role="status">Loading your scores…</p> : history.length ? <ul>{history.map(h => <li key={h.id}><span>{h.name}</span><span>{h.score} / 10</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No previous completed interviews available.</p>}</div>}
            <label htmlFor="interview-score" className="block">Overall score · <span aria-live="polite">{draft.score === null ? "Not scored" : `${draft.score} / 10`}</span></label>
            {session.completedAt ? <p>{draft.score === null ? "Not scored" : `${draft.score} / 10`}</p> : <input id="interview-score" type="range" min={1} max={10} step={0.5} value={draft.score ?? 1} disabled={disabled} aria-valuetext={draft.score === null ? "Not scored; interact to select a score" : `${draft.score} out of 10`} className="min-h-11 w-full accent-foreground cursor-pointer disabled:opacity-50" onChange={e => { const score = Number(e.currentTarget.value); setDraft(d => ({ ...d, score })); }} onPointerUp={e => { const score = Number(e.currentTarget.value); setDraft(d => ({ ...d, score })); }} onKeyDown={scoreKey} />}
            {!session.completedAt && <p className="text-xs text-muted-foreground">1–10 in half-point steps. Select with pointer or touch, or use the arrow keys, Home and End.</p>}
          </fieldset>
          {!session.completedAt ? <div className="flex flex-wrap gap-2"><Button type="button" disabled={completing || flights.length > 0 || draft.score === null} onClick={() => void persist(true)}>{completing ? "Submitting…" : "End post-interview"}</Button><Button type="button" variant="ghost" disabled={saving || flights.length > 0} onClick={() => { setExpandedQuestions([]); setClosing(false); }}>Keep interviewing</Button></div> : <div className="space-y-3">
            {nextError && <p role="alert" className="text-sm text-destructive">{nextError}</p>}
            {noMoreApplicants && <p role="status" className="font-medium">No more applicants</p>}
            {onNextApplicant && <Button type="button" disabled={nextBusy} onClick={() => void nextApplicant()}>{nextBusy ? "Checking applicants…" : noMoreApplicants ? "Check for new assignments" : "Next applicant"}</Button>}
            {onReturnToList && <Button type="button" variant="outline" disabled={nextBusy} onClick={onReturnToList}>Return to interview list</Button>}
          </div>}
        </section>}
      </div>
      <aside id="interview-completed" tabIndex={-1} aria-label="Your notes and completed questions" className="min-w-0">
        <div className="oc-miscellaneous-notes"><label htmlFor="additional-interview-notes">Miscellaneous notes</label><Textarea ref={miscellaneousNotes} id="additional-interview-notes" rows={5} maxLength={20000} disabled={!!session.completedAt || completing} value={draft.additionalNotes ?? draft.overallReview} onChange={e => setDraft(d => ({ ...d, additionalNotes: e.target.value }))} /></div>
        <h2>{closing || session.completedAt ? "Your question notes" : "Completed questions"} <span className="oc-completed-count">{reviewed.length}</span></h2>
        <ul>{reviewed.map(q => { const notes = questionNotes(q.id), open = expandedQuestions.includes(q.id), done = completedIds.includes(q.id); return <li key={q.id} style={flights.some(f => f.id === q.id) ? { opacity: 0 } : undefined} ref={el => { if (el) rowNodes.current.set(q.id, el); else rowNodes.current.delete(q.id); }}>
          <button type="button" aria-expanded={open} aria-controls={`question-review-${q.id}`} onClick={() => setExpandedQuestions(ids => open ? ids.filter(id => id !== q.id) : [...ids, q.id])} className="oc-completed-row">
            {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> : <span className="oc-used-indicator" aria-hidden="true">·</span>}
            <span><span className="oc-completed-prompt">{q.prompt}</span><span className="oc-question-kind">{done ? "Completed" : "Used · Not marked complete"}{q.extra && !("bank" in q && q.bank) ? " · Off-script" : ""}</span>{notes && <span className="oc-note-preview">{notes}</span>}</span>
          </button>
          <div id={`question-review-${q.id}`} className="oc-question-review" data-open={open} inert={!open}><div><div className="oc-question-review-content">
            <p className="text-sm">{q.prompt}</p>{key(q.guidance)}<label htmlFor={`review-notes-${q.id}`}>Your private notes</label>
            <Textarea id={`review-notes-${q.id}`} rows={4} maxLength={10000} disabled={disabled} value={notes} onChange={e => q.extra ? setDraft(d => ({ ...d, additionalQuestions: d.additionalQuestions.map(item => item.id === q.id ? { ...item, notes: e.target.value } : item) })) : note(q.id, e.target.value)} />
            {!closing && !session.completedAt && <Button type="button" variant="ghost" onClick={() => { setActiveQuestion(q.id); setExpandedQuestions([]); }}>Reopen question</Button>}
          </div></div></div>
        </li>; })}</ul>
        {!reviewed.length && <p className="text-sm text-muted-foreground">{closing || session.completedAt ? "No question notes recorded." : "Saved questions appear here."}</p>}
      </aside>
    </div>
    {flights.map(f => <div key={f.id} ref={el => { if (el) flightNodes.current.set(f.id, el); else flightNodes.current.delete(f.id); }} className="oc-question-flight" aria-hidden="true" inert style={{ left: f.from.left, top: f.from.top, width: f.from.width, height: f.from.height }}><div style={{ width: f.from.width }}><p>{f.prompt}</p>{f.notes && <p className="oc-note-preview">{f.notes}</p>}</div></div>)}
  </form>;
}
