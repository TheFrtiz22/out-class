import type { DemoTimeline } from "./demo-timelines"

export type DemoSample = { elapsed: number; progress: number; state: number; beat: number; movement: number; pressing: number; response: number; viewOpacity: number; label: string; complete: boolean }

export function sampleDemo(timeline: DemoTimeline, elapsed: number): DemoSample {
  const time = Math.max(0, Math.min(timeline.duration, elapsed))
  let state = 0
  let beat = 0
  for (let i = 0; i < timeline.beats.length; i++) {
    if (time >= timeline.beats[i].start) beat = i
    if (time >= timeline.beats[i].respond) state = timeline.beats[i].state
  }
  const current = timeline.beats[beat]
  const response = time < current.respond ? 1 : Math.max(0, Math.min(1, (time - current.respond) / 480))
  const previousState = beat > 0 ? timeline.beats[beat - 1].state : 0
  return { elapsed: time, progress: time / timeline.duration, state, beat,
    movement: Math.max(0, Math.min(1, (time - current.start) / (current.arrive - current.start))),
    pressing: time >= current.press && time < current.clickEnd ? (time - current.press) / (current.clickEnd - current.press) : -1,
    response,
    viewOpacity: timeline.views[state] === timeline.views[previousState] ? 1 : response,
    label: time >= timeline.duration ? "Walkthrough complete" : time < current.start ? "Ready when you are" : current.label,
    complete: time >= timeline.duration }
}

/** A finite clock. Visibility, progress, cursor and interface all share its elapsed time. */
export function createDemoClock(timeline: DemoTimeline, render: (sample: DemoSample) => void, schedule: (callback: (time: number) => void) => number, cancel: (id: number) => void) {
  let elapsed = 0, previous: number | undefined, frame: number | undefined
  let eligible = false, paused = false, disposed = false, reduced = false
  const stop = () => { if (frame !== undefined) cancel(frame); frame = undefined; previous = undefined }
  const paint = () => { if (!disposed) render(sampleDemo(timeline, elapsed)) }
  const tick = (now: number) => {
    frame = undefined
    if (disposed || !eligible || paused || reduced || elapsed >= timeline.duration) return
    // A main-thread hitch must not jump past several actions in one paint.
    if (previous !== undefined) elapsed = Math.min(timeline.duration, elapsed + Math.max(0, Math.min(100, now - previous)))
    previous = now
    paint()
    if (elapsed < timeline.duration) frame = schedule(tick)
    else previous = undefined
  }
  const sync = () => {
    if (!eligible || paused || reduced || disposed || elapsed >= timeline.duration) { stop(); return }
    if (frame === undefined) frame = schedule(tick)
  }
  return {
    setEligible(value: boolean) { eligible = value; sync() },
    setPaused(value: boolean) { paused = value; sync() },
    setReduced(value: boolean) { reduced = value; if (value) { elapsed = timeline.duration; paint() }; sync() },
    replay() { if (disposed) return; stop(); elapsed = reduced ? timeline.duration : 0; paused = false; paint(); sync() },
    sample: () => sampleDemo(timeline, elapsed),
    dispose() { disposed = true; stop() },
  }
}

export type DemoCandidate = { id: string; top: number; height: number }
/** Choose prominence with hysteresis so small scroll changes never swap clocks repeatedly. */
export function prominentDemo(candidates: DemoCandidate[], viewportHeight: number, current?: string): string | undefined {
  const top = 104, bottom = viewportHeight - 24, usable = Math.max(1, bottom - top)
  const ranked = candidates.map(candidate => {
    const visible = Math.max(0, Math.min(bottom, candidate.top + candidate.height) - Math.max(top, candidate.top))
    const fraction = visible / Math.min(candidate.height, usable)
    const center = candidate.top + candidate.height / 2
    const proximity = Math.max(0, 1 - Math.abs(center - (top + usable / 2)) / Math.max(candidate.height, usable))
    return { id: candidate.id, score: fraction < .45 ? 0 : fraction + proximity * .3 }
  }).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score)
  const best = ranked[0], active = ranked.find(candidate => candidate.id === current)
  return active && best && active.score >= best.score * .9 ? active.id : best?.id
}
