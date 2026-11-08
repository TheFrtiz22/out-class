import type { ReactNode } from "react"
import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout"

export default function Layout({ children }: { children: ReactNode }) {
  // Signed-out visitors see the page's sign-in card in the public frame; the page keeps its own auth checks.
  return <AuthenticatedPageLayout optional>{children}</AuthenticatedPageLayout>
}
