"use client"
import { useEffect, useState } from "react"
import { GraduationCap } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DataTable, DataTableSecondary } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { listClubAlumni } from "@/actions/club-alumni"
import { unwrapAction } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { joinFacts } from "@/lib/join-facts"
import type { ClubAlumnus } from "@/lib/club-alumni"

type Page = { clubId: string; alumni: ClubAlumnus[]; page: number; pageSize: number; total: number }
const work = (a: ClubAlumnus) => [a.role, a.employer].filter(Boolean).join(" at ")

/** Members area → Alumni: recent alumni of this club, for current members only (actions/club-alumni.ts). */
export function ClubAlumni({ clubId }: { clubId: string }) {
  const [data, setData] = useState<Page | null>(null)
  const [page, setPage] = useState(0), [error, setError] = useState(""), [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    setError("")
    listClubAlumni({ clubId, page }).then(result => { if (current) setData({ clubId, ...unwrapAction(result) }) })
      .catch(e => { if (current) setError(userMessage(e, "Could not load alumni. Your access may have changed.")) })
    return () => { current = false }
  }, [clubId, page, retry])
  if (error) return <div role="alert" className="space-y-3 text-sm"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Try again</Button></div>
  if (!data || data.clubId !== clubId) return <LoadingState label="Loading alumni…" layout="table" rows={4} />
  if (!data.total) return <EmptyState align="start" density="compact" icon={<GraduationCap />} title="No alumni yet" description="Members who graduate appear here with where they went next." />
  const last = Math.max(0, Math.ceil(data.total / data.pageSize) - 1)
  return <div className="oc-workspace-stack oc-dt-scope">
    <p className="text-sm text-muted-foreground">Visible to current members. Alumni can hide themselves in their settings.</p>
    <DataTable caption="Club alumni, most recent first" rows={data.alumni} rowKey={a => a.id}
      columns={[
        { id: "name", header: "Name", primary: true, cell: a => <span className="oc-dt-name">{a.name}</span>, secondary: a => <DataTableSecondary from="lg">{a.email}</DataTableSecondary> },
        { id: "email", header: "Email", hideFrom: "lg", cell: a => <a className="break-all underline-offset-4 hover:underline" href={`mailto:${a.email}`}>{a.email}</a> },
        { id: "work", header: "Employer and role", cell: a => work(a) || <span className="oc-dt-muted">—</span> },
        { id: "year", header: "Class", showFrom: "md", cell: a => a.gradYear ?? "—" },
      ]}
      card={{ title: a => a.name, meta: a => joinFacts(a.gradYear ? `Class of ${a.gradYear}` : "", work(a), a.email) }} />
    {last > 0 && <nav aria-label="Alumni pages" className="flex flex-wrap items-center gap-3 text-sm">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
      <span aria-live="polite">Page {page + 1} of {last + 1}</span>
      <Button variant="outline" size="sm" disabled={page >= last} onClick={() => setPage(p => Math.min(last, p + 1))}>Next</Button>
    </nav>}
  </div>
}
