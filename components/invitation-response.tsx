"use client";
import { useRef, useState } from "react";
import {
  acceptClubInvitation,
  declineClubInvitation,
} from "@/actions/club-access";
import { acceptIdentityClubInvitation } from "@/actions/club-onboarding";
import { clubWorkspaceHref } from "@/lib/club-workspace";
import { Button } from "@/components/ui/button";
export function InvitationResponse({ id, owner = false }: { id: string; owner?: boolean }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const responding = useRef(false);
  async function respond(accept: boolean) {
    if (responding.current) return;
    responding.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (accept) {
        const result = await (owner ? acceptIdentityClubInvitation(id) : acceptClubInvitation(id));
        window.location.assign(owner ? clubWorkspaceHref(result.clubId) : "/");
      } else {
        await declineClubInvitation(id);
        window.location.assign("/");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not respond. Try again.",
      );
      responding.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => void respond(true)}>
          {busy ? "Responding…" : owner ? "Claim organization" : "Accept invitation"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void respond(false)}
        >
          Decline
        </Button>
      </div>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
