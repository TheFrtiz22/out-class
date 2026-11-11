import { z } from "zod";
import type { InterviewTiming } from "@/lib/interview-session-timing";

/** One shared countdown per interview room. Remaining time is always derived
 * from server timestamps; no device keeps its own counter. */
export const TIMER_MAX_DURATION_MS = 240 * 60_000;
export const TIMER_ADJUST_STEP_MS = 60_000;
// Rebase long pauses so the accumulated pause stays well inside a 32-bit column.
const PAUSED_MS_REBASE = 7 * 86_400_000;

export type SharedTimerState = { durationMs: number; contextKey: string; startedAt: number | null; pausedAt: number | null; pausedMs: number };
/** Server read: `serverNow` is the server clock when the state was read. */
export type SharedTimerView = SharedTimerState & { revision: number; serverNow: number };
export type TimerCommand = { type: "start" } | { type: "pause" } | { type: "resume" } | { type: "reset" } | { type: "adjust"; deltaMs: number };
export type TimerControlResult = { status: "ok" | "conflict"; timer: SharedTimerView | null };

export const timerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("pause") }).strict(),
  z.object({ type: z.literal("resume") }).strict(),
  z.object({ type: z.literal("reset") }).strict(),
  z.object({ type: z.literal("adjust"), deltaMs: z.number().int().min(-60 * 60_000).max(60 * 60_000).refine(v => v !== 0 && v % 1000 === 0, "Adjust by whole seconds.") }).strict(),
]);

export function freshTimerState(timing: Pick<InterviewTiming, "durationMs" | "contextKey">): SharedTimerState {
  return { durationMs: timing.durationMs, contextKey: timing.contextKey, startedAt: null, pausedAt: null, pausedMs: 0 };
}
export function timerElapsedMs(state: SharedTimerState, now: number) {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.pausedAt ?? now) - state.startedAt - state.pausedMs);
}
export function timerRemainingMs(state: SharedTimerState, now: number) { return Math.max(0, state.durationMs - timerElapsedMs(state, now)); }
export function timerPhase(state: SharedTimerState): "ready" | "running" | "paused" {
  return state.startedAt === null ? "ready" : state.pausedAt === null ? "running" : "paused";
}

/** Pure transition. Returns null when the command does not apply to this state
 * (another device already changed it); the caller then returns current state. */
export function applyTimerCommand(state: SharedTimerState, command: TimerCommand, now: number, timing: Pick<InterviewTiming, "durationMs" | "contextKey">): SharedTimerState | null {
  const phase = timerPhase(state);
  switch (command.type) {
    case "start": return phase === "ready" ? { ...state, startedAt: now, pausedAt: null, pausedMs: 0 } : null;
    case "pause": return phase === "running" ? { ...state, pausedAt: Math.max(now, state.startedAt!) } : null;
    case "resume": {
      if (phase !== "paused") return null;
      const pausedMs = state.pausedMs + Math.max(0, now - state.pausedAt!);
      if (pausedMs < PAUSED_MS_REBASE) return { ...state, pausedAt: null, pausedMs };
      return { ...state, startedAt: now - timerElapsedMs(state, now), pausedAt: null, pausedMs: 0 };
    }
    case "reset": return freshTimerState(timing);
    case "adjust": {
      // Adds to or removes from what is left: an expired timer given +1 min shows 01:00.
      // Remaining never drops below 00:00 (or 01:00 before start); total never passes the cap.
      const elapsed = timerElapsedMs(state, now), floor = phase === "ready" ? TIMER_ADJUST_STEP_MS : 0;
      const remaining = Math.max(floor, timerRemainingMs(state, now) + command.deltaMs);
      const durationMs = Math.min(TIMER_MAX_DURATION_MS, elapsed + remaining);
      if (elapsed + remaining > TIMER_MAX_DURATION_MS && phase !== "ready") {
        // Long past expiry (or a very long session): count again from now, so the
        // new remaining time shows and the cap applies to what is left, not to time already spent.
        return { ...state, startedAt: now, pausedAt: phase === "paused" ? now : null, pausedMs: 0, durationMs: Math.min(TIMER_MAX_DURATION_MS, remaining) };
      }
      return durationMs === state.durationMs ? null : { ...state, durationMs };
    }
  }
}

/** The timer read model. Before anyone presses a control, the room shows the
 * authorized schedule duration at revision 0 (no row exists yet). */
export function presentTimer(row: { durationMs: number; contextKey: string; startedAt: Date | null; pausedAt: Date | null; pausedMs: number; revision: number } | null, timing: InterviewTiming | null, serverNow: number): SharedTimerView | null {
  if (!row) return timing ? { ...freshTimerState(timing), revision: 0, serverNow } : null;
  return { durationMs: row.durationMs, contextKey: row.contextKey, startedAt: row.startedAt ? +row.startedAt : null, pausedAt: row.pausedAt ? +row.pausedAt : null, pausedMs: row.pausedMs, revision: row.revision, serverNow };
}

/** NTP-style estimate: the server read happened roughly halfway through the request. */
export function clockOffsetMs(serverNow: number, sentAt: number, receivedAt: number) { return serverNow - (sentAt + receivedAt) / 2; }

/** Keep the newest server state; equal revisions prefer the later read. */
export function newerTimer(current: SharedTimerView | null, incoming: SharedTimerView | null | undefined) {
  if (!incoming) return current;
  if (!current || incoming.contextKey !== current.contextKey && incoming.revision === 0 && current.revision === 0) return incoming;
  if (incoming.revision !== current.revision) return incoming.revision > current.revision ? incoming : current;
  return incoming.serverNow >= current.serverNow ? incoming : current;
}
