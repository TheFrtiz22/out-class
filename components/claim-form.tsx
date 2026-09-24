"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestClubClaim } from "@/actions/club-workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function ClaimForm({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await requestClubClaim(clubId, String(data.get("evidence")));
          router.refresh();
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not submit. Please try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block font-medium" htmlFor="evidence">
        Your role and supporting evidence
      </label>
      <p id="evidence-help" className="text-sm text-muted-foreground">
        Explain your relationship to the club and provide an official leadership
        page, club contact, or other verifiable context. Do not include
        passwords or sensitive identity documents. Only platform administrators
        review this evidence.
      </p>
      <Textarea
        id="evidence"
        name="evidence"
        aria-describedby="evidence-help"
        required
        minLength={10}
        maxLength={3000}
        rows={7}
        disabled={busy}
      />
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy} type="submit">
        {busy ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}
