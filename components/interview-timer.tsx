"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { countdownRemaining, freshCountdown, parseCountdown, pauseCountdown, type CountdownState } from "@/lib/interview-timer";
import type { InterviewTiming } from "@/lib/interview-session-timing";
import { Button } from "@/components/ui/button";

/** Own ticking state: the question editor and PDF never rerender on timer ticks. */
export function InterviewTimer({ recordId, paused, timing }: { recordId: string; paused: boolean; timing?: InterviewTiming | null }) {
  const { user } = useAuth(), { isDemoEnabled } = useDemoMode();
  const key = user ? `outclass-timer:${isDemoEnabled ? "demo" : "live"}:${user.id}:${recordId}` : null;
  const [state, setState] = useState<CountdownState | null>(null), [now, setNow] = useState(0), [ready, setReady] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const timingRef = useRef(timing); timingRef.current = timing;
  const available = !!timing;
  useEffect(() => {
    const configured = timingRef.current;
    if (!configured) { setReady(false); return; }
    let saved = freshCountdown(configured);
    try { if (key) saved = parseCountdown(localStorage.getItem(key), configured); } catch { /* Usable without storage. */ }
    const at = Date.now();
    if (pausedRef.current || countdownRemaining(saved, at) === 0) saved = pauseCountdown(saved, at);
    setState(saved); setNow(at); setReady(true);
    function sync(e: StorageEvent) {
      if (e.key !== key || !timingRef.current) return;
      const v = parseCountdown(e.newValue, timingRef.current), at = Date.now();
      setNow(at); setState(pausedRef.current ? pauseCountdown(v, at) : v);
    }
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("storage", sync); setReady(false); };
  }, [key, available]);
  useEffect(() => { if (paused) setState(s => s ? pauseCountdown(s, Date.now()) : s); }, [paused]);
  useEffect(() => { if (key && ready && state) try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional browser persistence. */ } }, [key, ready, state]);
  useEffect(() => {
    if (!state || state.startedAt === null) return;
    const tick = () => { const at = Date.now(); setNow(at); setState(s => s && countdownRemaining(s, at) === 0 ? pauseCountdown(s, at) : s); };
    tick(); const timer = setInterval(tick, 1000);
    const wake = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", wake);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", wake); };
  }, [state?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!timing) return <div className="oc-interview-timer" role="status">{timing === undefined ? "Checking interview duration…" : "Interview duration unavailable"}</div>;
  const value = state || freshCountdown(timing), seconds = Math.ceil(countdownRemaining(value, now || Date.now()) / 1000);
  const changed = value.contextKey !== timing.contextKey || value.durationMs !== timing.durationMs;
  return <div className="oc-interview-timer" aria-label="Your interview countdown" data-expired={seconds === 0}>
    <output aria-label="Remaining interview time" aria-live="off">{String(Math.floor(seconds / 60)).padStart(2,"0")}:{String(seconds % 60).padStart(2,"0")}</output>
    {seconds === 0 && <span role="status">Time’s up</span>}
    <Button type="button" variant="ghost" disabled={!ready || paused || !key || seconds === 0} onClick={() => { const at = Date.now(); setNow(at); setState(s => s && (s.startedAt === null ? { ...s, startedAt: at } : pauseCountdown(s, at))); }}>{value.startedAt !== null ? "Pause" : value.remainingMs === value.durationMs ? "Start" : "Resume"}</Button>
    <Button type="button" variant="ghost" disabled={!ready || !key} onClick={() => { setNow(Date.now()); setState(freshCountdown(timing)); }}>Reset</Button>
    {changed && <span role="status" className="oc-timer-change">Schedule changed. Reset to use the updated {timing.durationMs / 60000}-minute duration.</span>}
  </div>;
}
