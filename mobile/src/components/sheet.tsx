import { project, rubberband } from "@outclass/shared/motion";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui";
import { Text } from "~/components/text";
import { haptics } from "~/lib/haptics";
import { spring } from "~/lib/motion";
import { useTheme } from "~/lib/theme";

/**
 * A bottom sheet that follows the finger and dismisses by dragging, with OutClass physics:
 * it tracks 1:1 downward, rubber-bands upward, and on release the projected landing point
 * (lib/spring.ts `project`) decides between settling open and closing, carrying the gesture's
 * velocity into the spring. The scrim and the system back gesture also close it.
 */
export function Sheet({ open, onClose, title, children, dismissible = true, testID }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; dismissible?: boolean; testID?: string }) {
  const theme = useTheme();
  const { colors, radius, a11y } = theme;
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const offset = useSharedValue(screen);
  const reduceMotion = a11y.reduceMotion;

  const finish = useCallback(() => setMounted(false), []);
  useEffect(() => {
    if (open) { setMounted(true); offset.value = screen; offset.value = spring(0, { reduceMotion }); }
    else if (mounted) offset.value = spring(screen, { reduceMotion, onDone: () => { "worklet"; runOnJS(finish)(); } });
    // `mounted` is read, not a trigger: closing starts from the open -> false edge only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, reduceMotion]);
  useEffect(() => { if (open && title) AccessibilityInfo.announceForAccessibility(title); }, [open, title]);

  const close = useCallback(() => { if (dismissible) onClose(); }, [dismissible, onClose]);
  const drag = Gesture.Pan().enabled(dismissible).activeOffsetY([-8, 8]).failOffsetX([-24, 24])
    .onChange(event => { offset.value = event.translationY >= 0 ? event.translationY : rubberband(event.translationY, screen); })
    .onEnd(event => {
      const landing = offset.value + project(event.velocityY);
      if (landing > screen * 0.33) { offset.value = spring(screen, { kind: "ui", velocity: event.velocityY, reduceMotion, onDone: () => { "worklet"; runOnJS(onClose)(); } }); }
      else offset.value = spring(0, { kind: Math.abs(event.velocityY) > 400 ? "thrown" : "ui", velocity: event.velocityY, reduceMotion });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-40, offset.value) }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - offset.value / (screen * 0.6))) }));

  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, scrimStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
          </Animated.View>
          <GestureDetector gesture={drag}>
            <Animated.View testID={testID} accessibilityViewIsModal style={[{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl2, borderTopRightRadius: radius.xl2, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, maxHeight: screen - insets.top - 24 }, sheetStyle]}>
              <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 12 }}>
                <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
              </View>
              {title ? <Text variant="title" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, marginBottom: 12 }}>{title}</Text> : null}
              {children}
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
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
  return (
    <Sheet open={!!request} onClose={() => onResolve(false)} title={shown?.title} testID="confirm-sheet">
      <View style={{ gap: 16 }}>
        {shown?.description ? <Text variant="body">{shown.description}</Text> : null}
        <View style={{ gap: 10 }}>
          <Button full size="large" testID="confirm-accept" variant={shown?.destructive ? "destructive" : "primary"} label={shown?.confirmLabel ?? "Confirm"} onPress={() => { haptics.save(); onResolve(true); }} />
          <Button full size="large" testID="confirm-cancel" variant="secondary" label={shown?.cancelLabel ?? "Cancel"} onPress={() => onResolve(false)} />
        </View>
      </View>
    </Sheet>
  );
}

/** `const { confirm, sheet } = useConfirm()`: render `sheet` once, then `await confirm({...})`. */
export function useConfirm() {
  const [state, setState] = useState<{ request: ConfirmRequest; resolve: (value: boolean) => void } | null>(null);
  const confirm = useCallback((request: ConfirmRequest) => new Promise<boolean>(resolve => setState({ request, resolve })), []);
  const sheet = <ConfirmSheet request={state?.request ?? null} onResolve={value => { state?.resolve(value); setState(null); }} />;
  return { confirm, sheet };
}

// Kept for sheets that fade their content in after the spring settles.
export const fadeIn = (duration: number) => withTiming(1, { duration });
