"use client";

import { useEffect, useRef, useState } from 'react';
import { getOrganizationInvitations } from '@/actions/club-onboarding';
import { invitationProfileDefaults, type InvitationProfileDefaults } from '@/lib/organization-claiming';
import { Button } from '@/components/ui/button';

type Invitations = Awaited<ReturnType<typeof getOrganizationInvitations>>;
/** Verified suggestions only. Joining/claiming is offered after the existing profile wizard. */
export function InvitationProfileSuggestions({ enabled, onDefaults }: { enabled: boolean; onDefaults: (defaults: InvitationProfileDefaults) => void }) {
  const [invitations, setInvitations] = useState<Invitations>([]), [loading, setLoading] = useState(enabled), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const callback = useRef(onDefaults); callback.current = onDefaults;
  useEffect(() => {
    if (!enabled) return;
    let current = true; setLoading(true); setFailed(false); setInvitations([]);
    getOrganizationInvitations(true).then(result => { if (current) { setInvitations(result); callback.current(invitationProfileDefaults(result)); } })
      .catch(() => { if (current) setFailed(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [enabled, attempt]);
  if (!enabled) return null;
  if (loading) return <p role="status" className="mb-5 text-sm text-muted-foreground">Checking for profile details from your invitations… You can edit your profile below.</p>;
  if (failed) return <div className="mb-5 space-y-2 rounded-xl border p-4"><p className="text-sm text-muted-foreground">Could not check invitation details. You can complete your profile now; invitations require a verified university email.</p><Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Retry profile suggestions</Button></div>;
  if (!invitations.length) return null;
  const owners = invitations.filter(invitation => invitation.requestedRole === 'OWNER');
  return <section className="mb-6 space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-label="Welcome to your organizations">
    {owners.length ? owners.map(invitation => <p key={invitation.id} className="font-medium">You’re the designated administrator for {invitation.club.name}.</p>) : <p className="font-medium">Your organizations are waiting for you.</p>}
    <p className="text-sm leading-6 text-muted-foreground">We’ve used available invitation details to suggest your name and graduation year. Review and edit them below, then complete your profile. Your pending invitations will be ready afterward{owners.length ? ', with a Claim organization button for your administrator requests' : ''}.</p>
  </section>;
}
