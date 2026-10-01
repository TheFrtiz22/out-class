"use client";

import { useEffect, useRef, useState } from "react";
import { getOrganizationInvitations } from "@/actions/club-onboarding";
import { invitationProfileDefaults, type InvitationProfileDefaults } from "@/lib/organization-claiming";
import { InvitationResponse } from "@/components/invitation-response";
import { Button } from "@/components/ui/button";

type Invitations = Awaited<ReturnType<typeof getOrganizationInvitations>>;

export function OrganizationOwnershipRequests({ enabled, onProfileDefaults }: {
  enabled: boolean;
  onProfileDefaults?: (defaults: InvitationProfileDefaults) => void;
}) {
  const [invitations, setInvitations] = useState<Invitations>([]);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const defaultsCallback = useRef(onProfileDefaults);
  defaultsCallback.current = onProfileDefaults;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getOrganizationInvitations().then(result => {
      if (cancelled) return;
      setInvitations(result);
      if (result.length) defaultsCallback.current?.(invitationProfileDefaults(result));
    }).catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, attempt]);
  if (!enabled) return null;
  if (loading) return <p role="status" className="mb-4 text-sm text-muted-foreground">Checking organization invitations…</p>;
  if (failed) return <div className="mb-4 space-y-2"><p role="alert">Could not check organization invitations.</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry invitations</Button></div>;
  const owners = invitations.filter(invitation => invitation.requestedRole === "OWNER");
  if (!invitations.length || (!owners.length && !onProfileDefaults)) return null;
  return <section aria-label="Organization ownership requests" className="mb-6 space-y-4">
    {onProfileDefaults && invitations.length > 0 && <p className="text-sm text-muted-foreground">Invitation details may fill blank profile fields. Review and edit your name and graduation year before saving.</p>}
    {owners.map(invitation => <div key={invitation.id} className="rounded-xl border bg-card p-6 space-y-3">
      <h2 className="text-xl font-semibold">You’ve been designated as an administrator for {invitation.club.name}.</h2>
      <p>Claiming gives you owner access to manage members, roles, applications, recruiting, interviews, and organization settings.</p>
      <InvitationResponse id={invitation.id} owner />
    </div>)}
  </section>;
}
