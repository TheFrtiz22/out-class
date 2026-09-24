"use client";
import { useState } from "react";
import {
  revealApplicantIdentity,
  saveAnonymousReviewContent,
} from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function RevealApplicant({
  clubId,
  applicationId,
  canPrepare = false,
}: {
  clubId: string;
  applicationId: string;
  canPrepare?: boolean;
}) {
  const [revealed, setRevealed] = useState<Awaited<
      ReturnType<typeof revealApplicantIdentity>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <details className="border-y py-4">
      <summary className="cursor-pointer font-medium">
        Authorized identity reveal
      </summary>
      <p className="my-3 text-sm">
        This explicit exception is recorded in the audit log. Other reviewers
        remain in anonymous mode.
      </p>
      {!revealed ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason"));
            setBusy(true);
            setError("");
            try {
              setRevealed(
                await revealApplicantIdentity(clubId, applicationId, reason),
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "Reveal failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`reveal-${applicationId}`}>
            Reason for revealing identity
          </label>
          <Textarea
            id={`reveal-${applicationId}`}
            name="reason"
            required
            minLength={10}
            maxLength={1000}
          />
          <Button disabled={busy}>Reveal and record access</Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold">
            {revealed.student.studentProfile?.firstName}{" "}
            {revealed.student.studentProfile?.lastName}
          </p>
          <p>{revealed.student.email}</p>
          {revealed.answers.map((a) => (
            <div key={a.id}>
              <p className="font-medium">{a.question.prompt}</p>
              <p className="whitespace-pre-wrap break-all">{a.response}</p>
            </div>
          ))}
          {canPrepare && (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await saveAnonymousReviewContent(
                    clubId,
                    applicationId,
                    String(values.get("content")),
                    values.get("confirmed") === "on",
                  );
                  setError(
                    "Anonymous content saved. Reload the workspace to see it.",
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor={`packet-${applicationId}`}>
                Prepare anonymous evaluation content
              </label>
              <p className="text-sm">
                Copy relevant essay passages and experience facts. Remove names,
                organizations or unique details that reveal identity, links,
                contact information, and filenames. This is manual editorial
                review, not automatic résumé redaction.
              </p>
              <Textarea
                id={`packet-${applicationId}`}
                name="content"
                rows={8}
                maxLength={20000}
                defaultValue={revealed.anonymousReviewText || ""}
              />
              <label className="flex gap-2">
                <input type="checkbox" name="confirmed" required />I reviewed
                this content and removed identifying information.
              </label>
              <Button disabled={busy}>Publish anonymous content</Button>
            </form>
          )}
          <Button variant="outline" onClick={() => setRevealed(null)}>
            Hide revealed content
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
