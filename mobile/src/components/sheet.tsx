import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui";
import { Text } from "~/components/text";
import { haptics } from "~/lib/haptics";
import { useKeyboardShown } from "~/lib/keyboard";
import { spring } from "~/lib/motion";
import { useTheme } from "~/lib/theme";

/** How long a closing sheet takes to slide out before it is hidden. */
export const SHEET_CLOSE_MS = 240;

// Worklet copies of `project` and `rubberband` (packages/shared/src/motion.ts): the drag runs on the UI
// thread, where calling a plain JavaScript function throws.
function project(velocity: number, decelerationRate = 0.998): number {
  "worklet";
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  "worklet";
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * A bottom sheet that follows the finger and dismisses by dragging, with OutClass physics:
 * it tracks 1:1 downward, rubber-bands upward, and on release the projected landing point
 * (lib/spring.ts `project`) decides between settling open and closing, carrying the gesture's
 * velocity into the spring. The scrim, the system back gesture and the screen reader's escape
 * gesture also close it.
 *
 * The drag starts from the grabber and title strip, so a list or form scrolling inside the
 * sheet keeps its own vertical gesture. The keyboard lifts the sheet on both platforms.
 *
 * Closing is driven from JavaScript, never from an animation's end on the UI thread: the slide
 * out is a fixed-length timing, a timer then stops it and hides the native Modal (visible=false,
 * the dismissal UIKit expects) before the content unmounts. Unmounting a Modal that is still
 * presented, from a UI-thread callback, while its views were being animated, is what closed the
 * app on iOS.
 */
export function Sheet({ open, onClose, title, children, dismissible = true, testID }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; dismissible?: boolean; testID?: string }) {
  const theme = useTheme();
  const { colors, radius, a11y } = theme;
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const keyboard = useKeyboardShown();
  const [mounted, setMounted] = useState(open);
  const offset = useSharedValue(screen);
  const start = useSharedValue(0);
  const reduceMotion = a11y.reduceMotion;

  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (closing.current) { clearTimeout(closing.current); closing.current = null; }
    if (open) { setMounted(true); offset.value = screen; offset.value = spring(0, { reduceMotion }); }
    else if (mounted) {
      const duration = reduceMotion ? 0 : SHEET_CLOSE_MS;
      offset.value = withTiming(screen, { duration });
      closing.current = setTimeout(() => {
        closing.current = null;
        cancelAnimation(offset);
        setMounted(false);
      }, duration + 40);
    }
    // `mounted` is read, not a trigger: closing starts from the open -> false edge only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, reduceMotion]);
  useEffect(() => () => { if (closing.current) clearTimeout(closing.current); cancelAnimation(offset); }, [offset]);
  useEffect(() => { if (open && title) AccessibilityInfo.announceForAccessibility(title); }, [open, title]);

  const requestClose = useCallback(() => { if (dismissible) onClose(); }, [dismissible, onClose]);
  // A sheet dragged away whose owner keeps it open (a save still running) springs back instead of
  // staying open off screen, where its invisible scrim would swallow every touch.
  const isOpen = useRef(open);
  useEffect(() => { isOpen.current = open; }, [open]);
  const dragged = useCallback(() => {
    requestClose();
    setTimeout(() => { if (isOpen.current) offset.value = spring(0, { reduceMotion }); }, SHEET_CLOSE_MS + 80);
  }, [requestClose, offset, reduceMotion]);

  const drag = Gesture.Pan().withTestId("sheet-drag").enabled(dismissible).activeOffsetY([-8, 8]).failOffsetX([-24, 24])
    .onStart(() => { start.value = offset.value; })
    .onChange(event => {
      const next = start.value + event.translationY;
      offset.value = next >= 0 ? next : rubberband(next, screen);
    })
    .onEnd(event => {
      const landing = offset.value + project(event.velocityY);
      // Thrown away: slide out and tell the owner now; the close itself runs from JavaScript.
      if (landing > screen * 0.33) { offset.value = withTiming(screen, { duration: reduceMotion ? 0 : SHEET_CLOSE_MS }); runOnJS(dragged)(); }
      else offset.value = spring(0, { kind: Math.abs(event.velocityY) > 400 ? "thrown" : "ui", velocity: event.velocityY, reduceMotion });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-40, offset.value) }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - offset.value / (screen * 0.6))) }));

  // The Modal stays in the tree and is hidden with `visible`, so it is dismissed the way UIKit
  // expects instead of being torn down while presented; its content goes once it is hidden.
  return (
    <Modal transparent visible={mounted} statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={requestClose}>
      {mounted ? <GestureHandlerRootView style={{ flex: 1 }}>
        {/* "padding" on Android too: the app draws edge to edge, where the window no longer resizes for the keyboard. */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, scrimStyle]}>
            <Pressable testID="sheet-scrim" style={StyleSheet.absoluteFill} onPress={requestClose} accessible={dismissible} accessibilityLabel="Close" accessibilityRole="button" />
          </Animated.View>
          <Animated.View testID={testID} accessibilityViewIsModal onAccessibilityEscape={requestClose}
            style={[{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl2, borderTopRightRadius: radius.xl2, paddingBottom: (keyboard ? 0 : insets.bottom) + 16, paddingHorizontal: 20, maxHeight: screen - insets.top - 24 }, sheetStyle]}>
            <GestureDetector gesture={drag}>
              <View collapsable={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                <View accessible={false} style={{ alignItems: "center", paddingTop: 8, paddingBottom: title ? 12 : 16 }}>
                  <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
                </View>
                {title ? <Text variant="title" accessibilityRole="header" numberOfLines={3} style={{ fontSize: 22, lineHeight: 28, marginBottom: 12 }}>{title}</Text> : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView> : null}
    </Modal>
  );
}

