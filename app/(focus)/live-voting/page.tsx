import { redirect } from "next/navigation"
import { VotingLinkMoved } from "@/components/live-voting/voting-link-moved"
import { liveRoomHrefForLegacyLink } from "@/utils/legacy-voting-link"

export const metadata = { title: "Live voting", robots: { index: false, follow: false } }

/** Old `/vote` and `/live-voting` links: a session the viewer may open goes to its voting room (or a
 * board session's read-only history); anything else gets one generic page. No browser-local voting. */
export default async function LiveVotingPage({ searchParams }: { searchParams: Promise<{ session?: string | string[] }> }) {
  const { session } = await searchParams
  const id = typeof session === "string" ? session : null
  const href = await liveRoomHrefForLegacyLink(id)
  if (href) redirect(href)
  return <VotingLinkMoved next={id ? `/live-voting?session=${encodeURIComponent(id)}` : "/live-voting"} />
}
