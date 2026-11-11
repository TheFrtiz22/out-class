/**
 * Notification and email-digest preferences live in the Inbox, as a drawer opened from its header.
 * `/inbox?tab=preferences` is the one address: emails already link there, and `/settings/notifications` redirects to it.
 */
export const notificationSettingsHref = "/inbox?tab=preferences"
export const isNotificationSettingsOpen = (params: { get(name: string): string | null }) => params.get("tab") === "preferences"

export const personalSettingsSections = [
  { id: "account", label: "Account & Security", href: "/settings/account", description: "Your sign-in information and account security." },
  { id: "notifications", label: "Notifications", href: notificationSettingsHref, description: "Choose which club updates and reminders reach your email." },
  { id: "availability", label: "Availability", href: "/settings/availability", description: "Keep one availability schedule across all your clubs." },
  // Any signed-in account; the page reads only that account's own approved panel assignments (getMyInterviewPanelSchedule).
  { id: "interviews", label: "Interview schedule", href: "/settings/interviews", description: "Your approved interview panels across all your clubs." },
] as const

/** The Settings page a pathname shows. Notifications lives in the Inbox, so it is never the active Settings page. */
export const personalSettingsSectionFor = (pathname: string) => personalSettingsSections.find(section => section.href.startsWith("/settings/") && section.href === pathname)

/**
 * Demo Mode never reads or writes real notification preferences (like Cmd-K and the Inbox gear), so it hides that entry,
 * and it hides the interview schedule, which reads real panel assignments.
 */
export const visiblePersonalSettingsSections = (demo: boolean) => personalSettingsSections.filter(section => !demo || (section.id !== "notifications" && section.id !== "interviews"))
