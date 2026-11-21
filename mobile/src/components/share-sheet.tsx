import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Platform, Share as NativeShare, View } from "react-native";
import { Check, Copy, Share } from "~/components/icons";
import { QrCode } from "~/components/qr-code";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Skeleton } from "~/components/ui";
import { api } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

export type ShareTarget = {
  /** Public path on the site, the same one the web shares: "/club/<id>" or "/corkboard?event=<id>". */
  path: string;
  /** What is being shared. */
  title: string;
  /** Line sent before the link, e.g. "Check out TAMID on OutClass". */
  text: string;
  /** Small line under the heading. */
  subtitle?: string;
  /** Line under the code. */
  qrDescription?: string;
  /** Ask the server for a short /q link for the code (createShortLink accepts club pages; events have none). */
  shortLink?: boolean;
};

const QR_SIZE = 232;
const SHORT_LINK_WAIT = 4000;

/**
 * The share sheet for a public OutClass page (components/share/share-sheet.tsx): the branded QR code,
 * Copy link, and the device's own share menu. The link is always the public page; the code carries the
 * first-party short link when the server issues one (`share.shortLink`, the web's createShortLink) and
 * the page's own address when it refuses (an alumni account) or does not answer in time, as on the web.
 */
export function ShareSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ShareTarget }) {
  const { colors, radius } = useTheme();
  const url = new URL(target.path, config.apiUrl).toString();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const short = useQuery({
    queryKey: ["share.shortLink", target.path],
    enabled: open && !!target.shortLink,
    // A short link is kept for the session; a miss ("" after a refusal or the wait) is asked again on the next open.
    staleTime: query => (query.state.data ? Infinity : 0),
    retry: false,
    queryFn: () => Promise.race([
      api.post<{ code: string; shortUrl: string }>("share.shortLink", { target: target.path }).then(result => result.shortUrl.startsWith("/") ? `${config.apiUrl}${result.shortUrl}` : "").catch(() => ""),
      new Promise<string>(resolve => setTimeout(() => resolve(""), SHORT_LINK_WAIT)),
    ]),
  });
  const resolving = !!target.shortLink && short.isPending;
  const qrValue = short.data || url;

  useEffect(() => { if (open) { setCopied(false); setStatus(null); } }, [open, target.path]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await Clipboard.setStringAsync(url);
      haptics.save();
      setCopied(true);
      setStatus({ tone: "ok", message: "Link copied." });
    } catch {
      haptics.error();
      setStatus({ tone: "error", message: "Couldn’t copy automatically. Press and hold the link above to copy it." });
    }
  }
  async function share() {
    try {
      // iOS takes the link on its own, so apps that preview links unfurl the page's share card.
      const result = await NativeShare.share(Platform.OS === "ios" ? { message: target.text, url } : { title: target.title, message: `${target.text} ${url}` }, { subject: target.title, dialogTitle: `Share ${target.title}` });
      if (result.action === NativeShare.sharedAction) onClose();
    } catch {
      haptics.error();
      setStatus({ tone: "error", message: "Your device couldn’t open its share menu. Copy the link instead." });
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Share ${target.title}`} testID="share-sheet">
      <View style={{ gap: 14 }}>
        {target.subtitle ? <Text variant="small" style={{ marginTop: -6 }}>{target.subtitle}</Text> : null}
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 4 }}>
          {resolving
            ? <View accessibilityRole="progressbar" accessibilityLabel="Preparing QR code…"><Skeleton width={QR_SIZE} height={QR_SIZE} radius={16} /></View>
            : <QrCode testID="share-qr" value={qrValue} size={QR_SIZE} label={`QR code for ${target.title}`} />}
          {target.qrDescription ? <Text variant="caption" align="center">{target.qrDescription}</Text> : null}
        </View>
        <View accessible accessibilityLabel={`Link, ${url}`} style={{ minHeight: 44, justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text testID="share-link" variant="small" color={colors.foreground} numberOfLines={2} selectable>{url}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button full size="large" testID="share-copy" icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy link"} onPress={() => void copy()} /></View>
          <View style={{ flex: 1 }}><Button full size="large" variant="secondary" testID="share-native" icon={Share} label="Share" onPress={() => void share()} /></View>
        </View>
        <View accessibilityLiveRegion="polite" style={{ minHeight: 20 }}>
          {status ? <Text testID="share-status" variant="small" color={status.tone === "error" ? colors.destructive : colors.mutedForeground} accessibilityRole={status.tone === "error" ? "alert" : undefined}>{status.message}</Text> : null}
        </View>
      </View>
    </Sheet>
  );
}
