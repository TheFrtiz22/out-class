import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button } from "~/components/ui";
import { config } from "~/lib/config";
import { useTheme } from "~/lib/theme";

/**
 * Cloudflare Turnstile for native sign-in (docs/turnstile.md). Supabase Auth verifies the token,
 * so the app only has to obtain one: the widget runs in a WebView whose page origin is the site
 * the widget is registered for, and posts the token back. Nothing else is loaded or shared, and
 * the token is used once and never stored or logged.
 */
export function TurnstileSheet({ open, onClose, onToken }: { open: boolean; onClose: () => void; onToken: (token: string) => void }) {
  const { dark, colors } = useTheme();
  // "loading" until the widget draws; a widget or page that fails says so and offers a fresh attempt.
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (open) setState("loading"); }, [open]);
  if (!config.turnstileSiteKey) return null;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready" async defer></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style></head><body><div id="w"></div>
<script>function ready(){turnstile.render('#w',{sitekey:${JSON.stringify(config.turnstileSiteKey)},theme:${JSON.stringify(dark ? "dark" : "light")},
callback:function(t){window.ReactNativeWebView.postMessage(JSON.stringify({token:t}))},
'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({error:true}))},
'expired-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({error:true}))}});window.ReactNativeWebView.postMessage(JSON.stringify({ready:true}))}</script></body></html>`;
  return (
    <Sheet open={open} onClose={onClose} title="One quick check">
      <View style={{ gap: 12 }}>
        <Text variant="small">This confirms you're a person before signing in.</Text>
        {state === "failed" ? (
          <View accessibilityRole="alert" style={{ gap: 10 }}>
            <Text variant="small" color={colors.destructive}>The check didn’t load. Check your connection and try again.</Text>
            <Button variant="secondary" label="Try again" onPress={() => { setState("loading"); setAttempt(count => count + 1); }} />
          </View>
        ) : (
          <View style={{ height: 80, justifyContent: "center" }}>
            <WebView
              key={attempt}
              originWhitelist={["https://*"]}
              source={{ html, baseUrl: "https://www.out-class.net" }}
              style={{ height: 80, backgroundColor: colors.card }}
              scrollEnabled={false}
              incognito
              onError={() => setState("failed")}
              onHttpError={() => setState("failed")}
              onMessage={event => {
                try {
                  const data = JSON.parse(event.nativeEvent.data) as { token?: unknown; error?: unknown; ready?: unknown };
                  if (typeof data.token === "string" && data.token) onToken(data.token);
                  else if (data.error) setState("failed");
                  else if (data.ready) setState("ready");
                } catch { /* ignore anything else */ }
              }}
            />
            {state === "loading" ? <ActivityIndicator accessibilityLabel="Loading the check" color={colors.mutedForeground} style={{ position: "absolute", alignSelf: "center" }} /> : null}
          </View>
        )}
      </View>
    </Sheet>
  );
}
