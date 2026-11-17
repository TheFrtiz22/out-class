"use client"
import { useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@/lib/report-client-error"

/** Workspace page failures stay inside the shell, so navigation and the workspace switcher remain available. */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error])
  return <section className="oc-feedback oc-workspace-stack">
    <PageHeader title="We couldn’t load this page" />
    <p role="alert" className="text-sm leading-relaxed text-muted-foreground">Please try again. If the problem continues, open another page from the menu and come back.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/">Go to OutClass home</Link></Button></div>
  </section>
}
