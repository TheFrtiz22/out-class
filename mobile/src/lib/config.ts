import Constants from "expo-constants";
import { Platform } from "react-native";

type Extra = { apiUrl: string; supabaseUrl: string; supabasePublishableKey: string; turnstileSiteKey: string; sentryDsn: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

/** Public configuration only (app.config.ts). The API base URL is configurable per build, so a
 * school subdomain or a staging server needs no code change. */
/** A local development server: the Android emulator reaches the host machine at 10.0.2.2, not localhost. */
function reachable(url: string): string {
  return Platform.OS === "android" ? url.replace(/^http:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, "http://10.0.2.2") : url;
}

export const config = {
  apiUrl: reachable((extra.apiUrl ?? "https://out-class.net").replace(/\/+$/, "")),
  supabaseUrl: extra.supabaseUrl ?? "",
  supabasePublishableKey: extra.supabasePublishableKey ?? "",
  turnstileSiteKey: extra.turnstileSiteKey ?? "",
  sentryDsn: extra.sentryDsn ?? "",
};

/** Hosts whose /q/<code> links the scanner and universal links accept. The host is never a
 * security boundary: the server authorizes every check-in against the signed-in session. */
export const shortLinkHosts = new Set(["out-class.net", "www.out-class.net", ...(() => { try { return [new URL(config.apiUrl).host]; } catch { return []; } })()]);
