import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Design system · OutClass",
  robots: { index: false, follow: false },
}

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return children
}
