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
        if ("status" in result && result.status === "INACTIVE_MEMBERSHIP") {
          setMessage("Your membership is inactive. Contact an organization owner about reinstatement; this offer cannot restore access.");
          responding.current = false;
          setBusy(false);
          return;
        }
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
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={() => void respond(true)}>
          {busy ? "Responding…" : owner ? "Claim organization" : "Accept invitation"}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={busy}
          onClick={() => void respond(false)}
        >
          Decline
        </Button>
      </div>
      {message && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{message}</p>}
    </div>
  );
}
