import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { signInHref } from "@/components/landing/sign-in-card"

const linkClass = "vr-link inline-flex min-h-11 items-center underline underline-offset-4"

/**
 * Shown by old `/vote`, `/live-voting` and board join links that cannot be mapped to a session the
 * viewer may open. It never reveals whether a session exists. `next` is the original link: after
 * signing in, it is resolved again. A signed-in viewer isn't asked to sign in; instead they get the
 * Voting rooms of the clubs where they can see voting sessions.
 */
export function VotingLinkMoved({ next, signedIn = false, clubs = [] }: { next: string; signedIn?: boolean; clubs?: { id: string; name: string }[] }) {
  return <div className="vr-page vr-member space-y-4">
    <PageHeader title="Voting has moved" description="Club voting now happens in each club's Voting room." />
    {signedIn
      ? clubs.length
        ? <nav aria-label="Your Voting rooms"><ul className="space-y-1">{clubs.map(club => <li key={club.id}><Link className={linkClass} href={`/club/${encodeURIComponent(club.id)}/workspace?section=recruitment&tool=decisions&decisionTab=voting`}>{club.name} Voting room</Link></li>)}</ul></nav>
        : <p>To vote, open the join link or QR code your club leader shares in the room.</p>
      : <p>Sign in with your club account to open this session, or go to your club&apos;s Voting room from your club workspace.</p>}
    <div className="flex flex-wrap gap-4">
      {!signedIn && <Link className={linkClass} href={signInHref(next)}>Sign in</Link>}
      <Link className={linkClass} href="/home">Go to OutClass home</Link>
    </div>
  </div>
}
