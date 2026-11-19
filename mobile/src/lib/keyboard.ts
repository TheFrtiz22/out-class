import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/** Whether the on-screen keyboard is up (iOS reports it as it starts to move, Android once it has). */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}

/**
 * Android only: how far the keyboard reaches into the screen, in points (0 on iOS and while hidden).
 * The app draws edge to edge, where Android no longer shrinks the window for the keyboard, so a
 * scrolling form shrinks itself by this much to keep the focused field above it.
 */
export function useAndroidKeyboardInset(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", event => setHeight(Math.max(0, event.endCoordinates.height)));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
