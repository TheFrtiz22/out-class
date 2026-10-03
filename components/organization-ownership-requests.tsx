"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context";
import { invitationProfileDefaults, type InvitationProfileDefaults } from "@/lib/organization-claiming";
import { OrganizationInvitationCard, type InvitationChange } from "@/components/organization-invitation-card";
import { Button } from "@/components/ui/button";

/** Retains the existing integration point for member invitations and owner claims. */
export function OrganizationOwnershipRequests({ enabled, onProfileDefaults, includeDismissed = false }: {
  enabled: boolean;
  onProfileDefaults?: (defaults: InvitationProfileDefaults) => void;
  includeDismissed?: boolean;
}) {
  const { invitations: pending, loading, failed, notice, refresh, changed } = useOrganizationInvitations();
  const invitations = includeDismissed ? pending : pending.filter(invitation => !invitation.dismissedAt);
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);
  const attention = useRef<HTMLDivElement>(null);
  const visibleIds = useRef(new Set<string>());
  visibleIds.current = new Set(invitations.map(invitation => invitation.id));
  const defaultsCallback = useRef(onProfileDefaults);
  defaultsCallback.current = onProfileDefaults;
  useEffect(() => {
    if (enabled && pending.length) defaultsCallback.current?.(invitationProfileDefaults(pending));
  }, [enabled, pending]);
  useEffect(() => {
    if (collapseHeight === null || invitations.length) return;
    // Commit the measured height before transitioning to zero; content can disappear immediately.
    if (attention.current) void attention.current.offsetHeight;
    const frame = requestAnimationFrame(() => setCollapseHeight(0));
    // Also finish when transition events are suppressed (e.g. reduced motion).
    const timer = setTimeout(() => setCollapseHeight(null), 220);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [collapseHeight, invitations.length]);

  async function respond(change: InvitationChange) {
    // Track responses within the same render as well, when two submissions finish together.
    if (!includeDismissed && change.kind !== "restored" && visibleIds.current.delete(change.id) && !visibleIds.current.size) {
      setCollapseHeight(attention.current?.getBoundingClientRect().height ?? 0);
    }
    await changed(change);
  }

  if (!enabled) return null;
  if (!includeDismissed) {
    // No heading, loading skeleton, error/empty card, or margin without an actionable request.
    if (!invitations.length && collapseHeight === null) return null;
    const closing = !invitations.length;
    return <div ref={attention} style={{ height: closing ? collapseHeight ?? undefined : undefined }} className="oc-invitation-attention" data-collapsing={closing} aria-hidden={closing || undefined} onTransitionEnd={event => {
      if (event.target === event.currentTarget && closing) setCollapseHeight(null);
    }}>
      <section aria-label="Pending organization invitations" className="oc-invitation-attention-inner">
        {invitations.length > 1 ? <details className="rounded-lg border border-brand-orange/20 bg-card">
          <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring">
            {invitations.length} invitations need your response <span className="ml-2 font-normal text-muted-foreground">Review invitations</span>
          </summary>
          <ul className="max-h-96 space-y-2 overflow-y-auto px-3 pb-3">{invitations.map(invitation => <OrganizationInvitationCard key={invitation.id} invitation={invitation} onChanged={respond} allowDecline compact />)}</ul>
        </details> : <ul>{invitations.map(invitation => <OrganizationInvitationCard key={invitation.id} invitation={invitation} onChanged={respond} allowDecline compact />)}</ul>}
      </section>
    </div>;
  }

  if (!invitations.length && !loading && !failed) return null;
  return <section aria-label="Pending organization invitations" className="mb-6 min-w-0 max-w-5xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="oc-section-heading">Pending Invitations</h2><p className="mt-1 text-sm text-muted-foreground">All pending requests, including those you set aside.</p></div>
      {!loading && <Button size="sm" className="min-h-11" variant="ghost" onClick={refresh}>Refresh requests</Button>}
    </header>
    {onProfileDefaults && invitations.length > 0 && <p className="text-sm text-muted-foreground">Invitation details may fill blank profile fields. Review and edit your name and graduation year before saving.</p>}
    {notice && <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{notice}</p>}
    {loading && !invitations.length ? <div role="status" className="rounded-xl border bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">Checking organization invitations…</div>
      : failed ? <div className="rounded-xl border p-4 space-y-3"><p role="alert">Could not check organization invitations.</p><Button variant="outline" onClick={refresh}>Retry invitations</Button></div>
      : <ul className="space-y-3">{invitations.map(invitation => <OrganizationInvitationCard key={invitation.id} invitation={invitation} onChanged={changed} allowDecline />)}</ul>}
    <p className="text-xs leading-5 text-muted-foreground">“Not now” hides a request without declining it. <Link href="/?workspace=student" className="underline underline-offset-4">Return to your dashboard</Link>.</p>
  </section>;
}
