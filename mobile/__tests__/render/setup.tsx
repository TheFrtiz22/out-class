/* Mocks for the render tests: the mobile API answers from fixtures, the session is signed in,
 * expo-router is a plain in-memory router, and native modules that have no Node build are stubbed. */
import "react-native-gesture-handler/jestSetup";

// Reanimated 4.7's own mock initializes the native module and throws under jest-expo/ios, so a
// small stand-in: shared values are plain objects and animations land on their target at once.
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const RN = require("react-native");
  const land = (to: unknown, _config?: unknown, done?: (finished: boolean) => void) => { if (done) queueMicrotask(() => done(true)); return to; };
  const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, Image: RN.Image, FlatList: RN.FlatList, createAnimatedComponent: (component: unknown) => component };
  const identity = () => (value: unknown) => value;
  // Layout animations (FadeInDown.duration(…).delay(…)) are chainable builders; under test they do nothing.
  const layout: Record<string, unknown> = new Proxy({}, { get: () => () => layout });
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
    FadeIn: { duration: () => ({}) }, FadeOut: { duration: () => ({}) }, LinearTransition: {},
    // What react-native-gesture-handler's GestureDetector reads from Reanimated.
    useEvent: () => () => {}, useComposedEventHandler: () => () => {}, useHandler: () => ({ doDependenciesDiffer: false, context: { lastUpdateEvent: undefined } }),
    isSharedValue: () => false, setGestureState: () => {}, NativeEventsManager: class { attachEvents() {} detachEvents() {} updateEvents() {} },
  };
});
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Swipeable = React.forwardRef(({ children, renderLeftActions, renderRightActions }: { children?: unknown; renderLeftActions?: (...args: unknown[]) => unknown; renderRightActions?: (...args: unknown[]) => unknown }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() }));
    const progress = { value: 0 }, drag = { value: 0 }, methods = { close: jest.fn() };
    return React.createElement(View, null, renderLeftActions?.(progress, drag, methods) ?? null, children, renderRightActions?.(progress, drag, methods) ?? null);
  });
  return { __esModule: true, default: Swipeable };
});

// ---- Mobile API -------------------------------------------------------------------------------
jest.mock("~/lib/api", () => {
  const actual = jest.requireActual("~/lib/api");
  const { resolveFixture } = require("./api-state");
  return {
    ...actual,
    api: {
      get: jest.fn((operation: string, input?: unknown) => resolveFixture("GET", operation, input)),
      post: jest.fn((operation: string, input?: unknown) => resolveFixture("POST", operation, input)),
    },
    authorizedSource: jest.fn(async (path: string) => ({ uri: `https://out-class.test${path}` })),
    mediaSource: jest.fn(async (kind: string) => ({ uri: `https://out-class.test/media/${kind}` })),
  };
});

// ---- Supabase (auth only) ---------------------------------------------------------------------
jest.mock("~/lib/supabase", () => {
  const { session } = require("./session");
  const ok = (data: unknown = {}) => Promise.resolve({ data, error: null });
  const auth: Record<string, unknown> = {
    getSession: jest.fn(() => ok({ session })),
    getUser: jest.fn(() => ok({ user: session.user })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithPassword: jest.fn(() => ok({ session, user: session.user })),
    signUp: jest.fn(() => ok({ session: null, user: session.user })),
    signInWithOtp: jest.fn(() => ok()),
    verifyOtp: jest.fn(() => ok({ session, user: session.user })),
    resetPasswordForEmail: jest.fn(() => ok()),
    updateUser: jest.fn(() => ok({ user: session.user })),
    refreshSession: jest.fn(() => ok({ session })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  const supabase = { auth: new Proxy(auth, { get: (target, key: string) => target[key] ?? jest.fn(() => ok()) }) };
  return { supabase };
});

// ---- expo-router ------------------------------------------------------------------------------
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  const { routerState } = require("./router-state");
  const router = routerState.router;
  const Screen = ({ options }: { options?: Record<string, unknown> }) => {
    // Render header pieces a screen hands to the navigator, so their crashes surface too.
    const pieces = ["headerLeft", "headerRight", "headerTitle"].map(key => options?.[key]).filter((piece): piece is () => unknown => typeof piece === "function");
    return pieces.length ? React.createElement(React.Fragment, null, ...pieces.map((piece, index) => React.createElement(React.Fragment, { key: index }, piece()))) : null;
  };
  const Stack = ({ children }: { children?: unknown }) => React.createElement(React.Fragment, null, children);
  Stack.Screen = Screen;
  Stack.Protected = Stack;
  const Tabs = ({ children, tabBar }: { children?: unknown; tabBar?: (props: unknown) => unknown }) => {
    const names: string[] = [];
    React.Children.forEach(children, (child: { props?: { name?: string } }) => { if (child?.props?.name) names.push(child.props.name); });
    const state = { index: 0, routes: names.map(name => ({ key: `${name}-key`, name })) };
    return React.createElement(React.Fragment, null, children, tabBar ? tabBar({ state, navigation: { navigate: jest.fn(), emit: jest.fn() }, descriptors: {} }) : null);
  };
  Tabs.Screen = Screen;
  const Link = ({ children, href, asChild, ...rest }: { children?: unknown; href: unknown; asChild?: boolean }) =>
    asChild ? children : React.createElement(Pressable, { accessibilityRole: "link", onPress: () => router.push(href), ...rest }, typeof children === "string" ? React.createElement(Text, null, children) : children);
  return {
    __esModule: true,
    router,
    useRouter: () => router,
    useLocalSearchParams: () => routerState.params,
    useGlobalSearchParams: () => routerState.params,
    useSegments: () => routerState.segments,
    usePathname: () => routerState.pathname,
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()), isFocused: () => true, goBack: router.back, canGoBack: router.canGoBack, getParent: () => undefined, dispatch: jest.fn() }),
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Link,
    Redirect: () => null,
    Stack,
    Tabs,
    Slot: ({ children }: { children?: unknown }) => children ?? null,
  };
});

