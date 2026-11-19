import { Image, type ImageContentFit, type ImageStyle } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState, type ReactNode } from "react";
import type { StyleProp } from "react-native";
import { mediaSource, type MediaKind } from "~/lib/api";

type Params = Record<string, string | undefined>;
type Source = { uri: string; headers?: Record<string, string> };

const STORAGE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/\\%?#]+$/i;

/**
 * The media parameters for a photo value the server returned (lib/profile-photo.ts profilePhotoSource):
 * the signed-in person's own stored path, or the request-scoped `/api/profile-photos?…` address the
 * server builds for a leader surface (club, application and session/round/mode). The scope is the
 * server's; it is passed on unchanged.
 */
export function photoParams(value: string | null | undefined): Params | null {
  if (!value) return null;
  if (value.startsWith("/api/profile-photos?")) {
    const params: Params = {};
    for (const [key, entry] of new URLSearchParams(value.slice(value.indexOf("?") + 1))) params[key] = entry;
    return params.path ? params : null;
  }
  return !value.includes("..") && STORAGE_PATH.test(value) ? { path: value } : null;
}

/**
 * A private image through the mobile media route, sent with this session. `fallback` shows while
 * it loads and when the server refuses. Kept in memory only unless `own` (the signed-in person's
 * own photo): media a leader may see is never written to disk.
 */
export function PrivateImage({ kind, params, style, contentFit = "cover", fallback = null, own = false, accessibilityLabel }: { kind: MediaKind; params: Params | null; style?: StyleProp<ImageStyle>; contentFit?: ImageContentFit; fallback?: ReactNode; own?: boolean; accessibilityLabel?: string }) {
  const key = params ? `${kind}?${JSON.stringify(params)}` : "";
  const [source, setSource] = useState<{ key: string; value: Source } | null>(null);
  const [failed, setFailed] = useState("");
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!key || !params) return;
    let active = true;
    mediaSource(kind, params).then(value => { if (active) setSource({ key, value }); }, () => { if (active) setFailed(key); });
    return () => { active = false; };
    // `key` stands for kind + params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key || failed === key) return <>{fallback}</>;
  const ready = source?.key === key ? source.value : null;
  return (
    <>
      {shown === key ? null : fallback}
      {ready ? (
        <Image source={ready} cachePolicy={own ? "memory-disk" : "memory"} contentFit={contentFit} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}
          style={[style, shown === key ? null : { position: "absolute", opacity: 0 }]} onLoad={() => setShown(key)} onError={() => setFailed(key)} />
      ) : null}
    </>
  );
}

/**
 * Opens a private document (résumé, attachment). The media route answers with a redirect to a
 * short-lived signed address; that final address is opened in the in-app browser. It is never
 * stored or logged. Resolves false when the server refuses or the file is unavailable.
 */
export async function openPrivateDocument(kind: MediaKind, params: Params): Promise<boolean> {
  try {
    const { uri, headers } = await mediaSource(kind, params);
    const response = await fetch(uri, { headers });
    const final = response.url;
    // Only the address is needed; the file itself is left to the browser.
    void response.body?.cancel().catch(() => {});
    // A refusal is answered by the media route itself; only a redirect away from it is a document.
    if (!final || !/^https?:\/\//i.test(final) || new URL(final).origin === new URL(uri).origin) return false;
    await WebBrowser.openBrowserAsync(final, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    return true;
  } catch {
    return false;
  }
}
