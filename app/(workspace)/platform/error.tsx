"use client"
import { useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@/lib/report-client-error"

/** Admin page failures stay inside the persistent shell, so the Admin rail and Exit impersonation remain available. */
export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error])
  return <section className="oc-feedback oc-workspace-stack">
    <PageHeader title="Admin couldn’t load this page." />
    <p role="alert" className="text-sm leading-relaxed text-muted-foreground">Please try again. If the problem continues, return to the Admin overview.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/platform">Admin overview</Link></Button></div>
  </section>
}
