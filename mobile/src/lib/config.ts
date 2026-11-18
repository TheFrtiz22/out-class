import Constants from "expo-constants";

type Extra = { apiUrl: string; supabaseUrl: string; supabasePublishableKey: string; turnstileSiteKey: string; sentryDsn: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

/** Public configuration only (app.config.ts). The API base URL is configurable per build, so a
 * school subdomain or a staging server needs no code change. */
export const config = {
  apiUrl: (extra.apiUrl ?? "https://out-class.net").replace(/\/+$/, ""),
  supabaseUrl: extra.supabaseUrl ?? "",
  supabasePublishableKey: extra.supabasePublishableKey ?? "",
  turnstileSiteKey: extra.turnstileSiteKey ?? "",
  sentryDsn: extra.sentryDsn ?? "",
};

/** Hosts whose /q/<code> links the scanner and universal links accept. The host is never a
 * security boundary: the server authorizes every check-in against the signed-in session. */
export const shortLinkHosts = new Set(["out-class.net", "www.out-class.net", new URL(config.apiUrl).host]);
