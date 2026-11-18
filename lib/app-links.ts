/**
 * Universal links (iOS) and app links (Android) for the native app, net.outclass.app.
 *
 * Only `/q/*` short links are claimed: they are first-party, carry every QR code (check-in,
 * club, voting join) and live on the apex domain for every school. Everything else stays a web
 * link. The host is never a security boundary: the app sends a scanned or opened code to the
 * server, which authorizes it against the signed-in session exactly as the website does.
 *
 * Both files are served only once their identifiers are configured, so an unconfigured
 * deployment answers 404 instead of publishing a placeholder:
 *   OUTCLASS_IOS_APP_ID            "<Apple Team ID>.net.outclass.app"
 *   OUTCLASS_ANDROID_CERT_SHA256   the Play signing certificate fingerprint(s), comma-separated
 */
export const APP_LINK_PATHS = ["/q/*"] as const;

const IOS_APP_ID = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]{1,155}$/;
const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function appleAppSiteAssociation(env: Record<string, string | undefined> = process.env) {
  const appId = env.OUTCLASS_IOS_APP_ID?.trim();
  if (!appId || !IOS_APP_ID.test(appId)) return null;
  return {
    applinks: { details: [{ appIDs: [appId], components: APP_LINK_PATHS.map(path => ({ "/": path, comment: "First-party short links" })) }] },
    // Password AutoFill offers the site's saved OutClass password in the app.
    webcredentials: { apps: [appId] },
  };
}

export function androidAssetLinks(env: Record<string, string | undefined> = process.env) {
  const fingerprints = (env.OUTCLASS_ANDROID_CERT_SHA256 ?? "").split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
  if (!fingerprints.length || !fingerprints.every(value => SHA256_FINGERPRINT.test(value))) return null;
  return [{
    relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
    target: { namespace: "android_app", package_name: "net.outclass.app", sha256_cert_fingerprints: fingerprints },
  }];
}

export function appLinkResponse(body: unknown) {
  if (!body) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
}
