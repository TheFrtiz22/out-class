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
] as const
