"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { freshTimer, parseTimer, pauseTimer, timerElapsed, type InterviewTimerState } from "@/lib/interview-timer";
import { Button } from "@/components/ui/button";

/** Own ticking state: the question editor and PDF do not rerender on timer ticks. */
export function InterviewTimer({ recordId, paused }: { recordId: string; paused: boolean }) {
  const { user } = useAuth();
  const { isDemoEnabled } = useDemoMode();
  const key = user ? `outclass-timer:${isDemoEnabled ? "demo" : "live"}:${user.id}:${recordId}` : null;
  const [state, setState] = useState<InterviewTimerState>(freshTimer), [now, setNow] = useState(0), [ready, setReady] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  useEffect(() => {
    let saved = { ...freshTimer };
    try { if (key) saved = parseTimer(localStorage.getItem(key)); } catch { /* Timer remains usable without browser storage. */ }
    if (paused) saved = pauseTimer(saved, Date.now());
    setState(saved); setNow(Date.now()); setReady(true);
    function sync(e: StorageEvent) { if (e.key === key) { const v = parseTimer(e.newValue); setState(pausedRef.current ? pauseTimer(v, Date.now()) : v); } }
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("storage", sync); setReady(false); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (paused) setState(s => pauseTimer(s, Date.now())); }, [paused]);
  useEffect(() => { if (key && ready) try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Browser-only timer persistence is optional. */ } }, [key, ready, state]);
  useEffect(() => { if (state.startedAt === null) return; setNow(Date.now()); const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [state.startedAt]);
  const seconds = Math.floor(timerElapsed(state, now || Date.now()) / 1000);
  return <div className="oc-interview-timer" aria-label="Your interview timer"><output aria-label="Elapsed interview time" aria-live="off">{String(Math.floor(seconds / 60)).padStart(2,"0")}:{String(seconds % 60).padStart(2,"0")}</output><Button type="button" variant="ghost" disabled={!ready || paused || !key} onClick={() => { const at = Date.now(); setNow(at); setState(s => s.startedAt === null ? { ...s, startedAt: at } : pauseTimer(s, at)); }}>{state.startedAt !== null ? "Pause" : state.elapsed ? "Resume" : "Start"}</Button><Button type="button" variant="ghost" disabled={!ready || !key} onClick={() => { setNow(Date.now()); setState({ ...freshTimer }); }}>Reset</Button></div>;
}
