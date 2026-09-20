import { publicClubs } from "@/lib/public-clubs"
import { PublicClubPage } from "@/components/qr/public-club-page"
export function generateStaticParams() { return publicClubs.map(club => ({ clubId: club.id })) }
export default async function ClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  return <PublicClubPage clubId={clubId} />
}
