import type { ReactNode } from "react"
import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout"

export default function Layout({ children }: { children: ReactNode }) {
  return <AuthenticatedPageLayout allowDemo>{children}</AuthenticatedPageLayout>
}
