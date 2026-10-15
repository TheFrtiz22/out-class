/** A quiet reading interval surrounds each stop; only the gaps trace the wheel. */
export function orbitOffset(position: number, index: number) {
  const distance = index - position
  const travel = Math.min(1, Math.max(0, (Math.abs(distance) - .22) / .56))
  return Math.sign(distance) * travel * travel * (3 - 2 * travel)
}

export function orbitPose(offset: number, width: number) {
  const angle = offset * .2
  const radius = width * 5.6
  return {
    x: Math.sin(angle) * radius,
    y: (1 - Math.cos(angle)) * radius,
    rotation: -angle * 180 / Math.PI,
    scale: 1 - Math.abs(offset) * .055,
    opacity: 1 - Math.abs(offset) ** 1.35,
  }
}
