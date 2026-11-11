import type { ReactNode } from "react"
import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout"

// The page is a client component, so its title lives here.
export const metadata = { title: "Saved clubs", robots: { index: false, follow: false } }

export default function Layout({ children }: { children: ReactNode }) {
  return <AuthenticatedPageLayout optional>{children}</AuthenticatedPageLayout>
}
