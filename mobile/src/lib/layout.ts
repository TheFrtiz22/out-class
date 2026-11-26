import { useSafeAreaFrame } from "react-native-safe-area-context";

/**
 * The app's two size classes, as Apple's iPhone Duo guidance asks ("focus on two size classes: compact width on the
 * outer display and regular width on the inner display"). Compact is every iPhone and the Duo's outer display;
 * regular is the Duo's inner display and iPad, where screens show an extra level of hierarchy (list beside detail).
 * React Native has no size-class API, so it follows the window's width; the frame updates live as the Duo folds,
 * unfolds or rotates and as iPad split view resizes, so nothing is cached at launch.
 */
export type LayoutClass = "compact" | "regular";
/** Widths from here up are regular. iPhones top out near 440pt; the Duo's inner display and iPads start well above. */
export const REGULAR_MIN_WIDTH = 600;

export const layoutClassFor = (width: number): LayoutClass => (width >= REGULAR_MIN_WIDTH ? "regular" : "compact");

export function useLayoutClass(): LayoutClass {
  return layoutClassFor(useSafeAreaFrame().width);
}
