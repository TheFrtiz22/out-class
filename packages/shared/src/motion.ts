/**
 * Spring and gesture physics for the native app: a React-Native-safe port of lib/spring.ts (the web source;
 * tests/shared-tokens.test.cjs keeps the two in step). No DOM. The web expresses a spring as a linear() easing
 * plus a duration; Reanimated takes the physical constants, so springConfig() derives them from the same
 * response (seconds) and damping ratio.
 */

/** Spring responses in seconds: `ui` for sheets, navigation and layout; `quick` for small controls. */
export const SPRING_RESPONSE = { ui: 0.35, quick: 0.24 } as const;
/** The damping ratio reserved for motion a gesture threw (a flick, a drag release). Everything else uses 1. */
export const SPRING_BOUNCE_DAMPING = 0.8;

/**
 * Reanimated `withSpring` physical config for a spring with the given response (seconds) and damping ratio.
 * Ratio 1 is critically damped (no overshoot); .8 is the bounce variant for thrown gestures.
 */
export function springConfig(response: number, damping = 1): { mass: number; stiffness: number; damping: number } {
  const stiffness = ((2 * Math.PI) / response) ** 2;
  return { mass: 1, stiffness, damping: 2 * damping * Math.sqrt(stiffness) };
}

/** Settle time (to 0.1%) of a critically damped spring with the given response, in seconds. */
export const springDuration = (response: number) => Math.round(response * 1471);
/** Settle time of the damping .8 spring with the given response, in seconds. */
export const bounceDuration = (response: number) => Math.round(response * 1357);

/** Apple's momentum projection: how far a release velocity (px/s) carries before it comes to rest. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further past it, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Release velocity (px/s) from the last ~100ms of pointer samples, so a pause before release reads as still. */
export function createVelocityTracker(windowMs = 100) {
  let samples: { t: number; v: number }[] = [];
  return {
    reset() { samples = []; },
    add(value: number, time: number) {
      samples.push({ t: time, v: value });
      while (samples.length > 2 && time - samples[0].t > windowMs) samples.shift();
    },
    velocity(now = samples.at(-1)?.t ?? 0): number {
      const recent = samples.filter(s => now - s.t <= windowMs);
      if (recent.length < 2) return 0;
      const first = recent[0], last = recent[recent.length - 1];
      const dt = last.t - first.t;
      return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
    },
  };
}
