import Link from "next/link"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
    <Link href="/" aria-label="OutClass home" className="mb-12 w-fit"><OutClassLogo /></Link>
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Page not found</p>
    <h1 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">Let’s find your next step.</h1>
    <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">This link may have changed or the page is no longer available. Return to OutClass to continue.</p>
    <Button asChild className="mt-8 w-fit"><Link href="/">Return to OutClass</Link></Button>
  </main>
}
