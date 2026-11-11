"use client";
import { useEffect, useRef, useState } from "react";
import { controlInterviewTimer } from "@/lib/workspace-api";
import { clockOffsetMs, freshTimerState, newerTimer, timerPhase, timerRemainingMs, TIMER_ADJUST_STEP_MS, type SharedTimerView, type TimerCommand } from "@/lib/interview-shared-timer";
import type { InterviewScope } from "@/lib/interview-access";
import type { InterviewTiming } from "@/lib/interview-session-timing";
import { Button } from "@/components/ui/button";

type Shared = SharedTimerView & { clockOffsetMs?: number };

/** The room's shared countdown. State lives on the server (one per interview room);
 * this device only keeps its clock offset and the newest revision it has seen.
 * Own ticking state: the question editor and PDF never rerender on timer ticks. */
export function InterviewTimer({ scope, paused, timing, shared }: { scope: InterviewScope; paused: boolean; timing?: InterviewTiming | null; shared?: Shared | null }) {
  const [state, setState] = useState<Shared | null>(null), [offset, setOffset] = useState(0), [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Each collaboration poll brings the room's timer and a fresh clock-offset sample.
  useEffect(() => {
    if (!shared) return;
    setState(old => newerTimer(old, shared) as Shared | null);
    if (shared.clockOffsetMs !== undefined) setOffset(shared.clockOffsetMs);
  }, [shared]);
  const running = !!state && timerPhase(state) === "running";
  useEffect(() => {
    if (!running) { setNow(Date.now()); return; }
    const tick = () => setNow(Date.now());
    tick(); const timer = setInterval(tick, 1000);
    const wake = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", wake);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", wake); };
  }, [running]);
  if (!timing) return <div className="oc-interview-timer" role="status">{timing === undefined ? "Checking interview duration…" : "Interview duration unavailable"}</div>;
  const ready = !!state;
  const value = state || { ...freshTimerState(timing), revision: 0, serverNow: 0 };
  // Server time = this device's clock + measured offset; a wrong device clock cancels out.
  const seconds = Math.ceil(timerRemainingMs(value, (now || Date.now()) + offset) / 1000), phase = timerPhase(value);
  const changed = value.contextKey !== timing.contextKey;
  async function send(command: TimerCommand) {
    if (!state || busy) return;
    setBusy(true); setMessage("");
    try {
      const sentAt = Date.now();
      const result = await controlInterviewTimer({ ...scope, revision: state.revision, requestId: crypto.randomUUID(), command });
      if (!mounted.current) return;
      if (result.timer) { const timer = { ...result.timer, clockOffsetMs: clockOffsetMs(result.timer.serverNow, sentAt, Date.now()) }; setState(old => newerTimer(old, timer) as Shared | null); setOffset(timer.clockOffsetMs); }
      if (result.status === "conflict") setMessage("Timer changed on another device. Showing the current time.");
      setNow(Date.now());
    } catch { if (mounted.current) setMessage("Couldn’t update the timer. Check your connection and try again."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <div className="oc-interview-timer" aria-label="Shared interview countdown" aria-busy={busy} data-expired={seconds === 0}>
    <output aria-label="Remaining interview time" aria-live="off">{String(Math.floor(seconds / 60)).padStart(2,"0")}:{String(seconds % 60).padStart(2,"0")}</output>
    {seconds === 0 && <span role="status">Time’s up</span>}
    <Button type="button" variant="ghost" disabled={!ready || busy || paused || (phase !== "running" && seconds === 0)} onClick={() => void send({ type: phase === "ready" ? "start" : phase === "running" ? "pause" : "resume" })}>{phase === "running" ? "Pause" : phase === "ready" ? "Start" : "Resume"}</Button>
    <Button type="button" variant="ghost" disabled={!ready || busy || paused || seconds === 0} aria-label="Remove one minute" onClick={() => void send({ type: "adjust", deltaMs: -TIMER_ADJUST_STEP_MS })}>−1 min</Button>
    <Button type="button" variant="ghost" disabled={!ready || busy || paused} aria-label="Add one minute" onClick={() => void send({ type: "adjust", deltaMs: TIMER_ADJUST_STEP_MS })}>+1 min</Button>
    <Button type="button" variant="ghost" disabled={!ready || busy} onClick={() => void send({ type: "reset" })}>Reset</Button>
    {message && <span role="status" className="oc-timer-change">{message}</span>}
    {changed && <span role="status" className="oc-timer-change">Schedule changed. Reset to use the updated {timing.durationMs / 60000}-minute duration.</span>}
  </div>;
}
