import { redirect } from "next/navigation"
import { LegacyVotingPage } from "@/components/live-voting/legacy-voting-page"
import { liveRoomHrefForLegacyLink } from "@/utils/legacy-voting-link"

export default async function LiveVotingPage({ searchParams }: { searchParams: Promise<{ session?: string | string[] }> }) {
  const { session } = await searchParams
  // An old link to a real live room opens that room, which enforces access; anything else keeps the local preview.
  const href = await liveRoomHrefForLegacyLink(typeof session === "string" ? session : null)
  if (href) redirect(href)
  return <LegacyVotingPage />
}
