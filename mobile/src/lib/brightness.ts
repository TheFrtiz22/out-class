import * as Brightness from "expo-brightness";
import { useEffect } from "react";

/** Raise the screen to full brightness while a code is shown, and put it back afterwards. */
export function useBrightnessBoost() {
  useEffect(() => {
    let previous: number | null = null, live = true;
    Brightness.getBrightnessAsync().then(value => { previous = value; if (live) Brightness.setBrightnessAsync(1).catch(() => {}); }).catch(() => {});
    return () => { live = false; if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {}); };
  }, []);
}
