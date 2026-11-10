import { renderClubShareCard } from "@/lib/club-share-card"
import { SHARE_CARD_SIZE, SHARE_CARD_TYPE } from "@/lib/share-card"

// Link-preview card for a shared club link (Messages, email, Slack, LinkedIn, X).
export const alt = "Club profile on OutClass"
export const size = SHARE_CARD_SIZE
export const contentType = SHARE_CARD_TYPE

export default async function Image({ params }: { params: Promise<{ clubId: string }> }) {
  return renderClubShareCard((await params).clubId)
}
