export type InterviewTimerState = { elapsed: number; startedAt: number | null };
export const freshTimer: InterviewTimerState = { elapsed: 0, startedAt: null };
export function timerElapsed(state: InterviewTimerState, now: number) { return state.elapsed + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)); }
export function pauseTimer(state: InterviewTimerState, now: number): InterviewTimerState { return { elapsed: timerElapsed(state, now), startedAt: null }; }
export function parseTimer(value: string | null): InterviewTimerState {
  try { const v = JSON.parse(value || "null"); if (v && Number.isFinite(v.elapsed) && v.elapsed >= 0 && (v.startedAt === null || Number.isFinite(v.startedAt) && v.startedAt > 0)) return v; } catch { /* Invalid browser state starts fresh. */ }
  return { ...freshTimer };
}
