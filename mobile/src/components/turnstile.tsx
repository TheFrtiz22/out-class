import { View } from "react-native";
import { WebView } from "react-native-webview";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
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
  if (!config.turnstileSiteKey) return null;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready" async defer></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style></head><body><div id="w"></div>
<script>function ready(){turnstile.render('#w',{sitekey:${JSON.stringify(config.turnstileSiteKey)},theme:${JSON.stringify(dark ? "dark" : "light")},
callback:function(t){window.ReactNativeWebView.postMessage(JSON.stringify({token:t}))},
'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({error:true}))}})}</script></body></html>`;
  return (
    <Sheet open={open} onClose={onClose} title="One quick check">
      <View style={{ gap: 12 }}>
        <Text variant="small">This confirms you're a person before signing in.</Text>
        <WebView
          originWhitelist={["https://*"]}
          source={{ html, baseUrl: "https://www.out-class.net" }}
          style={{ height: 80, backgroundColor: colors.card }}
          scrollEnabled={false}
          incognito
          onMessage={event => {
            try { const data = JSON.parse(event.nativeEvent.data) as { token?: string }; if (typeof data.token === "string" && data.token) onToken(data.token); } catch { /* ignore anything else */ }
          }}
        />
      </View>
    </Sheet>
  );
}
