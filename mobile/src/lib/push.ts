import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "~/lib/api";
import { reportError } from "~/lib/report";

/**
 * Native push for this device. The device is one more subscription of the web's push path
 * (actions/push-subscriptions.ts): the same preferences decide what is sent, and the server sends
 * one push per event per device. Permission is asked only when the person turns the switch on.
 *
 *   status()  -> whether this device receives push for the signed-in account (the server's row decides)
 *   enable()  -> ask for permission if needed and register; false when it did not turn on
 *   disable() -> stop push for this device
 */
export type PushStatus = "on" | "off" | "denied" | "unavailable";
export type PushControl = { status(): Promise<PushStatus>; enable(): Promise<boolean>; disable(): Promise<void> };

const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

// Foreground: show the banner and add it to the list, as a background push would.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let cachedToken: string | null = null;
/** This device's Expo push token, or null when it cannot have one (no project ID, no push service). */
async function deviceToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!projectId) return null;
  try {
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "OutClass", importance: Notifications.AndroidImportance.DEFAULT });
    cachedToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return cachedToken;
  } catch (error) {
    reportError(error, "push");
    return null;
  }
}

export const push: PushControl = {
  async status() {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return permission.canAskAgain ? "off" : "denied";
    const token = await deviceToken();
    if (!token) return "unavailable";
    try {
      const settings = await api.get<{ enabled: boolean; subscribed: boolean }>("push.settings", { token, platform });
      return !settings.enabled ? "unavailable" : settings.subscribed ? "on" : "off";
    } catch { return "unavailable"; }
  },
  async enable() {
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    const token = await deviceToken();
    if (!token) return false;
    try { await api.post("push.register", { token, platform }); return true; } catch (error) { reportError(error, "push"); return false; }
  },
  async disable() {
    const token = await deviceToken();
    if (!token) return;
    try { await api.post("push.unregister", { token, platform }); } catch (error) { reportError(error, "push"); }
  },
};

/** Best effort before sign-out, so a signed-out phone stops receiving that account's pushes. */
export async function unregisterPushBeforeSignOut() {
  if (!cachedToken && !(await Notifications.getPermissionsAsync()).granted) return;
  await Promise.race([push.disable(), new Promise(resolve => setTimeout(resolve, 2500))]);
}

/** The site path a tapped notification carries (the server's lock-screen-safe payload: `data.url`). */
export function notificationPath(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = (response?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

export const pushSupported = Device.isDevice || Platform.OS === "ios";
