import Link from "next/link"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { CONTACT_EMAIL, CONTACT_HREF } from "@/lib/legal-content"
import { AccountUnavailableSignOut } from "./account-unavailable-sign-out"
import "@/components/landing/sign-in-card.css"

/** Shown instead of any account page when the signed-in account is disabled (same card as the error page). */
export function AccountUnavailable() {
  return <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
    <Link prefetch={false} href="/" aria-label="OutClass home" className="mb-10 inline-flex min-h-11 w-fit items-center"><OutClassLogo /></Link>
    <section className="oc-sign-in-card w-full" aria-labelledby="account-unavailable-title">
      <h1 id="account-unavailable-title">Your account is unavailable</h1>
      <div className="oc-sign-in-card-body"><p>This account can’t be used right now. If you think this is a mistake, contact OutClass support at <a className="font-medium text-foreground underline underline-offset-4" href={CONTACT_HREF}>{CONTACT_EMAIL}</a>.</p></div>
      <div className="oc-sign-in-card-actions">
        <AccountUnavailableSignOut />
        <Button asChild variant="outline"><a href={CONTACT_HREF}>Contact support</a></Button>
      </div>
    </section>
  </main>
}
