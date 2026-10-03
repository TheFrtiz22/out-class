"use client";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTutorial, saveTutorial } from "@/actions/tutorials";
import { tutorialSteps, type TutorialExperience, type TutorialProgress } from "@/lib/tutorials";

type Step = (typeof tutorialSteps)[TutorialExperience][number];
export function TutorialWalkthrough({ experience, clubId, preview, onOpenStep }: {
  experience: TutorialExperience; clubId?: string; preview?: boolean; onOpenStep: (step: Step) => void;
}) {
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const card = useRef<HTMLDivElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const steps = tutorialSteps[experience];
  const stepIndex = Math.min(progress?.step ?? 0, steps.length - 1), step = steps[stepIndex];
  const open = !!progress && progress.status === "IN_PROGRESS" && !dismissed;
  useEffect(() => {
    let active = true;
    getTutorial(experience, clubId).then(value => { if (active) setProgress(value); }).catch(() => { if (active) setError("Tutorial could not load. You can keep working and retry from Tutorial help."); });
    return () => { active = false; };
  }, [experience, clubId]);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
  async function change(action: "progress" | "complete" | "skip" | "restart", next = stepIndex) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const value = await saveTutorial({ experience, clubId, action, step: next });
      setProgress(value); setDismissed(false);
    } catch { setError("Could not save tutorial progress. Retry, or close for now and keep working."); }
    finally { setBusy(false); }
  }
  return <>
    {!open && <div className="fixed bottom-4 left-4 z-30 max-w-[calc(100vw-2rem)]">
      <Button variant="outline" className="bg-card shadow-sm" disabled={busy || (!progress && !error)} onClick={() => void change("restart", 0)}><CircleHelp className="size-4" />Tutorial help</Button>
      {error && <p role="status" className="mt-2 max-w-xs rounded border bg-card p-3 text-xs">{error}</p>}
    </div>}
    {open && <>
      {rect && <div aria-hidden="true" className="pointer-events-none fixed z-30 rounded-lg ring-2 ring-brand-orange ring-offset-4 ring-offset-background" style={{ top: Math.max(rect.top, 0), left: rect.left, width: rect.width, height: rect.height }} />}
      <div ref={card} role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabIndex={-1}
        className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm max-h-[65dvh] overflow-y-auto rounded-xl border bg-card p-5 text-card-foreground shadow-xl focus-visible:outline-2 focus-visible:outline-ring sm:bottom-6 sm:right-6"
        onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); void change("skip"); } }}>
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{experience === "student" ? "Your OutClass guide" : "Leader workspace guide"}</p><Button variant="ghost" size="icon" aria-label="Skip tutorial" disabled={busy} onClick={() => void change("skip")}><X className="size-4" /></Button></div>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">Step {stepIndex + 1} of {steps.length}{preview ? " · Support preview (not saved)" : ""}</p>
        <progress className="my-3 h-1.5 w-full accent-orange-600" aria-label="Tutorial progress" value={stepIndex + 1} max={steps.length} />
        <h2 id="tutorial-title" className="oc-section-heading ">{step.title}</h2>
        <p id="tutorial-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        <Button variant="link" className="mt-2 h-auto px-0" onClick={() => onOpenStep(step)}>Show me where</Button>
        {error && <div role="alert" className="mt-3 text-sm"><p>{error}</p><Button variant="link" onClick={() => setDismissed(true)}>Close for now</Button></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" disabled={busy} onClick={() => void change("skip")}>Skip</Button><div className="flex gap-2"><Button variant="outline" disabled={busy || stepIndex === 0} onClick={() => void change("progress", stepIndex - 1)}><ArrowLeft className="size-4" />Back</Button><Button disabled={busy} onClick={() => void change(stepIndex === steps.length - 1 ? "complete" : "progress", Math.min(stepIndex + 1, steps.length - 1))}>{busy ? "Saving…" : stepIndex === steps.length - 1 ? "Finish" : "Next"}<ArrowRight className="size-4" /></Button></div></div>
      </div>
    </>}
  </>;
}
