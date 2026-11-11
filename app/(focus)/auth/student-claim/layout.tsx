import type { ReactNode } from "react"

// The page is a client component, so its title lives here.
export const metadata = { title: "Claim your account", robots: { index: false, follow: false } }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
