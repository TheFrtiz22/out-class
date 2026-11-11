import { z } from "zod"
import { PageHeader } from "@/components/ui/page-header"
import { LegacyVotingHistory } from "@/components/live-voting/legacy-voting-history"
import "@/components/live-voting/room.css"

export const metadata = { title: "Voting history", robots: { index: false, follow: false } }

/** Read-only history of a board (LEGACY) voting session. The client read enforces access. */
export default async function Page({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ clubId?: string; demo?: string }> }) {
  const p = await params, q = await searchParams
  if (!z.string().uuid().safeParse(p.sessionId).success || !z.string().uuid().safeParse(q.clubId).success) return <PageHeader title="Invalid voting session link" />
  return <LegacyVotingHistory clubId={q.clubId!} sessionId={p.sessionId} demoScoped={q.demo === "1"} />
}
