"use client"
import Link from "next/link"
import { ArrowRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useOptionalAuth } from "@/contexts/auth-context"

/** A missing page sends a signed-in visitor back to their Home; only a visitor without a session is offered Sign in. */
export function NotFoundActions() {
  const signedIn = !!useOptionalAuth()?.user
  return <div className="oc-sign-in-card-actions">
    <Button asChild><Link prefetch={false} href={signedIn ? "/home" : "/"}>{signedIn ? "Go to your Home" : "Go to OutClass home"}<ArrowRight size={16} aria-hidden="true" /></Link></Button>
    {!signedIn && <Button asChild variant="outline"><Link prefetch={false} href="/login">Sign in</Link></Button>}
  </div>
}
