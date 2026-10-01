"use client";

import { useRef, useState } from "react";
import { acceptIdentityClubInvitation, setOrganizationInvitationDismissed, type getOrganizationInvitations } from "@/actions/club-onboarding";
import { ClubLogo } from "@/components/club-logo";
import { Button } from "@/components/ui/button";
import { clubWorkspaceHref } from "@/lib/club-workspace";

export type OrganizationInvitation = Awaited<ReturnType<typeof getOrganizationInvitations>>[number];
export type InvitationChange = { id: string; kind: "accepted" | "dismissed" | "restored"; clubName: string };

export function OrganizationInvitationCard({ invitation, onChanged }: {
  invitation: OrganizationInvitation;
  onChanged: (change: InvitationChange) => Promise<void>;
}) {
  const [busy, setBusy] = useState<InvitationChange["kind"] | null>(null);
  const [error, setError] = useState("");
  const working = useRef(false);
  const owner = invitation.requestedRole === "OWNER";
  const role = ({ ADMIN: "an administrator", RECRUITING_ADMIN: "a recruiting administrator", INTERVIEWER: "an interviewer", MEMBER: "a member", OWNER: "an owner" } as const)[invitation.requestedRole];
  async function respond(kind: InvitationChange["kind"]) {
    if (working.current) return;
    working.current = true; setBusy(kind); setError("");
    try {
      if (kind === "accepted") {
        const result = await acceptIdentityClubInvitation(invitation.id);
        await onChanged({ id: invitation.id, kind, clubName: invitation.club.name });
        if (owner) window.location.assign(clubWorkspaceHref(result.clubId));
      } else {
        await setOrganizationInvitationDismissed(invitation.id, kind === "dismissed");
        await onChanged({ id: invitation.id, kind, clubName: invitation.club.name });
      }
    } catch {
      setError(kind === "accepted"
        ? "Could not accept this invitation. It may have expired or your access may have changed. Refresh requests or try again."
        : "Could not update this request. Refresh requests or try again.");
    } finally { working.current = false; setBusy(null); }
  }
  return <li className="rounded-xl border bg-card p-4 sm:p-5" aria-busy={!!busy}>
    <article className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        <ClubLogo clubId={invitation.club.id} logoUrl={invitation.club.logoUrl} color={invitation.club.color || "#142d4e"} text={invitation.club.name.slice(0, 2)} />
        <div className="min-w-0 space-y-1.5">
          <h3 className="break-words font-medium">{invitation.club.name}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{owner ? `You’ve been designated as an administrator of ${invitation.club.name}.`
            : invitation.requestedRole === "MEMBER" ? `${invitation.club.name} added you as a member.` : `${invitation.club.name} invited you to join as ${role}.`}</p>
          <p className="text-xs leading-5 text-muted-foreground">{owner ? "Claiming lets you manage members, roles, applications, recruiting, interviews, and organization settings." : "Accept to join this organization."}</p>
          {invitation.dismissedAt && <p className="text-xs font-medium text-muted-foreground">Hidden from your dashboard · still pending</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-64" aria-label={`Respond to ${invitation.club.name}`}>
        <Button className="min-h-11 flex-1 sm:flex-none" disabled={!!busy} aria-describedby={error ? `invitation-error-${invitation.id}` : undefined} onClick={() => void respond("accepted")}>
          {busy === "accepted" ? owner ? "Claiming…" : "Accepting…" : owner ? "Claim organization" : "Accept"}
        </Button>
        <Button className="min-h-11 flex-1 sm:flex-none" variant="outline" disabled={!!busy} onClick={() => void respond(invitation.dismissedAt ? "restored" : "dismissed")}>
          {busy === "dismissed" ? "Hiding…" : busy === "restored" ? "Restoring…" : invitation.dismissedAt ? "Show on dashboard" : "Not now"}
        </Button>
      </div>
    </article>
    {error && <p role="alert" id={`invitation-error-${invitation.id}`} className="mt-3 text-sm text-destructive">{error}</p>}
  </li>;
}
