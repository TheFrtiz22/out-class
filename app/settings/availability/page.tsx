import { getMyAvailability } from "@/actions/availability"
import { MyAvailability } from "@/components/availability/my-availability"

export const metadata = { title: "My Availability | OutClass" }
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ roundId?: string; clubId?: string }> }) {
  const params = await searchParams
  const data = await getMyAvailability()
  return <div className="min-w-0"><MyAvailability initial={data.document} rounds={data.rounds} initialRoundId={data.rounds.find(round => (params.roundId ? round.id === params.roundId : true) && round.clubId === params.clubId)?.id} /></div>
}
