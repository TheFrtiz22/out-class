"use client";
import { userMessage } from "@/lib/user-message"
import { useState } from "react";
import { listClubClaims } from "@/actions/club-claims";
import { changePlatformResource } from "@/actions/platform-admin";
import { unwrapAction } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control"
import { EmptyState } from "@/components/ui/empty-state"
import { schedulingDateTime } from "@/lib/scheduling-config"
const claimActionLabels: Record<string, string> = { "club.claim.request": "Claim requested", "platform.claim.change": "Status changed" }

export function ClaimReview({
  initial,
}: {
  initial: Awaited<ReturnType<typeof listClubClaims>>;
}) {
  const [claims, setClaims] = useState(initial),
    [status, setStatus] = useState("PENDING"),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(next: string, index: number) {
    setBusy(true);
    setError("");
    try {
      setClaims(await listClubClaims(next, index));
      setStatus(next);
      setPage(index);
    } catch {
      setError("Could not load claims. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <SegmentedControl
        label="Claim status"
        value={status}
        onChange={(value) => { if (!busy) void load(value, 0) }}
        options={[
          { value: "PENDING", label: "Pending" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
        ]}
      />
      {error && <p role="alert">{error}</p>}
      {!claims.length && <EmptyState density="compact" tone="subtle" title={`No ${status.toLowerCase()} claims`} description={status === "PENDING" ? "Leaders asking to manage a club will show up here." : "Nothing to show for this status yet."} />}
      {claims.map((claim) => (
        <section key={claim.id} className="space-y-3 border-t py-5">
          <h2 className="oc-section-heading ">{claim.club.name}</h2>
          <p className="break-all">
            {claim.user.email} · {claim.status.toLowerCase()}
          </p>
          <p className="whitespace-pre-wrap break-words">{claim.explanation}</p>
          {claim.status === "PENDING" && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const submitter = (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement;
                setBusy(true);
                setError("");
                try {
                  unwrapAction(
                    await changePlatformResource(
                      {
                        kind: "claim",
                        id: claim.id,
                        approved: submitter.value === "approve",
                      },
                      String(form.get("reason")),
                    ),
                  );
                  setClaims(await listClubClaims(status, page));
                } catch (error) {
                  setError(
                    userMessage(error, "Could not review claim."),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor={`reason-${claim.id}`}>
                Review rationale (saved in audit history)
              </label>
              <Textarea
                id={`reason-${claim.id}`}
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                disabled={busy}
              />
              <div className="flex gap-3">
                <Button type="submit" value="approve" disabled={busy}>
                  Approve ownership
                </Button>
                <Button
                  type="submit"
                  value="reject"
                  variant="outline"
                  disabled={busy}
                >
                  Reject
                </Button>
              </div>
            </form>
          )}
          <details>
            <summary className="cursor-pointer">Audit history</summary>
            <ul className="space-y-2 py-3 text-sm">
              {claim.history.map((h) => (
                <li key={h.id}>
                  {schedulingDateTime(h.createdAt)} · {claimActionLabels[h.action] ?? h.action} · Actor{" "}
                  {h.actorId}
                  {h.reason && <p>{h.reason}</p>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
      {(page > 0 || claims.length >= 50) && <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={busy || page === 0}
          onClick={() => void load(status, page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={busy || claims.length < 50}
          onClick={() => void load(status, page + 1)}
        >
          Next
        </Button>
      </div>}
    </div>
  );
}
