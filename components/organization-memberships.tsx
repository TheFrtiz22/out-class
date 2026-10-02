"use client";

import { onboardingFocus } from "@/lib/onboarding-presentation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { ClubLogo } from "@/components/club-logo";
import { Button } from "@/components/ui/button";
import { clubWorkspaceHref } from "@/lib/club-workspace";

/** Uses the authenticated /api/users/me memberships, refreshed by invitation acceptance. */
export function OrganizationMemberships() {
  const { user, loading, refreshUser } = useAuth();
  const memberships = user?.memberships.filter(member => member.status === "ACTIVE") || [];
  const roles = { OWNER: "Owner", ADMIN: "Admin", RECRUITING_ADMIN: "Recruiting admin", INTERVIEWER: "Interviewer", MEMBER: "Member" } as const;
  return <section aria-label="Your organizations" className="mb-10 space-y-4">
    <h2 className="font-display text-2xl">Your organizations</h2>
    {loading ? <p role="status" className="rounded-xl border p-5 text-sm">Loading your organizations…</p>
      : !user ? <div className="rounded-xl border p-5 space-y-3"><p role="alert">Could not load your organizations.</p><Button variant="outline" onClick={() => void refreshUser()}>Retry organizations</Button></div>
      : memberships.length ? <ul className="grid gap-3 sm:grid-cols-2">{memberships.map(member => <li key={member.id} className="flex min-w-0 flex-col rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3"><ClubLogo clubId={member.clubId} logoUrl={member.club.logoUrl} color={member.club.color || "#142d4e"} text={member.club.name.slice(0, 2)} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold leading-6">{member.club.name}</h3><p className="mt-1 text-sm text-muted-foreground">{member.isOwner ? "Owner" : roles[member.accessRole]}</p></div></div>
        <Link href={clubWorkspaceHref(member.clubId)} className={`mt-3 inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4 ${onboardingFocus}`}>Open organization<span className="sr-only"> · {member.club.name}</span></Link>
      </li>)}</ul> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">You haven’t joined any organizations yet. Accepted invitations will appear here.</p>}
  </section>;
}
