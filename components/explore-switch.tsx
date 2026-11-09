"use client"
import Link from "next/link"
import "./explore-switch.css"

/**
 * Phones, as in the OutClass app: Explore holds Clubs and Events (the Corkboard) behind one
 * switch, since the phone bar has no separate Events tab. Hidden at 1024px and wider, where
 * the rail lists both, and outside the signed-in shell (the public Events page).
 */
export function ExploreSwitch({ current }: { current: "clubs" | "events" }) {
  return <nav className="oc-explore-switch" aria-label="Explore">
    <Link href="/explore" prefetch={false} aria-current={current === "clubs" ? "page" : undefined}>Clubs</Link>
    <Link href="/corkboard" prefetch={false} aria-current={current === "events" ? "page" : undefined}>Events</Link>
  </nav>
}
