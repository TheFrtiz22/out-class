/* The render tests' stand-in for Reanimated (see setup.tsx). Its own module so a test that loads
 * expo-router's testing library, which installs Reanimated's official mock, can put this one back. */
export function reanimatedMock() {
  const React = require("react");
  const RN = require("react-native");
  const land = (to: unknown, _config?: unknown, done?: (finished: boolean) => void) => { if (done) queueMicrotask(() => done(true)); return to; };
  const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, Image: RN.Image, FlatList: RN.FlatList, createAnimatedComponent: (component: unknown) => component };
  const identity = () => (value: unknown) => value;
  // Layout animations (FadeInDown.duration(…).delay(…)) are chainable builders; under test they do nothing.
  const layout: Record<string, unknown> = new Proxy({}, { get: () => () => layout });
  const frameCallbacks: { callback: unknown; isActive: boolean }[] = [];
  return {
    FadeIn: layout, FadeInDown: layout, FadeInUp: layout, FadeOut: layout,
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial: unknown) => React.useState(() => ({ value: initial, get: () => initial, set: () => {} }))[0],
    useAnimatedStyle: (style: () => object) => style(),
    useAnimatedProps: (props: () => object) => props(),
    useDerivedValue: (value: () => unknown) => ({ value: value() }),
    useAnimatedReaction: () => {},
    // Like the real hook, `autostart` is read once, on the first render; each instance is kept for tests.
    __frameCallbacks: frameCallbacks,
    useFrameCallback: (callback: unknown, autostart = true) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        const instance = { callback, isActive: autostart, callbackId: 0, setActive: (active: boolean) => { instance.isActive = active; } };
        ref.current = instance;
        frameCallbacks.push(instance);
      }
      ref.current.callback = callback;
      return ref.current;
    },
    useAnimatedScrollHandler: () => () => {},
    useAnimatedRef: () => React.useRef(null),
    useReducedMotion: () => false,
    withTiming: land, withSpring: land, withDecay: land,
    withRepeat: (animation: unknown) => animation, withDelay: (_delay: number, animation: unknown) => animation, withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    runOnJS: (fn: unknown) => fn, runOnUI: (fn: unknown) => fn, scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args), cancelAnimation: () => {},
    interpolate: (value: number) => value, interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Easing: new Proxy({}, { get: () => identity }),
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    LinearTransition: {},
    // What react-native-gesture-handler's GestureDetector reads from Reanimated.
    useEvent: () => () => {}, useComposedEventHandler: () => () => {}, useHandler: () => ({ doDependenciesDiffer: false, context: { lastUpdateEvent: undefined } }),
    isSharedValue: () => false, setGestureState: () => {}, NativeEventsManager: class { attachEvents() {} detachEvents() {} updateEvents() {} },
  };
}
