"use client"
import Link from "next/link"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import "@/components/landing/sign-in-card.css"

/** Catches errors on public and signed-in routes alike, so it carries no account-specific header. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
    <Link href="/" aria-label="OutClass home" className="mb-10 inline-flex min-h-11 w-fit items-center"><OutClassLogo /></Link>
    <section className="oc-sign-in-card w-full" aria-labelledby="error-title">
      <h1 id="error-title">We couldn’t load this page</h1>
      <div className="oc-sign-in-card-body"><p role="alert">Please try again. If it keeps happening, go back to the OutClass home page and reopen it.</p></div>
      <div className="oc-sign-in-card-actions">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild><Link href="/">Go to OutClass home</Link></Button>
      </div>
    </section>
  </main>
}
