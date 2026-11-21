import { requireOptionalNativeModule } from "expo";

type DevMenuModule = { setToolsButtonVisible?: (visible: boolean) => Promise<void> | void };

/**
 * Development builds draw a floating gear (the developer menu's "tools button") over every screen.
 * It sits on top of headers and cards and is easy to mistake for part of the app, so it starts hidden.
 * Shaking the phone still opens the developer menu. Set EXPO_PUBLIC_SHOW_DEV_TOOLS_BUTTON=1 to keep it.
 * Release builds never draw it, and the module call is skipped there.
 */
export function hideDevToolsButton(
  dev: boolean = __DEV__,
  keep: string | undefined = process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS_BUTTON,
  load: () => DevMenuModule | null = () => requireOptionalNativeModule<DevMenuModule>("ExpoDevMenu"),
): boolean {
  if (!dev || keep === "1" || keep === "true") return false;
  try {
    const devMenu = load();
    if (typeof devMenu?.setToolsButtonVisible !== "function") return false;
    Promise.resolve(devMenu.setToolsButtonVisible(false)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
