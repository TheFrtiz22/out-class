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
