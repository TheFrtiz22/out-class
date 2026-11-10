import type { ReactNode } from "react"
import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout"
import { PersonalSettingsLayout } from "@/components/settings/personal-settings-layout"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedPageLayout><PersonalSettingsLayout>{children}</PersonalSettingsLayout></AuthenticatedPageLayout>
}
