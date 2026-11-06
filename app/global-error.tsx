"use client"
import { useEffect } from "react"
import Link from "next/link"
import { reportClientError } from "@/lib/report-client-error"
import "./globals.css"

/** Root-layout failures replace the whole document, so this page brings its own html and body. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error])
  return <html lang="en"><body className="bg-background text-foreground">
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="oc-page-title">We couldn’t load OutClass.</h1>
      <p role="alert" className="mt-4 text-sm leading-relaxed text-muted-foreground">Please try again. If the problem continues, reload the page.</p>
      <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Try again</button><Link href="/" className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium">Return to OutClass</Link></div>
    </main>
  </body></html>
}
