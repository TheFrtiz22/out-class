"use client";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { tutorialDismissalKey, tutorialDismissed, setTutorialDismissed } from "@/lib/tutorial-dismissal";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, ArrowLeft, ArrowRight, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getTutorial, saveTutorial } from "@/lib/workspace-api";
import { tutorialSteps, type TutorialExperience, type TutorialProgress } from "@/lib/tutorials";

type Step = (typeof tutorialSteps)[TutorialExperience][number];
export function TutorialWalkthrough({ experience, clubId, preview, onOpenStep }: {
  experience: TutorialExperience; clubId?: string; preview?: boolean; onOpenStep: (step: Step) => void;
}) {
  const { user } = useAuth(), demo = useDemoMode();
  const identity = tutorialDismissalKey(user?.id ?? "anonymous", experience, preview ? "preview" : demo.isDemoEnabled ? "demo" : "live");
  const owner = useRef(identity); owner.current = identity;
  const intent = useRef(0), flight = useRef<Promise<unknown>>(Promise.resolve());
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const help = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const steps = tutorialSteps[experience];
  const stepIndex = Math.min(progress?.step ?? 0, steps.length - 1), step = steps[stepIndex];
  const open = !!progress && progress.status === "IN_PROGRESS" && !dismissed;
  useEffect(() => {
    let active = true;
    owner.current = identity;
    const loadIntent = intent.current;
    setDismissed(tutorialDismissed(identity, preview));
    getTutorial(experience, clubId).then(value => {
      if (!active || owner.current !== identity || intent.current !== loadIntent) return;
      setProgress(value);
      if (tutorialDismissed(identity, preview) && value.status === "IN_PROGRESS") void enqueue("skip", value.step).catch(() => {});
    }).catch(() => { if (active && owner.current === identity && intent.current === loadIntent) setError("Tutorial could not load. You can keep working and retry from Tutorial help."); });
    const syncDismissal = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== identity) return;
      if (tutorialDismissed(identity, preview)) {
        intent.current++; setDismissed(true); setRect(null); setBusy(false);
        void enqueue("skip", 0).catch(() => {});
      }
    };
    window.addEventListener("online", syncDismissal);
    window.addEventListener("storage", syncDismissal);
    return () => { active = false; owner.current = ""; window.removeEventListener("online", syncDismissal); window.removeEventListener("storage", syncDismissal); };
  // enqueue captures this authorized scope; stale responses are checked below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experience, clubId, identity, preview]);
  useEffect(() => {
    if (!open) {
      if (previousFocus.current) {
        const target = previousFocus.current.isConnected ? previousFocus.current : help.current;
        target?.focus({ preventScroll: true });
        previousFocus.current = null;
      }
      return;
    }
    if (!previousFocus.current) previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card.current?.focus({ preventScroll: true });
    return () => { if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const target = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.anchor}"]`)).find(el => el.getBoundingClientRect().width > 0)
        ?? document.querySelector<HTMLElement>('[data-tour="workspace"]');
      const bounds = target?.getBoundingClientRect();
      setRect(bounds ? { top: bounds.top, left: bounds.left, width: bounds.width, height: Math.min(bounds.height, 160) } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const observer = new ResizeObserver(measure);
    if (document.body) observer.observe(document.body);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); observer.disconnect(); };
  }, [open, step]);
  function enqueue(action: "progress" | "complete" | "skip" | "restart", next: number) {
    const scope = identity;
    const request = flight.current.catch(() => {}).then(() => {
      if (owner.current !== scope) throw new Error("Tutorial context changed.");
      return saveTutorial({ experience, clubId, action, step: next });
    });
    flight.current = request;
    return request;
  }
  function dismiss() {
    const token = ++intent.current, scope = identity;
    // Closing never waits for a network request or an in-flight Next/Back action.
    setDismissed(true); setRect(null); setBusy(false);
    setTutorialDismissed(scope, true, preview);
    void enqueue("skip", stepIndex).then(value => {
      if (owner.current === scope && intent.current === token) setProgress(value);
    }).catch(() => {
      if (owner.current === scope && intent.current === token) setError("Tutorial closed on this device. We’ll sync dismissal when you reconnect.");
    });
  }
  async function change(action: "progress" | "complete" | "restart", next = stepIndex) {
    if (busy) return;
    if (action === "restart" && document.activeElement instanceof HTMLElement) previousFocus.current = document.activeElement;
    const token = ++intent.current, scope = identity;
    setBusy(true); setError("");
    try {
      const value = await enqueue(action, next);
      if (owner.current !== scope || intent.current !== token) return;
      if (action === "restart") setTutorialDismissed(scope, false, preview);
      if (action === "complete") setTutorialDismissed(scope, true, preview);
      setProgress(value); setDismissed(false);
    } catch { if (owner.current === scope && intent.current === token) setError("Could not save tutorial progress. Retry, or close for now and keep working."); }
    finally { if (owner.current === scope && intent.current === token) setBusy(false); }
  }
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  // Rebind only for a scope/step change; dismiss immediately closes this non-modal guide.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, identity, stepIndex]);
  return <>
    {!open && <div className="fixed bottom-20 left-4 lg:bottom-4 z-30 max-w-[calc(100vw-2rem)]">
      <Button ref={help} variant="outline" className="bg-card shadow-sm" disabled={busy || (!progress && !error)} onClick={() => void change("restart", 0)}><CircleHelp className="size-4" />Tutorial help</Button>
      {error && <p role="status" className="mt-2 max-w-xs rounded border bg-card p-3 text-xs">{error}</p>}
    </div>}
    {open && <>
      {rect && <div aria-hidden="true" className="pointer-events-none fixed z-30 rounded-lg ring-2 ring-brand-orange ring-offset-4 ring-offset-background" style={{ top: Math.max(rect.top, 0), left: rect.left, width: rect.width, height: rect.height }} />}
      <div ref={card} role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabIndex={-1}
        className="fixed bottom-20 right-4 lg:bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm max-h-[65dvh] overflow-y-auto rounded-xl border bg-card p-5 text-card-foreground shadow-xl focus-visible:outline-2 focus-visible:outline-ring lg:bottom-6 sm:right-6"
        >
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{experience === "student" ? "Your OutClass guide" : "Leader workspace guide"}</p><Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Dismiss tutorial" onClick={dismiss}><X className="size-4" /></Button></div>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">Step {stepIndex + 1} of {steps.length}{preview ? " · Support preview (not saved)" : ""}</p>
        <progress className="my-3 h-1.5 w-full accent-orange-600" aria-label="Tutorial progress" value={stepIndex + 1} max={steps.length} />
        <h2 id="tutorial-title" className="oc-section-heading ">{step.title}</h2>
        <p id="tutorial-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        <Button variant="link" className="mt-2 h-auto px-0" onClick={() => onOpenStep(step)}>Show me where</Button>
        {error && <div role="alert" className="mt-3 text-sm"><p>{error}</p><Button variant="link" onClick={dismiss}>Close for now</Button></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" disabled={busy} onClick={dismiss}>Skip</Button><div className="flex gap-2"><Button variant="outline" disabled={busy || stepIndex === 0} onClick={() => void change("progress", stepIndex - 1)}><ArrowLeft className="size-4" />Back</Button><Button disabled={busy} onClick={() => void change(stepIndex === steps.length - 1 ? "complete" : "progress", Math.min(stepIndex + 1, steps.length - 1))}>{busy ? "Saving…" : stepIndex === steps.length - 1 ? "Finish" : "Next"}<ArrowRight className="size-4" /></Button></div></div>
      </div>
    </>}
  </>;
}
