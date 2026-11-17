"use client";
import { userMessage } from "@/lib/user-message"
import { ActionWorkflow } from "@/components/product/action-workflow";
import Link from "next/link";
import { useState } from "react";
import {
  setRoundAnonymousReview,
  setClubTestRequirement,
} from "@/lib/workspace-api";
import { testRequirements, testRequirementLabels } from "@/lib/test-scores";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select"
export function RecruitmentReviewSettings({
  clubId,
  rounds,
  onChanged,
  embedded = false,
  canIdentify = true,
}: {
  embedded?: boolean;
  canIdentify?: boolean;
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
      setMessage(userMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }
  const content = (
      <div className="space-y-4 pt-4" data-saving={busy}>
        <p className="text-sm text-muted-foreground">
          Reviewers in an anonymous round see scores and metrics, not names,
          free text, files or notes. Set it before review begins: what a
          reviewer has seen can’t be hidden again. Turning it off shows names
          to members who can identify applicants, and is audited.
        </p>
        {!canIdentify && <p className="text-sm text-muted-foreground">Changing anonymity also requires permission to identify applicants.</p>}
        {rounds.map((r) => (
          <label className="flex min-h-11 items-center gap-3" key={r.id}>
            <input
              type="checkbox"
              className="oc-checkbox"
              disabled={busy || !canIdentify}
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
          <NativeSelect
            id={`tests-${clubId}`}
            name="requirement"
            required
            defaultValue=""
            
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
          </NativeSelect>
          <Button disabled={busy} variant="outline">
            Save requirement
          </Button>
        </form>
        <p role="status">{message}</p>
        <p className="text-sm text-muted-foreground">Decision letters are edited in <Link className="underline underline-offset-4" href={`/club/${encodeURIComponent(clubId)}/workspace?section=settings&setting=notifications`}>Settings › Communications</Link>.</p>
      </div>
  );
  return embedded ? content : <ActionWorkflow title="Review privacy & test requirements" description="Configure round privacy and required applicant test information." trigger="Review privacy & test requirements" presentation="sheet">{content}</ActionWorkflow>;
}
