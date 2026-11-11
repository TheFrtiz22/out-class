import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { signInHref } from "@/components/landing/sign-in-card"

/**
 * Shown by old `/vote`, `/live-voting` and board join links that cannot be mapped to a session the
 * viewer may open. The same page for every such link, so it never reveals whether a session exists.
 * `next` is the original link: after signing in, it is resolved again.
 */
export function VotingLinkMoved({ next }: { next: string }) {
  return <div className="vr-page vr-member space-y-4">
    <PageHeader title="Voting has moved" description="Club voting now happens in each club's Voting room." />
    <p>Sign in with your club account to open this session, or go to your club&apos;s Voting room from your club workspace.</p>
    <div className="flex flex-wrap gap-4">
      <Link className="vr-link inline-flex min-h-11 items-center underline underline-offset-4" href={signInHref(next)}>Sign in</Link>
      <Link className="vr-link inline-flex min-h-11 items-center underline underline-offset-4" href="/home">Go to OutClass home</Link>
    </div>
  </div>
}
