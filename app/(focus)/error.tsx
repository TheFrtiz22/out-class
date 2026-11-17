"use client"
import { useEffect } from "react"
import { reportClientError } from "@/lib/report-client-error"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"

/** Errors in a focus screen stay inside the frame, so Exit remains available. */
export default function FocusError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error])
  return <div className="space-y-6">
    <PageHeader title="We couldn’t load this page" />
    <p role="alert" className="text-sm leading-relaxed text-muted-foreground">Please try again. If the problem continues, go to the OutClass home page and reopen it.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/">Go to OutClass home</Link></Button></div>
  </div>
}
