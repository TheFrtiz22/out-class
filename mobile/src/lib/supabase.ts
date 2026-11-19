import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { config } from "~/lib/config";
import { secureStorage } from "~/lib/secure-storage";

/** Auth only. The app never queries tables or Storage through this client: every private read
 * and write goes through the mobile API with the session's access token. */
export const supabase = createClient(config.supabaseUrl || "https://placeholder.supabase.co", config.supabasePublishableKey || "placeholder", {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

AppState.addEventListener("change", state => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
