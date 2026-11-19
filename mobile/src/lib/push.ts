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

/** Android 13+ shows the permission prompt only once the app has a notification channel. */
async function ensureChannel() {
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "OutClass", importance: Notifications.AndroidImportance.DEFAULT }).catch(() => null);
}

let cachedToken: string | null = null;
/** This device's Expo push token, or null when it cannot have one (no project ID, no push service, an emulator without one). */
async function deviceToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!projectId || !pushSupported) return null;
  try {
    await ensureChannel();
    // Registration waits on the platform's push service, which can stall on a poor connection.
    const result = await Promise.race([Notifications.getExpoPushTokenAsync({ projectId }), new Promise<null>(resolve => setTimeout(() => resolve(null), 15_000))]);
    cachedToken = result?.data ?? null;
    return cachedToken;
  } catch (error) {
    reportError(error, "push");
    return null;
  }
}

/** Whether the system shows this app's notifications (iOS provisional delivery counts). */
const allowed = (permission: Notifications.NotificationPermissionsStatus) =>
  permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

export const push: PushControl = {
  async status() {
    try {
      if (!pushSupported) return "unavailable";
      const permission = await Notifications.getPermissionsAsync();
      if (!allowed(permission)) return permission.canAskAgain ? "off" : "denied";
      const token = await deviceToken();
      if (!token) return "unavailable";
      const settings = await api.get<{ enabled: boolean; subscribed: boolean } | null>("push.settings", { token, platform });
      return !settings?.enabled ? "unavailable" : settings.subscribed ? "on" : "off";
    } catch { return "unavailable"; }
  },
  async enable() {
    try {
      if (!pushSupported) return false;
      await ensureChannel();
      let permission = await Notifications.getPermissionsAsync();
      if (!allowed(permission) && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (!allowed(permission)) return false;
      const token = await deviceToken();
      if (!token) return false;
      await api.post("push.register", { token, platform });
      return true;
    } catch (error) { reportError(error, "push"); return false; }
  },
  async disable() {
    const token = await deviceToken();
    if (!token) return;
    try { await api.post("push.unregister", { token, platform }); } catch (error) { reportError(error, "push"); }
  },
};

/** Best effort before sign-out, so a signed-out phone stops receiving that account's pushes. */
export async function unregisterPushBeforeSignOut() {
  if (!cachedToken && !(await Notifications.getPermissionsAsync().then(allowed, () => false))) return;
  await Promise.race([push.disable(), new Promise(resolve => setTimeout(resolve, 2500))]);
}

/** The site path a tapped notification carries (the server's lock-screen-safe payload: `data.url`). */
export function notificationPath(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = (response?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

/** Real devices, and the iOS Simulator (which can register since Xcode 14). An Android emulator usually has no push service. */
export const pushSupported = Device.isDevice || Platform.OS === "ios";
