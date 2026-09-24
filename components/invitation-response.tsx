"use client";
import { useState } from "react";
import {
  acceptClubInvitation,
  declineClubInvitation,
} from "@/actions/club-access";
import { Button } from "@/components/ui/button";
export function InvitationResponse({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function respond(accept: boolean) {
    setBusy(true);
    setMessage("");
    try {
      if (accept) {
        await acceptClubInvitation(id);
        window.location.assign("/");
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
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => void respond(true)}>
          Accept invitation
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
