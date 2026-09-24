"use client";
import { useState } from "react";
import {
  setRoundAnonymousReview,
  setClubTestRequirement,
} from "@/lib/workspace-api";
import { testRequirements, testRequirementLabels } from "@/lib/test-scores";
import { Button } from "@/components/ui/button";
export function RecruitmentReviewSettings({
  clubId,
  rounds,
  onChanged,
}: {
  clubId: string;
  rounds: { id: string; name: string; anonymousReview: boolean }[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage("Saved. Existing submissions are preserved.");
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="border-y py-4">
      <summary className="cursor-pointer font-medium">
        Review privacy and test requirements
      </summary>
      <div className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Anonymous review withholds identity, free text, attachments,
          experiences, prior notes, and appointments. Numeric metrics, scores,
          and separately prepared manager-reviewed text remain available.
          Previously viewed information cannot be recalled; configure rounds
          before review begins. Disabling anonymity exposes identities to users
          with identified-applicant access and is audited.
        </p>
        {rounds.map((r) => (
          <label className="flex min-h-11 items-center gap-3" key={r.id}>
            <input
              type="checkbox"
              disabled={busy}
              checked={r.anonymousReview}
              onChange={(e) =>
                void run(() =>
                  setRoundAnonymousReview(clubId, r.id, e.target.checked),
                )
              }
            />
            Anonymous review · {r.name}
          </label>
        ))}
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(
              new FormData(e.currentTarget).get("requirement"),
            );
            void run(() => setClubTestRequirement(clubId, value));
          }}
        >
          <label htmlFor={`tests-${clubId}`}>
            Change test requirement for future submissions
          </label>
          <select
            id={`tests-${clubId}`}
            name="requirement"
            required
            defaultValue=""
            className="rounded border p-2"
            disabled={busy}
          >
            <option value="" disabled>
              Select a requirement
            </option>
            {testRequirements.map((r) => (
              <option key={r} value={r}>
                {testRequirementLabels[r]}
              </option>
            ))}
          </select>
          <Button disabled={busy} variant="outline">
            Save requirement
          </Button>
        </form>
        <p role="status">{message}</p>
      </div>
    </details>
  );
}
