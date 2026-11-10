/** A quiet reading interval surrounds each stop; only the gaps trace the wheel. */
export function orbitOffset(position: number, index: number) {
  const distance = index - position
  const travel = Math.min(1, Math.max(0, (Math.abs(distance) - .22) / .56))
  return Math.sign(distance) * travel * travel * (3 - 2 * travel)
}

/**
 * A flat crossfade: panels stay upright and full width (nothing tilts or slides off the edge), drift
 * slightly vertically, and are fully transparent by the midpoint between stops, so only one panel is
 * ever visible. `width` is kept for callers; the pose no longer depends on it.
 */
export function orbitPose(offset: number, _width?: number) {
  return {
    x: 0,
    y: offset * 40,
    rotation: 0,
    scale: 1 - Math.abs(offset) * .04,
    opacity: Math.max(0, 1 - Math.abs(offset) * 2),
  }
}

/** Pinned scroll per stop: the whole run stays within about 2,500px however many stops there are. */
export const ORBIT_MAX_RUN = 2500
export function orbitStep(count: number, viewportHeight: number) {
  return Math.min(Math.max(420, viewportHeight * .6), ORBIT_MAX_RUN / (count - 1 + .35))
}
