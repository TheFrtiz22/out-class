import * as Brightness from "expo-brightness";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

/**
 * Raise the screen to full brightness while a code is shown, and put it back afterwards. On iOS the
 * screen's brightness is system-wide, so it is also put back while the app is in the background. On
 * Android the screen goes back to following the system setting (auto-brightness included) instead of
 * staying at the level it had when the code opened.
 */
export function useBrightnessBoost() {
  useEffect(() => {
    let previous: number | null = null, raised = false;
    const raise = () => {
      if (raised) return;
      raised = true;
      Brightness.getBrightnessAsync().then(value => { previous = value; if (raised) return Brightness.setBrightnessAsync(1); }).catch(() => {});
    };
    const restore = () => {
      if (!raised) return;
      raised = false;
      if (Platform.OS === "android") Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
    raise();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") raise(); else if (state === "background") restore(); });
    return () => { subscription.remove(); restore(); };
  }, []);
}
