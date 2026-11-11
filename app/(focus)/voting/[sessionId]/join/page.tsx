import { redirect } from "next/navigation"
import { VotingLinkMoved } from "@/components/live-voting/voting-link-moved"
import { liveRoomHrefForLegacyLink } from "@/utils/legacy-voting-link"

export const metadata = { title: "Join live voting", robots: { index: false, follow: false } }

/** Printed QR codes and short links for board sessions resolve here. A live room opens the room; a
 * retired board session opens its read-only history; Demo links never read production data. */
export default async function VotingJoinPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ demo?: string }> }) {
  const { sessionId } = await params, query = await searchParams
  const href = query.demo === "1" ? null : await liveRoomHrefForLegacyLink(sessionId)
  if (href) redirect(href)
  return <VotingLinkMoved next={`/voting/${encodeURIComponent(sessionId)}/join`} />
}
