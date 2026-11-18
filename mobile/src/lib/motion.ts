import { SPRING_BOUNCE_DAMPING, SPRING_RESPONSE, springConfig } from "@outclass/shared/motion";
import { withSpring, withTiming, type WithSpringConfig } from "react-native-reanimated";

/**
 * OutClass motion on Reanimated: the same critically damped springs as the web's --oc-spring
 * tokens (lib/spring.ts). `ui` is the default; `quick` for small controls; `thrown` (damping .8)
 * only for motion a gesture released with velocity. Under Reduce Motion values change at once.
 */
export const springs = {
  ui: springConfig(SPRING_RESPONSE.ui),
  quick: springConfig(SPRING_RESPONSE.quick),
  thrown: springConfig(SPRING_RESPONSE.ui, SPRING_BOUNCE_DAMPING),
} satisfies Record<string, WithSpringConfig>;

export function spring(to: number, options: { kind?: keyof typeof springs; velocity?: number; reduceMotion?: boolean; onDone?: () => void } = {}) {
  "worklet";
  const { kind = "ui", velocity = 0, reduceMotion = false, onDone } = options;
  if (reduceMotion) return withTiming(to, { duration: 0 }, finished => { if (finished && onDone) onDone(); });
  return withSpring(to, { ...springs[kind], velocity }, finished => { if (finished && onDone) onDone(); });
}
