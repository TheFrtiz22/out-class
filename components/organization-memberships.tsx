"use client";
import { LoadingState } from "@/components/ui/loading-state"

import { onboardingFocus } from "@/lib/onboarding-presentation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { ClubLogo } from "@/components/club-logo";
import { Button } from "@/components/ui/button";
import { clubWorkspaceHref } from "@/lib/club-workspace";
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"
import { membershipRoleLabel } from "@/lib/copy/terms"

/** Uses the authenticated /api/users/me memberships, refreshed by invitation acceptance. */
export function OrganizationMemberships() {
  const { user, loading, refreshUser } = useAuth();
  const memberships = user?.memberships.filter(member => member.status === "ACTIVE") || [];
    return <section aria-label="Your clubs" className="mb-10 space-y-4">
    <h2 className="oc-section-heading ">Your clubs</h2>
    {loading ? <LoadingState label="Loading your clubs…" layout="cards" rows={3} />
      : !user ? <div className="rounded-xl border p-5 space-y-3"><p role="alert">Could not load your clubs.</p><Button variant="outline" onClick={() => void refreshUser()}>Retry clubs</Button></div>
      : memberships.length ? <ul className="grid gap-3 sm:grid-cols-2">{memberships.map(member => <li key={member.id} className="oc-content-panel flex min-w-0 flex-col sm:p-5">
        <div className="flex items-start gap-3"><ClubLogo clubId={member.clubId} logoUrl={member.club.logoUrl} marketing={member.club.marketing} color={member.club.color || DEFAULT_CLUB_COLOR} text={member.club.name.slice(0, 2)} /><div className="min-w-0 flex-1"><h3 className="oc-card-heading break-words">{member.club.name}</h3><p className="mt-1 text-sm text-muted-foreground">{membershipRoleLabel(member)}</p></div></div>
        <Link href={clubWorkspaceHref(member.clubId)} className={`mt-3 inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4 ${onboardingFocus}`}>Open club<span className="sr-only"> · {member.club.name}</span></Link>
      </li>)}</ul> : <div className="space-y-2 rounded-xl border oc-glass-surface p-5 text-sm text-muted-foreground"><p>You aren’t a member of any club yet. Memberships appear after a club invites you and you accept.</p><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/explore">Explore clubs</Link></div>}
  </section>;
}
