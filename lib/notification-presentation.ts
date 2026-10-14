import type { Notification, TrackedApplication } from "@/lib/data"

/** Exact destinations supplied by notifications take precedence over legacy UI actions. */
export function notificationDestination(item: Notification, applications: Pick<TrackedApplication, "clubId" | "status">[] = []) {
  const href = item.taskHref || item.href
  if (href) {
    // Announcements currently target the general inbox. Read them inline rather
    // than moving there; Expand and View all remain the explicit inbox actions.
    const url = new URL(href, "https://outclass.local")
    if (url.searchParams.get("view") === "inbox") return { kind: "detail" } as const
    return { kind: "href", href } as const
  }
  if (item.eventId || item.type === "Interview Invite" || item.locationChange) return { kind: "calendar", eventId: item.eventId } as const
  if (item.cta && item.clubId) return { kind: "application", clubId: item.clubId, view: applications.some(app => app.clubId === item.clubId && app.status === "Drafting") ? "tracker" : "status" } as const
  return { kind: "detail" } as const
}

export function notificationRelativeTime(createdAt: string | undefined, fallback: string, now = Date.now()) {
  const date = Date.parse(createdAt || "")
  if (!Number.isFinite(date)) return fallback
  const seconds = (date - now) / 1000
  if (Math.abs(seconds) < 45) return "Just now"
  const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]] as const
  const [size, unit] = units.find(([size]) => Math.abs(seconds) >= size) || units[units.length - 1]
  return new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" }).format(Math.round(seconds / size), unit)
}

export function notificationFeed(items: Notification[], unreadOnly: boolean) {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return !unreadOnly || !item.read
  }).sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0))
}
