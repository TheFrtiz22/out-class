export type InterviewTimerState = { elapsed: number; startedAt: number | null };
export const freshTimer: InterviewTimerState = { elapsed: 0, startedAt: null };
export type CountdownState = { version: 2; durationMs: number; remainingMs: number; startedAt: number | null; contextKey: string };
export function freshCountdown(timing: { durationMs: number; contextKey: string }): CountdownState { return { version: 2, ...timing, remainingMs: timing.durationMs, startedAt: null }; }
export function countdownRemaining(state: CountdownState, now: number) { return Math.max(0, state.remainingMs - (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt))); }
export function pauseCountdown(state: CountdownState, now: number): CountdownState { return { ...state, remainingMs: countdownRemaining(state, now), startedAt: null }; }
export function parseCountdown(value: string | null, timing: { durationMs: number; contextKey: string }): CountdownState {
  try {
    const v = JSON.parse(value || "null"), validStart = v && (v.startedAt === null || Number.isFinite(v.startedAt) && v.startedAt > 0);
    if (validStart && v.version === 2 && Number.isFinite(v.durationMs) && v.durationMs > 0 && v.durationMs <= 180 * 60000 && Number.isFinite(v.remainingMs) && v.remainingMs >= 0 && v.remainingMs <= v.durationMs && typeof v.contextKey === "string") return v;
    // Convert the existing own-session stopwatch against this authorized duration.
    if (validStart && v.version === undefined && Number.isFinite(v.elapsed) && v.elapsed >= 0) return { ...freshCountdown(timing), remainingMs: Math.max(0, timing.durationMs - v.elapsed), startedAt: v.startedAt };
  } catch { /* Invalid browser state starts from the authorized duration. */ }
  return freshCountdown(timing);
}
export function timerElapsed(state: InterviewTimerState, now: number) { return state.elapsed + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)); }
export function pauseTimer(state: InterviewTimerState, now: number): InterviewTimerState { return { elapsed: timerElapsed(state, now), startedAt: null }; }
export function parseTimer(value: string | null): InterviewTimerState {
  try { const v = JSON.parse(value || "null"); if (v && Number.isFinite(v.elapsed) && v.elapsed >= 0 && (v.startedAt === null || Number.isFinite(v.startedAt) && v.startedAt > 0)) return v; } catch { /* Invalid browser state starts fresh. */ }
  return { ...freshTimer };
}
