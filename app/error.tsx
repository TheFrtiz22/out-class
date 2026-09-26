"use client"
import Link from "next/link";

import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-6 py-16">
    <Link href="/" aria-label="OutClass home" className="mb-12 w-fit"><OutClassLogo /></Link>
    <h1 className="font-display text-3xl tracking-tight sm:text-4xl">We couldn’t load this page.</h1>
    <p role="alert" className="mt-4 text-sm leading-relaxed text-muted-foreground">Please try again. If the problem continues, return to OutClass and reopen the page.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/">Return to OutClass</Link></Button></div>
  </main>
}
