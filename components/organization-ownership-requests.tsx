"use client";

import { onboardingFocus } from "@/lib/onboarding-presentation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getOrganizationInvitations } from "@/actions/club-onboarding";
import { invitationProfileDefaults, type InvitationProfileDefaults } from "@/lib/organization-claiming";
import { OrganizationInvitationCard, type InvitationChange } from "@/components/organization-invitation-card";
import { Button } from "@/components/ui/button";

type Invitations = Awaited<ReturnType<typeof getOrganizationInvitations>>;

/** Retains the existing integration point; now handles member and owner requests. */
export function OrganizationOwnershipRequests({ enabled, onProfileDefaults, includeDismissed = false }: {
  enabled: boolean;
  onProfileDefaults?: (defaults: InvitationProfileDefaults) => void;
  includeDismissed?: boolean;
}) {
  const { user, refreshUser } = useAuth();
  const [invitations, setInvitations] = useState<Invitations>([]);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const defaultsCallback = useRef(onProfileDefaults);
  defaultsCallback.current = onProfileDefaults;
  const userId = user?.id;
  const changes = useRef(new Map<string, InvitationChange["kind"]>());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    changes.current.clear();
    setLoading(true); setFailed(false); setInvitations([]);
    getOrganizationInvitations(includeDismissed).then(result => {
      if (cancelled) return;
      setInvitations(result.flatMap(invitation => {
        const kind = changes.current.get(invitation.id);
        if (kind === "accepted" || kind === "declined" || kind === "dismissed" && !includeDismissed) return [];
        return [{ ...invitation, dismissedAt: kind === "dismissed" ? new Date() : kind === "restored" ? null : invitation.dismissedAt }];
      }));
      if (result.length) defaultsCallback.current?.(invitationProfileDefaults(result));
    }).catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, includeDismissed, attempt, userId]);

  async function changed(change: InvitationChange) {
    changes.current.set(change.id, change.kind);
    if (change.kind === "accepted" || change.kind === "declined" || change.kind === "dismissed" && !includeDismissed) {
      setInvitations(current => current.filter(invitation => invitation.id !== change.id));
    } else {
      setInvitations(current => current.map(invitation => invitation.id === change.id ? { ...invitation, dismissedAt: change.kind === "dismissed" ? new Date() : null } : invitation));
    }
    setNotice(change.kind === "accepted" ? `You’ve joined ${change.clubName}.`
      : change.kind === "declined" ? `You’ve declined the invitation from ${change.clubName}.`
      : change.kind === "restored" ? `${change.clubName} will appear on your dashboard again.`
      : `${change.clubName} is hidden from your dashboard. The invitation is still pending in Settings → Organizations.`);
    if (change.kind === "accepted") {
      try { await refreshUser(); }
      catch { setNotice(`You’ve joined ${change.clubName}. Refresh the page to update your club list.`); }
    }
  }
  if (!enabled) return null;
  return <section aria-label={includeDismissed ? "Pending organization invitations" : "Club Invitations"} className="mb-6 min-w-0 max-w-5xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="oc-section-heading ">{includeDismissed ? "Pending Invitations" : "Club Invitations"}</h2><p className="mt-1 text-sm text-muted-foreground">{includeDismissed ? "All pending requests, including those you set aside." : "Your communities, on your terms. Accept now or come back later."}</p></div>
      {!loading && <Button size="sm" className="min-h-11" variant="ghost" onClick={() => setAttempt(value => value + 1)}>Refresh requests</Button>}
    </header>
    {onProfileDefaults && invitations.length > 0 && <p className="text-sm text-muted-foreground">Invitation details may fill blank profile fields. Review and edit your name and graduation year before saving.</p>}
    {notice && <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{notice}</p>}
    {loading ? <div role="status" className="rounded-xl border bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">Checking organization invitations…</div>
      : failed ? <div className="rounded-xl border p-4 space-y-3"><p role="alert">Could not check organization invitations.</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry invitations</Button></div>
      : invitations.length ? <ul className="space-y-3">{invitations.map(invitation => <OrganizationInvitationCard key={invitation.id} invitation={invitation} onChanged={changed} allowDecline={includeDismissed} />)}</ul>
      : <p className="rounded-xl border bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">{includeDismissed ? "You have no pending organization invitations." : "You’re all caught up. No new club invitations."}</p>}
    {!includeDismissed && <p className="text-xs leading-5 text-muted-foreground">“Not now” hides a request without declining it. <Link href="/settings/organizations" className={`underline underline-offset-4 ${onboardingFocus}`}>Find all pending invitations in Settings → Organizations</Link>.</p>}
  </section>;
}
