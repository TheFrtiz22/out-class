import { emailSiteOrigin } from "@/lib/transactional-email"

type Env = Record<string, string | undefined>

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
const isOutClassHost = (host: string) => host === "out-class.net" || host.endsWith(".out-class.net")

/**
 * Origin for absolute links that leave the site and come back, such as password
 * reset emails and OAuth callbacks. The configured OUTCLASS_SITE_URL always wins.
 * Only development and Vercel preview deployments, where it is unset, use the
 * request's own origin, and only for a host that belongs to this deployment.
 * Returns null when no trustworthy origin is available.
 */
export function authRedirectOrigin(requestOrigin: string, env: Env = process.env): string | null {
  const configured = env.OUTCLASS_SITE_URL?.trim()
  if (configured) {
    try { return emailSiteOrigin(configured) } catch { return null }
  }
  const development = env.VERCEL_ENV === "development" || (!env.VERCEL_ENV && env.NODE_ENV === "development")
  const preview = env.VERCEL_ENV === "preview"
  if (!development && !preview) return null
  let url: URL
  try { url = new URL(requestOrigin) } catch { return null }
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (development && LOOPBACK_HOSTS.has(host) && (url.protocol === "http:" || url.protocol === "https:")) return url.origin
  if (url.protocol !== "https:") return null
  if (isOutClassHost(host)) return url.origin
  const deploymentHosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].map(value => value?.trim().toLowerCase()).filter(Boolean)
  return preview && deploymentHosts.includes(url.host.toLowerCase()) ? url.origin : null
}
