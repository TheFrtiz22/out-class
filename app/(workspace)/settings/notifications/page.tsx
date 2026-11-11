import { redirect } from "next/navigation"
import { notificationSettingsHref } from "@/lib/settings-navigation"

export const metadata = { title: "Notifications" }

/** Notification settings moved to the Inbox (a sheet from its header). Old links and bookmarks keep working. */
export default function Page() { redirect(notificationSettingsHref) }
