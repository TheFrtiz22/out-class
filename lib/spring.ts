/**
 * Springs and gesture physics for OutClass motion (.claude/skills/apple-design, Designing Fluid Interfaces).
 * The curves match the --oc-spring tokens in styles/tokens.css. A critically damped spring has one shape at every
 * speed, so one curve serves every duration; damping .8 (SPRING_BOUNCE) is only for motion a gesture threw.
 * Nothing here touches the DOM except liveTranslate, which reads an element's current on-screen transform.
 */
export const SPRING = "linear(0, 0.0576, 0.1806, 0.3213, 0.4558, 0.5736, 0.6717, 0.7507, 0.8127, 0.8606, 0.897, 0.9243, 0.9447, 0.9598, 0.9709, 0.979, 0.9849, 0.9892, 0.9923, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1)";
export const SPRING_BOUNCE = "linear(0, 0.0518, 0.1708, 0.3169, 0.4644, 0.5988, 0.7131, 0.8051, 0.8758, 0.9277, 0.964, 0.988, 1.0028, 1.0109, 1.0145, 1.0151, 1.0141, 1.0121, 1.0099, 1.0077, 1.0057, 1.004, 1.0027, 1.0017, 1)";
/** Settle time (to 0.1%) of a critically damped spring with the given response, in seconds. */
export const springDuration = (response: number) => Math.round(response * 1471);
/** Settle time of the damping .8 spring with the given response, in seconds. */
export const bounceDuration = (response: number) => Math.round(response * 1357);
/** The spring easing where linear() is supported; the house cubic-bezier otherwise. */
export function springEasing(bounce = false): string {
  const supported = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("transition-timing-function", "linear(0, 1)");
  return supported ? (bounce ? SPRING_BOUNCE : SPRING) : "cubic-bezier(.22, 1, .36, 1)";
}

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

/** The element's on-screen translation right now (mid-animation included), read from its computed transform. */
export function liveTranslate(element: Element): { x: number; y: number } {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const m = transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!m) return { x: 0, y: 0 };
  const values = m[2].split(",").map(Number);
  return m[1] ? { x: values[12] || 0, y: values[13] || 0 } : { x: values[4] || 0, y: values[5] || 0 };
}
