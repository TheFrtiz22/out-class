"use client";
import { useEffect, useRef, useState } from "react";
import { controlInterviewTimer } from "@/lib/workspace-api";
import { clockOffsetMs, freshTimerState, newerTimer, timerPhase, timerRemainingMs, TIMER_ADJUST_STEP_MS, type SharedTimerView, type TimerCommand } from "@/lib/interview-shared-timer";
import type { InterviewScope } from "@/lib/interview-access";
import type { InterviewTiming } from "@/lib/interview-session-timing";
import { Button } from "@/components/ui/button";
import { isAccessRevoked } from "@/lib/action-result";

type Shared = SharedTimerView & { clockOffsetMs?: number };

/** The room's shared countdown. State lives on the server (one per interview room);
 * this device only keeps its clock offset and the newest revision it has seen.
 * Own ticking state: the question editor and PDF never rerender on timer ticks. */
/** `onAccessRevoked` (optional) takes over when the server refuses with ACCESS_REVOKED: the room shows
 * its access-removed state instead of "Couldn’t update the timer"; the controls stay disabled. */
export function InterviewTimer({ scope, paused, timing, shared, onAccessRevoked }: { scope: InterviewScope; paused: boolean; timing?: InterviewTiming | null; shared?: Shared | null; onAccessRevoked?: () => void }) {
  const [state, setState] = useState<Shared | null>(null), [offset, setOffset] = useState(0), [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const mounted = useRef(true), revoked = useRef(false), revokedHandler = useRef(onAccessRevoked);
  revokedHandler.current = onAccessRevoked;
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
    if (!state || busy || revoked.current) return;
    setBusy(true); setMessage("");
    try {
      const sentAt = Date.now();
      const result = await controlInterviewTimer({ ...scope, revision: state.revision, requestId: crypto.randomUUID(), command });
      if (!mounted.current) return;
      if (result.timer) { const timer = { ...result.timer, clockOffsetMs: clockOffsetMs(result.timer.serverNow, sentAt, Date.now()) }; setState(old => newerTimer(old, timer) as Shared | null); setOffset(timer.clockOffsetMs); }
      if (result.status === "conflict") setMessage("Timer changed on another device. Showing the current time.");
      setNow(Date.now());
    } catch (failure) {
      // Removed from the panel: hand off once to the room. A refusal arriving after this timer closed is ignored.
      if (isAccessRevoked(failure) && revokedHandler.current) { if (mounted.current && !revoked.current) { revoked.current = true; revokedHandler.current(); } return; }
      if (mounted.current) setMessage("Couldn’t update the timer. Check your connection and try again.");
    }
    finally { if (mounted.current && !revoked.current) setBusy(false); }
  }
  // Red in the final minute (display only; the shared timer state is unchanged).
  return <div className="oc-interview-timer" aria-label="Shared interview countdown" aria-busy={busy} data-expired={seconds === 0} data-low={seconds > 0 && seconds <= 60}>
    <output aria-label="Remaining interview time" aria-live="off"><span className="sr-only">{clock(seconds)}</span><TimerDigits text={clock(seconds)} /></output>
    {seconds === 0 && <span role="status">Time’s up</span>}
    {!paused && <>
    <Button type="button" className="oc-timer-primary" disabled={!ready || busy || paused || (phase !== "running" && seconds === 0)} onClick={() => void send({ type: phase === "ready" ? "start" : phase === "running" ? "pause" : "resume" })}>{phase === "running" ? "Pause" : phase === "ready" ? "Start" : "Resume"}</Button>
    <Button type="button" variant="outline" disabled={!ready || busy || paused || seconds === 0} aria-label="Remove one minute" onClick={() => void send({ type: "adjust", deltaMs: -TIMER_ADJUST_STEP_MS })}>−1 min</Button>
    <Button type="button" variant="outline" disabled={!ready || busy || paused} aria-label="Add one minute" onClick={() => void send({ type: "adjust", deltaMs: TIMER_ADJUST_STEP_MS })}>+1 min</Button>
    <Button type="button" variant="outline" disabled={!ready || busy || paused} onClick={() => void send({ type: "reset" })}>Reset</Button>
    </>}
    {message && <span role="status" className="oc-timer-change">{message}</span>}
    {changed && <span role="status" className="oc-timer-change">Schedule changed. Reset to use the updated {timing.durationMs / 60000}-minute duration.</span>}
  </div>;
}

function clock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

/** Visual digits only (the sr-only text above is what assistive technology reads). Each changed digit blurs
 * and slides out while the new one springs in; changed digits cascade 50 ms apart, left to right. */
function TimerDigits({ text }: { text: string }) {
  const previous = useRef(text);
  let order = 0;
  const delays = [...text].map((char, i) => char !== previous.current[i] ? order++ * 50 : 0);
  useEffect(() => { previous.current = text; }, [text]);
  return <span className="oc-timer-digits" aria-hidden="true">{[...text].map((char, i) => char === ":" ? <span key={i} className="oc-timer-separator">:</span> : <TimerDigit key={i} value={char} delayMs={delays[i]} />)}</span>;
}

function TimerDigit({ value, delayMs }: { value: string; delayMs: number }) {
  // Derived state, set during render: the outgoing digit and the delay belong to the change that produced them.
  const [state, setState] = useState({ value, previous: null as string | null, change: 0, delay: 0 });
  if (state.value !== value) setState({ value, previous: state.value, change: state.change + 1, delay: delayMs });
  const style = { animationDelay: `${state.delay}ms` };
  // The outgoing digit leaves when its animation ends; the timeout covers an animation that never runs or ends.
  const clear = () => setState(s => s.change === state.change ? { ...s, previous: null } : s);
  useEffect(() => {
    if (state.previous === null) return;
    const change = state.change, timer = setTimeout(() => setState(s => s.change === change ? { ...s, previous: null } : s), state.delay + 700);
    return () => clearTimeout(timer);
  }, [state.previous, state.change, state.delay]);
  return <span className="oc-timer-digit">
    {state.previous !== null && <span key={`out-${state.change}`} className="oc-timer-digit-layer" data-motion="out" style={style} onAnimationEnd={clear}>{state.previous}</span>}
    <span key={`in-${state.change}`} className="oc-timer-digit-layer" data-motion={state.change ? "in" : undefined} style={style}>{state.value}</span>
  </span>;
}