export type ConfirmRequest = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };

/**
 * The in-app confirm sheet: the native counterpart of the web's `useConfirm` dialog, with the
 * same wording passed through. Destructive actions never use a bare system alert.
 */
export function ConfirmSheet({ request, onResolve }: { request: ConfirmRequest | null; onResolve: (confirmed: boolean) => void }) {
  const [last, setLast] = useState<ConfirmRequest | null>(request);
  useEffect(() => { if (request) setLast(request); }, [request]);
  const shown = request ?? last;
  // While the sheet slides away its buttons are still on screen; a late press answers nothing.
  const answer = (confirmed: boolean) => { if (request) onResolve(confirmed); };
  return (
    <Sheet open={!!request} onClose={() => answer(false)} title={shown?.title} testID="confirm-sheet">
      <View style={{ gap: 16 }}>
        {shown?.description ? <Text variant="body">{shown.description}</Text> : null}
        <View style={{ gap: 10 }}>
          <Button full size="large" testID="confirm-accept" variant={shown?.destructive ? "destructive" : "primary"} label={shown?.confirmLabel ?? "Confirm"} onPress={() => { if (request) haptics.save(); answer(true); }} />
          <Button full size="large" testID="confirm-cancel" variant="secondary" label={shown?.cancelLabel ?? "Cancel"} onPress={() => answer(false)} />
        </View>
      </View>
    </Sheet>
  );
}

/** `const { confirm, sheet } = useConfirm()`: render `sheet` once, then `await confirm({...})`. */
export function useConfirm() {
  const [state, setState] = useState<{ request: ConfirmRequest; resolve: (value: boolean) => void } | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const confirm = useCallback((request: ConfirmRequest) => new Promise<boolean>(resolve => {
    // A new question answers an unanswered one with "no", so its caller is never left waiting.
    pending.current?.(false);
    pending.current = resolve;
    setState({ request, resolve });
  }), []);
  // Leaving the screen with the question open counts as "no".
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const sheet = <ConfirmSheet request={state?.request ?? null} onResolve={value => {
    if (state && pending.current === state.resolve) pending.current = null;
    state?.resolve(value);
    setState(null);
  }} />;
  return { confirm, sheet };
}

// Kept for sheets that fade their content in after the spring settles.
export const fadeIn = (duration: number) => withTiming(1, { duration });
