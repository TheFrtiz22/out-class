import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import "./sign-in-card.css"

export const signInHref = (next: string) => `/login?next=${encodeURIComponent(next)}`
export const signUpHref = (next: string) => `/signup?next=${encodeURIComponent(next)}`

/**
 * Signed-out entry for a link that needs an account: say what this is, then Sign in / Create
 * account, both returning to `next`. Use `invalid` for links that cannot be used.
 */
export function SignInCard({ eyebrow, title, children, next, invalid = false, createAccount = true }: {
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
  next: string
  invalid?: boolean
  createAccount?: boolean
}) {
  return <section className="oc-sign-in-card" aria-labelledby="sign-in-card-title" data-invalid={invalid || undefined}>
    {eyebrow && <p className="oc-sign-in-card-eyebrow">{eyebrow}</p>}
    <h1 id="sign-in-card-title">{title}</h1>
    {children && <div className="oc-sign-in-card-body">{children}</div>}
    <div className="oc-sign-in-card-actions">
      {invalid
        ? <>
            <Button asChild><Link prefetch={false} href="/">Go to OutClass home<ArrowRight size={16} aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><Link prefetch={false} href={signInHref(next)}>Sign in</Link></Button>
          </>
        : <>
            <Button asChild><Link prefetch={false} href={signInHref(next)}>Sign in<ArrowRight size={16} aria-hidden="true" /></Link></Button>
            {createAccount && <Button asChild variant="outline"><Link prefetch={false} href={signUpHref(next)}>Create account</Link></Button>}
          </>}
    </div>
  </section>
}