// ---- Native modules ---------------------------------------------------------------------------
// React Native's jest preset leaves these as bare jest.fn(), but the app chains `.catch` on them.
{
  const { Linking, Share } = require("react-native");
  Linking.openURL = jest.fn(async () => true);
  Linking.canOpenURL = jest.fn(async () => true);
  Linking.openSettings = jest.fn(async () => {});
  Share.share = jest.fn(async () => ({ action: "sharedAction" }));
}
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(async () => {}), isLoaded: () => true }));
jest.mock("expo-splash-screen", () => ({ preventAutoHideAsync: jest.fn(async () => true), hideAsync: jest.fn(async () => true), setOptions: jest.fn() }));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { store.delete(key); }),
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    isAvailableAsync: async () => true,
    AFTER_FIRST_UNLOCK: 0, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1, WHEN_UNLOCKED: 2, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  };
});
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-notifications", () => ({
  useLastNotificationResponse: () => null,
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  getDevicePushTokenAsync: jest.fn(async () => ({ data: "device-token", type: "ios" })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setBadgeCountAsync: jest.fn(async () => true),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
}));
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const CameraView = React.forwardRef((props: object, ref: unknown) => React.createElement(View, { ...props, ref, testID: "camera" }));
  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true, status: "granted", canAskAgain: true }, jest.fn(async () => ({ granted: true })), jest.fn(async () => ({ granted: true }))],
    Camera: { requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })), getCameraPermissionsAsync: jest.fn(async () => ({ granted: true })), isAvailableAsync: async () => true },
    scanFromURLAsync: jest.fn(async () => []),
  };
});
jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { GlassView: (props: object) => React.createElement(View, props), GlassContainer: (props: object) => React.createElement(View, props), isLiquidGlassAvailable: () => false, isGlassEffectAPIAvailable: () => false };
});
jest.mock("expo-blur", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { BlurView: (props: object) => React.createElement(View, props) };
});
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy", Soft: "soft", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(async () => 0.5), setBrightnessAsync: jest.fn(async () => {}), restoreSystemBrightnessAsync: jest.fn(async () => {}),
  getSystemBrightnessAsync: jest.fn(async () => 0.5), requestPermissionsAsync: jest.fn(async () => ({ granted: true })), isAvailableAsync: jest.fn(async () => true),
}));
jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn(), activateKeepAwakeAsync: jest.fn(async () => {}), deactivateKeepAwake: jest.fn(async () => {}) }));
jest.mock("expo-calendar", () => ({
  requestCalendarPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted" })),
  getCalendarPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted" })),
  getCalendarsAsync: jest.fn(async () => [{ id: "cal", allowsModifications: true, source: { name: "iCloud" } }]),
  getDefaultCalendarAsync: jest.fn(async () => ({ id: "cal" })),
  createEventAsync: jest.fn(async () => "event-id"),
  createEventInCalendarAsync: jest.fn(async () => ({ action: "saved", id: "event-id" })),
  EntityTypes: { EVENT: "event", REMINDER: "reminder" },
  CalendarAccessLevel: { OWNER: "owner" },
}));
jest.mock("expo-calendar/legacy", () => jest.requireMock("expo-calendar"));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })), requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })), launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  MediaTypeOptions: { Images: "Images" }, UIImagePickerPresentationStyle: {},
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })) }));
jest.mock("expo-quick-actions", () => ({ initial: undefined, setItems: jest.fn(async () => {}), addListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })), openAuthSessionAsync: jest.fn(async () => ({ type: "cancel" })), dismissBrowser: jest.fn(), WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet", AUTOMATIC: "automatic" } }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true), getStringAsync: jest.fn(async () => "") }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock("expo-network", () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }), getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })), addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock("expo-device", () => ({ isDevice: true, osName: "iOS", modelName: "iPhone", deviceName: "iPhone", osVersion: "26.0", brand: "Apple" }));
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const WebView = React.forwardRef((props: object, ref: unknown) => React.createElement(View, { ...props, ref, testID: "webview" }));
  return { __esModule: true, default: WebView, WebView };
});
